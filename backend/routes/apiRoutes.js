const express = require("express");
const dataService = require("../services/healthService");

const router = express.Router();
const alertStatuses = ["New", "Acknowledged", "Under Assessment", "Resolved"];
const alertSeverities = ["Critical", "High", "Medium", "Low"];
const allowedParameters = new Set(dataService.metricDefinitions.map((metric) => metric.parameter));
const metricByParameter = new Map(dataService.metricDefinitions.map((metric) => [metric.parameter, metric]));
const riskMethod = "Rule-based trend and unresolved-alert heuristic; not a trained AI model.";
const sendData = (res, data, meta = {}) => res.json({ data, meta: { simulated: true, ...meta } });

const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

const getCrewMember = (model, crewId) => model.crew.find((member) => member.id === crewId);

function validateHealthRecord(body) {
  const allowedFields = new Set(["astronautId", "requestId", "measurements", "symptoms"]);
  if (!body || typeof body !== "object" || Array.isArray(body)
    || Object.keys(body).some((key) => !allowedFields.has(key))) {
    return "Only astronautId, requestId, measurements, and symptoms are accepted.";
  }
  if (typeof body.astronautId !== "string" || !body.astronautId.trim()) {
    return "A valid astronautId is required.";
  }
  if (typeof body.requestId !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(body.requestId)) {
    return "A valid requestId is required to prevent duplicate submissions.";
  }
  if (!Array.isArray(body.measurements) || body.measurements.length > metricByParameter.size) {
    return "Measurements must be an array of supported health parameters.";
  }
  if (!Array.isArray(body.symptoms) || body.symptoms.length > 10) {
    return "Symptoms must be an array containing no more than 10 entries.";
  }
  if (body.measurements.length === 0 && body.symptoms.length === 0) {
    return "At least one measurement or symptom is required.";
  }

  const seenParameters = new Set();
  for (const measurement of body.measurements) {
    if (
      !measurement
      || typeof measurement !== "object"
      || Array.isArray(measurement)
      || Object.keys(measurement).some((key) => !["parameter", "value", "unit"].includes(key))
    ) {
      return "Each measurement must include a supported parameter, value, and unit.";
    }
    const metric = metricByParameter.get(measurement.parameter);
    if (!metric || seenParameters.has(metric.parameter)) {
      return "Measurements must use unique parameters supported by the health monitoring system.";
    }
    seenParameters.add(metric.parameter);
    if (measurement.unit !== metric.unit) {
      return `${metric.parameter} must use ${metric.unit}.`;
    }
    if (metric.parameter === "Blood Pressure") {
      if (typeof measurement.value !== "string" || !/^\d{1,3}\s*\/\s*\d{1,3}$/.test(measurement.value)) {
        return "Blood Pressure must be entered as systolic/diastolic mmHg.";
      }
    } else {
      const value = typeof measurement.value === "number"
        ? measurement.value
        : typeof measurement.value === "string" && /^\d+(?:\.\d+)?$/.test(measurement.value)
          ? Number(measurement.value)
          : NaN;
      if (!Number.isFinite(value) || value < 0 || value > 1_000_000) {
        return `${metric.parameter} must be a non-negative numeric value in ${metric.unit}.`;
      }
    }
  }

  for (const symptom of body.symptoms) {
    if (typeof symptom !== "string" || !symptom.trim() || symptom.trim().length > 120) {
      return "Each symptom must be a non-empty description of at most 120 characters.";
    }
  }
  return null;
}

router.get("/dashboard/overview", asyncRoute(async (_req, res) => {
  const model = await dataService.getData();
  sendData(res, {
    crew: model.crew,
    mission: model.mission,
    alerts: model.alerts,
    healthReadings: model.healthReadings,
    risks: model.riskOutlooks,
    trendInsights: model.trendInsights,
    persistentWarnings: model.persistentWarnings,
  }, { source: "shared demonstration dataset" });
}));

router.get("/dashboard/health-summary", asyncRoute(async (_req, res) => {
  const model = await dataService.getData();
  const activeAlerts = model.alerts.filter((alert) => alert.status !== "Resolved");
  const riskCounts = Object.fromEntries(["Low", "Medium", "High", "Critical"].map((risk) => [
    risk,
    model.riskOutlooks.filter((entry) => entry.id === risk).length,
  ]));
  sendData(res, {
    totalCrew: model.crew.length,
    riskCounts,
    criticalAlerts: activeAlerts.filter((alert) => alert.severity === "Critical").length,
    averageHealthScore: Math.round(model.crew.reduce((sum, member) => sum + member.score, 0) / model.crew.length),
  }, { source: "rule-based summary of demonstration data" });
}));

router.get("/dashboard/health-trends", asyncRoute(async (_req, res) => {
  const model = await dataService.getData();
  sendData(res, model.healthReadings, { source: "demonstration histories; sample timestamps unavailable" });
}));

