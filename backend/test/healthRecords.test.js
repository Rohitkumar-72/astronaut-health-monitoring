const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const apiRoutes = require("../routes/apiRoutes");
const healthService = require("../services/healthService");

async function withServer(callback) {
  const app = express();
  app.use(express.json({ limit: "64kb" }));
  app.use("/api", apiRoutes);
  const server = app.listen(0);
  try {
    const address = server.address();
    await callback(`http://127.0.0.1:${address.port}/api`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("confirmed health records are validated, timestamped, idempotent, assessed, and visible in alerts", async () => {
  const requestId = `phase-3-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const payload = {
    astronautId: "AST-004",
    requestId,
    measurements: [
      { parameter: "Heart Rate", value: 108, unit: "BPM" },
      { parameter: "Blood Pressure", value: "150/95", unit: "mmHg" },
    ],
    symptoms: ["Tired"],
  };

  await withServer(async (baseUrl) => {
    const create = () => fetch(`${baseUrl}/health/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const first = await create();
    assert.equal(first.status, 201);
    const firstBody = await first.json();
    assert.equal(firstBody.data.record.astronautId, payload.astronautId);
    assert.equal(firstBody.data.record.source, "Crew-confirmed self-report");
    assert.equal(Number.isNaN(Date.parse(firstBody.data.record.timestamp)), false);
    assert.deepEqual(firstBody.data.record.measurements[1], payload.measurements[1]);
    assert.equal(firstBody.data.record.assessment[0].status, "Outside the configured demonstration band");
    assert.ok(firstBody.data.riskOutlook);
    assert.ok(firstBody.data.alerts.length > 0);
    assert.equal(firstBody.meta.durable, false);

    const duplicate = await create();
    assert.equal(duplicate.status, 200);
    const duplicateBody = await duplicate.json();
    assert.equal(duplicateBody.data.record.id, firstBody.data.record.id);
    assert.equal(duplicateBody.data.created, false);
    assert.deepEqual(duplicateBody.data.record.alertIds, firstBody.data.record.alertIds);

    const [recordsResponse, alertsResponse] = await Promise.all([
      fetch(`${baseUrl}/health/records`),
      fetch(`${baseUrl}/alerts?crewId=${payload.astronautId}`),
    ]);
    const records = (await recordsResponse.json()).data;
    const alerts = (await alertsResponse.json()).data;
    assert.equal(records.filter((record) => record.requestId === requestId).length, 1);
    assert.ok(alerts.some((alert) => alert.sourceRecordId === firstBody.data.record.id));
  });
});

test("health record API rejects invalid crew, parameters, units, and payloads without saving", async () => {
  const valid = {
    astronautId: "AST-001",
    requestId: `invalid-test-${Date.now()}`,
    measurements: [{ parameter: "Heart Rate", value: 85, unit: "BPM" }],
    symptoms: [],
  };
  const recordsBefore = await healthService.getHealthRecords();

  await withServer(async (baseUrl) => {
    const send = (payload) => fetch(`${baseUrl}/health/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const invalidPayloads = [
      { ...valid, astronautId: "UNKNOWN" },
      { ...valid, requestId: `${valid.requestId}-unit`, measurements: [{ ...valid.measurements[0], unit: "km/h" }] },
      { ...valid, requestId: `${valid.requestId}-metric`, measurements: [{ parameter: "Blood Glucose", value: 110, unit: "mg/dL" }] },
      { ...valid, requestId: `${valid.requestId}-range`, measurements: [{ ...valid.measurements[0], value: -1 }] },
      { ...valid, requestId: `${valid.requestId}-extra`, measurements: [{ ...valid.measurements[0], severity: "Critical" }] },
    ];
    for (const payload of invalidPayloads) {
      const response = await send(payload);
      assert.equal(response.status, 400);
    }
  });

  assert.equal((await healthService.getHealthRecords()).length, recordsBefore.length);
});
