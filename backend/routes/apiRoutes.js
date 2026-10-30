const express = require("express");
const dataService = require("../services/healthService");

const router = express.Router();
const alertStatuses = ["New", "Acknowledged", "Under Assessment", "Resolved"];
const alertSeverities = ["Critical", "High", "Medium", "Low"];
const allowedParameters = new Set(dataService.metricDefinitions.map((metric) => metric.parameter));
const riskMethod = "Rule-based trend and unresolved-alert heuristic; not a trained AI model.";
const sendData = (res, data, meta = {}) => res.json({ data, meta: { simulated: true, ...meta } });

const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

const getCrewMember = (model, crewId) => model.crew.find((member) => member.id === crewId);

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