router.get("/crew", asyncRoute(async (_req, res) => {
  const model = await dataService.getData();
  sendData(res, model.crew);
}));

router.get("/crew/:crewId", asyncRoute(async (req, res) => {
  const model = await dataService.getData();
  const member = getCrewMember(model, req.params.crewId);
  if (!member) return res.status(404).json({ error: { code: "CREW_NOT_FOUND", message: "Crew member was not found." } });
  sendData(res, member);
}));

router.get("/crew/:crewId/health", asyncRoute(async (req, res) => {
  const model = await dataService.getData();
  if (!getCrewMember(model, req.params.crewId)) {
    return res.status(404).json({ error: { code: "CREW_NOT_FOUND", message: "Crew member was not found." } });
  }
  sendData(res, model.healthReadings.filter((reading) => reading.crewId === req.params.crewId));
}));

router.get("/crew/:crewId/history", asyncRoute(async (req, res) => {
  const model = await dataService.getData();
  if (!getCrewMember(model, req.params.crewId)) {
    return res.status(404).json({ error: { code: "CREW_NOT_FOUND", message: "Crew member was not found." } });
  }
  sendData(res, model.alerts.filter((alert) => alert.astronautId === req.params.crewId));
}));

router.get("/health/metrics", asyncRoute(async (_req, res) => {
  sendData(res, dataService.metricDefinitions);
}));

router.get("/health/trends", asyncRoute(async (req, res) => {
  const model = await dataService.getData();
  let readings = model.healthReadings;
  if (req.query.crewId) {
    if (!getCrewMember(model, req.query.crewId)) {
      return res.status(400).json({ error: { code: "INVALID_CREW_ID", message: "crewId does not match a known crew member." } });
    }
    readings = readings.filter((reading) => reading.crewId === req.query.crewId);
  }
  if (req.query.parameter && !allowedParameters.has(req.query.parameter)) {
    return res.status(400).json({ error: { code: "INVALID_PARAMETER", message: "parameter does not match a supported health metric." } });
  }
  if (req.query.parameter) readings = readings.filter((reading) => reading.parameter === req.query.parameter);
  sendData(res, readings, { source: "demonstration histories; timestamps are only supplied for alert records" });
}));

router.get("/health/history", asyncRoute(async (_req, res) => {
  const model = await dataService.getData();
  sendData(res, model.alerts, { source: "demonstration alert history" });
}));

router.get("/health/records", asyncRoute(async (_req, res) => {
  sendData(res, await dataService.getHealthRecords(), {
    source: "crew-confirmed in-memory health records",
    durable: false,
  });
}));

router.post("/health/records", asyncRoute(async (req, res) => {
  const validationError = validateHealthRecord(req.body);
  if (validationError) {
    return res.status(400).json({
      error: { code: "INVALID_HEALTH_RECORD", message: validationError },
    });
  }
  if (!req.body.measurements.every((measurement) => allowedParameters.has(measurement.parameter))) {
    return res.status(400).json({
      error: { code: "INVALID_HEALTH_RECORD", message: "Only existing health parameters can be recorded." },
    });
  }

  const result = await dataService.createHealthRecord({
    astronautId: req.body.astronautId.trim(),
    requestId: req.body.requestId,
    measurements: req.body.measurements.map(({ parameter, value, unit }) => ({
      parameter,
      value: parameter === "Blood Pressure" ? value.trim().replace(/\s*\/\s*/, "/") : Number(value),
      unit,
    })),
    symptoms: req.body.symptoms.map((symptom) => symptom.trim()),
  });
  if (!result) {
    return res.status(400).json({
      error: { code: "INVALID_CREW_ID", message: "astronautId does not match a known crew member." },
    });
  }

  const model = await dataService.getData();
  const riskOutlook = model.riskOutlooks.find((risk) => risk.memberId === result.record.astronautId) || null;
  const alerts = model.alerts.filter((alert) => result.record.alertIds.includes(alert.id));
  res.status(result.created ? 201 : 200);
  return sendData(res, { ...result, riskOutlook, alerts }, {
    source: "crew-confirmed health report and existing rule-based risk engine",
    durable: false,
  });
}));

router.get("/health", asyncRoute(async (req, res) => {
  const model = await dataService.getData();
  let readings = model.healthReadings;
  if (req.query.crewId) {
    if (!getCrewMember(model, req.query.crewId)) {
      return res.status(400).json({ error: { code: "INVALID_CREW_ID", message: "crewId does not match a known crew member." } });
    }
    readings = readings.filter((reading) => reading.crewId === req.query.crewId);
  }
  if (req.query.parameter && !allowedParameters.has(req.query.parameter)) {
    return res.status(400).json({ error: { code: "INVALID_PARAMETER", message: "parameter does not match a supported health metric." } });
  }
  if (req.query.parameter) readings = readings.filter((reading) => reading.parameter === req.query.parameter);
  sendData(res, readings);
}));

