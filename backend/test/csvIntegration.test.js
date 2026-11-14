const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const apiRoutes = require("../routes/apiRoutes");
const healthRoutes = require("../routes/healthRoutes");
const csvService = require("../services/csvService");
const healthService = require("../services/healthService");
const simulationService = require("../services/simulationService");

async function withServer(callback) {
  const app = express();
  app.use("/api/data", healthRoutes);
  app.use("/api", apiRoutes);
  const server = app.listen(0);
  try {
    const address = server.address();
    await callback(`http://127.0.0.1:${address.port}/api`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("available CSV datasets are returned even when a declared dataset is missing", async () => {
  await withServer(async (baseUrl) => {
    const [statusResponse, allResponse, issResponse, missingResponse] = await Promise.all([
      fetch(`${baseUrl}/data/csv/status`),
      fetch(`${baseUrl}/data/csv`),
      fetch(`${baseUrl}/data/csv/nasaISS`),
      fetch(`${baseUrl}/data/csv/healthBenchmarks`),
    ]);

    assert.equal(statusResponse.status, 503);
    const status = await statusResponse.json();
    assert.equal(status.data.find((entry) => entry.dataset === "healthReadings").exists, true);
    assert.equal(status.data.find((entry) => entry.dataset === "healthBenchmarks").exists, false);

    assert.equal(allResponse.status, 206);
    const all = await allResponse.json();
    assert.equal(all.success, false);
    assert.equal(all.data.crewInfo.length, 17);
    assert.equal(all.data.healthReadings.length, 0);
    assert.equal(all.data.nasaEarth.length, 14);
    assert.equal(all.data.nasaISS.length, 14);
    assert.equal(all.data.nasaLunar.length, 14);
    assert.equal(all.errors[0].code, "CSV_FILE_NOT_FOUND");

    assert.equal(issResponse.status, 200);
    const iss = await issResponse.json();
    assert.equal(iss.count, 14);
    assert.equal(iss.data[0].Benchmarks, "Systolic blood pressure(mm Hg)");

    assert.equal(missingResponse.status, 503);
    const missing = await missingResponse.json();
    assert.equal(missing.error.code, "CSV_FILE_NOT_FOUND");
  });
});

test("dashboard APIs combine CSV crew and NASA data with labeled simulation when measurements are missing", async () => {
  const model = await healthService.getData();
  assert.equal(model.crew.length, 17);
  assert.equal(model.crew[0].name, "Soyeon (Lee So-hyun)");
  assert.equal(model.crew[0].currentLocation, "Earth");
  assert.equal(model.crew[0].missionTitle, "Soyuz TMA-12 / Soyuz TMA-11");
  assert.ok(model.healthReadings.length > 0);
  assert.ok(model.healthReadings.some((reading) => reading.simulated && reading.source === "SIMULATED DEMO DATA"));
  assert.ok(model.statistics.length > 0);
  assert.ok(model.riskOutlooks.some((risk) => risk.id !== "Unknown"));
  assert.equal(model.dataMode, "MIXED DATA");
  assert.equal(model.simulation.enabled, true);
  assert.equal(model.healthDataQuality.csvRows, 0);
  assert.ok(model.healthDataQuality.simulatedRows > 0);
  assert.equal(model.environmentBenchmarks.Earth.length, 14);
  assert.equal(model.environmentBenchmarks.ISS[0].upperLimit, 140);
  assert.equal(model.environmentBenchmarks.Moon.length, 14);
  assert.equal(model.riskThresholds.length, 17);
  assert.equal(model.datasetErrors.some((error) => error.dataset === "healthBenchmarks"), true);

  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/dashboard/overview`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.meta.simulated, true);
    assert.equal(body.data.crew.length, 17);
    assert.ok(body.data.healthReadings.length > 0);
    assert.ok(body.data.healthReadings.every((reading) => reading.simulated));
    assert.ok(body.data.statistics.length > 0);
    assert.equal(body.data.environmentBenchmarks.ISS.length, 14);
    assert.equal(body.data.datasetStatus.find((entry) => entry.dataset === "healthReadings").records, 0);
  });
});

test("simulated readings are deterministic, explicitly sourced, and deduplicated against CSV samples", () => {
  const crew = [{
    id: "AST-001",
    name: "Test crew",
    currentLocation: "Earth",
    simulated: false,
  }];
  const timestamp = "2026-03-16T12:00:00.000Z";
  const existingRecords = [{
    astronautId: "AST-001",
    timestamp,
    measurements: [{ parameter: "Heart Rate", value: 72, unit: "BPM" }],
  }];
  const options = [crew, healthService.metricDefinitions, existingRecords, {}, new Date(timestamp), 2];
  const first = simulationService.generateDemoReadings(...options);
  const second = simulationService.generateDemoReadings(...options);

  assert.deepEqual(first, second);
  assert.equal(first.every((record) => record.simulated && record.source === "SIMULATED DEMO DATA"), true);
  assert.equal(first.some((record) => record.timestamp === timestamp
    && record.measurements.some((measurement) => measurement.parameter === "Heart Rate")), false);
});

test("CSV health normalization skips invalid rows and preserves available measurements", () => {
  const crew = [{ id: "AST-001" }];
  const normalized = healthService.normalizeHealthReadings([
    {
      "Astronaut id": "AST-001",
      Timestamp: "2026-01-02T03:04:05.000Z",
      "Systolic blood pressure(mm Hg)": "120",
      "Diastolic blood pressure(mm Hg)": "80",
      "Heart Rate(bpm)": "72",
      "Body Temperature(degree celsius)": "",
    },
    {
      "Astronaut id": "AST-001",
      Timestamp: "not-a-timestamp",
      "Daily Sleep Hours(hours)": "7.5",
    },
    { "Astronaut id": "UNKNOWN", "Heart Rate(bpm)": "90" },
    null,
    {},
  ], crew);

  assert.equal(normalized.records.length, 2);
  const datedRecord = normalized.records.find((record) => record.timestamp);
  const undatedRecord = normalized.records.find((record) => !record.timestamp);
  assert.deepEqual(datedRecord.measurements, [
    { parameter: "Blood Pressure", value: "120/80", unit: "mmHg" },
    { parameter: "Heart Rate", value: 72, unit: "BPM" },
  ]);
  assert.equal(undatedRecord.measurements[0].parameter, "Sleep Duration");
  assert.equal(normalized.skippedRows, 3);
  assert.equal(normalized.invalidTimestamps, 1);
});

test("CSV parser keeps actual headers and reports unavailable datasets", () => {
  const readings = csvService.getCSVData("healthReadings");
  assert.deepEqual(readings, []);
  assert.throws(() => csvService.getCSVData("healthBenchmarks"), { code: "CSV_FILE_NOT_FOUND" });
});