router.get("/health/:crewId", asyncRoute(async (req, res) => {
  const model = await dataService.getData();
  if (!getCrewMember(model, req.params.crewId)) {
    return res.status(404).json({ error: { code: "CREW_NOT_FOUND", message: "Crew member was not found." } });
  }
  sendData(res, model.healthReadings.filter((reading) => reading.crewId === req.params.crewId));
}));

router.get("/alerts", asyncRoute(async (req, res) => {
  const model = await dataService.getData();
  for (const [key, values] of [["severity", alertSeverities], ["status", alertStatuses]]) {
    if (req.query[key] && !values.includes(req.query[key])) {
      return res.status(400).json({ error: { code: "INVALID_FILTER", message: `Unsupported ${key} filter.` } });
    }
  }
  if (req.query.crewId && !model.crew.some((member) => member.id === req.query.crewId)) {
    return res.status(400).json({ error: { code: "INVALID_CREW_ID", message: "crewId does not match a known crew member." } });
  }
  let alerts = model.alerts;
  if (req.query.severity) alerts = alerts.filter((alert) => alert.severity === req.query.severity);
  if (req.query.status) alerts = alerts.filter((alert) => alert.status === req.query.status);
  if (req.query.crewId) alerts = alerts.filter((alert) => alert.astronautId === req.query.crewId);
  sendData(res, alerts);
}));

router.get("/alerts/:alertId", asyncRoute(async (req, res) => {
  const model = await dataService.getData();
  const alert = model.alerts.find((record) => record.id === req.params.alertId);
  if (!alert) return res.status(404).json({ error: { code: "ALERT_NOT_FOUND", message: "Alert was not found." } });
  sendData(res, alert);
}));

router.patch("/alerts/:alertId", asyncRoute(async (req, res) => {
  const status = req.body?.status;
  if (!alertStatuses.includes(status)) {
    return res.status(400).json({ error: { code: "INVALID_STATUS", message: "A valid alert status is required." } });
  }
  const alert = await dataService.updateAlertStatus(req.params.alertId, status);
  if (!alert) return res.status(404).json({ error: { code: "ALERT_NOT_FOUND", message: "Alert was not found." } });
  sendData(res, alert);
}));

router.post("/alerts", asyncRoute(async (req, res) => {
  const { astronautId, parameter, value, unit, severity, history, message, recommendation } = req.body || {};
  if (
    typeof astronautId !== "string"
    || typeof parameter !== "string"
    || !parameter.trim()
    || value === null
    || value === ""
    || !Number.isFinite(Number(value))
    || typeof unit !== "string"
    || !alertSeverities.includes(severity)
  ) {
    return res.status(400).json({ error: { code: "INVALID_ALERT", message: "astronautId, parameter, numeric value, unit, and valid severity are required." } });
  }
  const newAlert = await dataService.createAlert({
    astronautId,
    parameter: parameter.trim(),
    value,
    unit,
    severity,
    history: Array.isArray(history) ? history.filter((entry) => Number.isFinite(Number(entry))).map(Number) : [],
    message: typeof message === "string" ? message : `A simulated ${parameter.trim().toLowerCase()} alert was generated.`,
    recommendation: typeof recommendation === "string" ? recommendation : "Verify the reading and follow the mission medical protocol.",
  });
  if (!newAlert) return res.status(400).json({ error: { code: "INVALID_CREW_ID", message: "astronautId does not match a known crew member." } });
  res.status(201);
  sendData(res, newAlert);
}));

router.post("/alerts/reset-demo", asyncRoute(async (_req, res) => {
  sendData(res, await dataService.resetAlerts(), { source: "restored shared demonstration dataset" });
}));

router.get("/risks", asyncRoute(async (_req, res) => {
  const model = await dataService.getData();
  sendData(res, model.riskOutlooks, { method: riskMethod });
}));

router.get("/risks/:crewId", asyncRoute(async (req, res) => {
  const model = await dataService.getData();
  if (!getCrewMember(model, req.params.crewId)) {
    return res.status(404).json({ error: { code: "CREW_NOT_FOUND", message: "Crew member was not found." } });
  }
  sendData(res, model.riskOutlooks.find((risk) => risk.memberId === req.params.crewId), { method: riskMethod });
}));

router.get("/mission/status", asyncRoute(async (_req, res) => {
  const model = await dataService.getData();
  sendData(res, model.mission);
}));

router.get("/mission", asyncRoute(async (_req, res) => {
  const model = await dataService.getData();
  sendData(res, model.mission);
}));

module.exports = router;
