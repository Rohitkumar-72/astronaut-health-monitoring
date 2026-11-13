const riskEngine = require("./riskEngine");

let sourceDataPromise;
let alertRecords;
let createdAlertSequence = 0;
let healthRecords = [];
let createdHealthRecordSequence = 0;
const generatedAlertStatuses = new Map();

const loadSourceData = async () => {
  if (!sourceDataPromise) {
    sourceDataPromise = Promise.all([
      import("../../shared/demoHealthData.mjs"),
      import("../../shared/crewOverviewDemoData.mjs"),
    ]).then(([health, crew]) => ({
      alerts: health.demoHealthData,
      crew: crew.demoCrew,
      mission: crew.demoMission,
    }));
  }

  return sourceDataPromise;
};

const clone = (value) => JSON.parse(JSON.stringify(value));

const metricDefinitions = [
  { id: "heart-rate", parameter: "Heart Rate", unit: "BPM", range: "60–100 BPM" },
  { id: "blood-pressure", parameter: "Blood Pressure", unit: "mmHg", range: "<130/80 mmHg" },
  { id: "oxygen-saturation", parameter: "Oxygen Saturation", unit: "%", range: "≥95%" },
  { id: "body-temperature", parameter: "Body Temperature", unit: "°C", range: "36.1–37.5 °C" },
  { id: "respiratory-rate", parameter: "Respiratory Rate", unit: "breaths/min", range: "12–20 /min" },
  { id: "sleep-duration", parameter: "Sleep Duration", unit: "hours", range: "7–9 hours" },
  { id: "stress-indicator", parameter: "Stress Indicator", unit: "%", range: "<60% demo band" },
  { id: "physical-activity", parameter: "Physical Activity", unit: "%", range: "≥40% demo target" },
];

const getReadingStatus = (metric, reading) => {
  const alertSeverity = reading.alert?.severity;
  if (alertSeverity) return alertSeverity;
  const value = Number(reading.value);

  switch (metric.id) {
    case "heart-rate":
      return value < 60 || value > 100 ? "Moderate" : "Healthy";
    case "blood-pressure": {
      const [systolic, diastolic] = String(reading.value).split("/").map(Number);
      return systolic >= 130 || diastolic >= 80 || systolic < 90 ? "Moderate" : "Healthy";
    }
    case "oxygen-saturation":
      return value < 95 ? "High" : "Healthy";
    case "body-temperature":
      return value < 36.1 || value > 37.5 ? "High" : "Healthy";
    case "respiratory-rate":
      return value < 12 || value > 20 ? "Moderate" : "Healthy";
    case "sleep-duration":
      return value < 5 ? "High" : value < 7 || value > 9 ? "Moderate" : "Healthy";
    case "stress-indicator":
      return value >= 75 ? "High" : value >= 60 ? "Moderate" : "Healthy";
    case "physical-activity":
      return value < 25 ? "High" : value < 40 ? "Moderate" : "Healthy";
    default:
      return "Unknown";
  }
};

const makeMemberReadings = (member, alerts) => {
  const readings = {};
  for (const metric of metricDefinitions) {
    const source = member.metrics[metric.parameter];
    const alert = alerts.find((record) => record.parameter === metric.parameter);
    const reading = {
      value: alert?.value ?? source?.value,
      unit: alert?.unit || source?.unit || metric.unit,
      history: alert?.history || source?.history || [],
      timestamp: alert?.timestamp || null,
      source: alert ? "Historical demonstration alert" : "Simulated demonstration snapshot",
      alert: alert || null,
      referenceRange: metric.range,
    };
    reading.status = getReadingStatus(metric, reading);
    readings[metric.id] = reading;
    readings[metric.parameter] = reading;
  }
  return readings;
};

const buildModel = async () => {
  const source = await loadSourceData();
  if (!alertRecords) alertRecords = clone(source.alerts);
  const crew = source.crew.map((sourceMember) => {
    const alerts = alertRecords.filter((alert) => alert.astronautId === sourceMember.id);
    const readings = makeMemberReadings(sourceMember, alerts);
    return { ...clone(sourceMember), alerts, readings };
  });
  const analysis = riskEngine.analyzeCrew(crew, metricDefinitions);
  const { riskOutlooks, trendInsights, warnings } = analysis;
  const riskByMember = Object.fromEntries(riskOutlooks.map((risk) => [risk.memberId, risk]));
  const warningsByAlert = new Map(warnings.filter((warning) => warning.alertId).map((warning) => [warning.alertId, warning]));
  const alerts = alertRecords.map((alert) => ({
    ...alert,
    source: "Simulated demonstration alert record",
    persistentWarning: warningsByAlert.get(alert.id) || null,
  }));
  const warningsWithoutAlert = warnings.filter((warning) => !warning.alertId).map((warning) => {
    const id = `EW-${warning.memberId}-${warning.id.split(":").at(-1)}`;
    return {
      id,
      astronautId: warning.memberId,
      astronautName: warning.name,
      parameter: warning.parameter,
      value: warning.value,
      unit: warning.unit,
      severity: warning.severity,
      status: generatedAlertStatuses.get(id)?.status || "New",
      message: `${warning.parameter} has been outside its illustrative demo band for ${warning.sampleCount} consecutive samples.`,
      recommendation: warning.action,
      timestamp: warning.timestamp,
      history: [],
      source: warning.source,
      persistentWarning: warning,
    };
  });
  const augmentedAlerts = [...alerts, ...warningsWithoutAlert];

  return {
    crew: crew.map((member) => {
      const riskOutlook = riskByMember[member.id];
      const activeAlerts = member.alerts.filter((alert) => alert.status !== "Resolved");
      const penalties = { Critical: 35, High: 20, Medium: 10, Low: 3 };
      return {
        ...member,
        risk: member.alerts.filter((alert) => alert.status !== "Resolved").reduce((mostSevere, alert) => {
          const severityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
          return (severityOrder[alert.severity] ?? 4) < (severityOrder[mostSevere] ?? 4)
            ? alert.severity
            : mostSevere;
        }, "Low"),
        score: Math.max(20, 100 - activeAlerts.reduce((sum, alert) => sum + (penalties[alert.severity] || 0), 0)),
      };
    }),
    mission: clone(source.mission),
    healthRecords: clone(healthRecords),
    alerts: augmentedAlerts,
    healthReadings: crew.flatMap((member) => metricDefinitions.map((metric) => {
      const reading = member.readings[metric.id];
      return {
        crewId: member.id,
        astronautName: member.name,
        parameter: metric.parameter,
        value: reading.value,
        unit: reading.unit,
        history: reading.history,
        timestamp: reading.timestamp,
        source: reading.source,
        status: reading.status,
        severity: reading.alert?.severity || reading.status,
        message: reading.alert?.message || `${metric.parameter} demonstration snapshot.`,
        recommendation: reading.alert?.recommendation || "Review this demonstration sample; no live sensor feed is connected.",
        referenceRange: metric.range,
      };
    })),
    riskOutlooks,
    trendInsights,
    persistentWarnings: warnings,
  };
};

const getData = async () => {
  const model = await buildModel();
  return clone(model);
};

const updateAlertStatus = async (id, status) => {
  const source = await loadSourceData();
  if (!alertRecords) alertRecords = clone(source.alerts);
  const alert = alertRecords.find((record) => record.id === id);
  if (!alert) {
    const generated = (await getData()).alerts.find((record) => record.id === id);
    if (!generated) return null;
    const updated = { ...generated, status, updatedAt: new Date().toISOString() };
    generatedAlertStatuses.set(id, updated);
    return clone(updated);
  }
  alert.status = status;
  alert.updatedAt = new Date().toISOString();
  return clone(alert);
};

const createAlert = async (input) => {
  const source = await loadSourceData();
  if (!alertRecords) alertRecords = clone(source.alerts);
  const member = source.crew.find((crewMember) => crewMember.id === input.astronautId);
  if (!member) return null;
  const alert = {
    ...input,
    id: `ALT-${Date.now()}-${++createdAlertSequence}`,
    astronautName: member.name,
    status: "New",
    source: input.source || "Simulated alert created by user",
    timestamp: new Date().toISOString(),
  };
  alertRecords.unshift(alert);
  return clone(alert);
};

const createHealthRecord = async (input) => {
  const source = await loadSourceData();
  if (!alertRecords) alertRecords = clone(source.alerts);
  const member = source.crew.find((crewMember) => crewMember.id === input.astronautId);
  if (!member) return null;

  const existing = healthRecords.find((record) =>
    record.astronautId === input.astronautId && record.requestId === input.requestId
  );
  if (existing) return { record: clone(existing), created: false };

  const recordId = `HR-${Date.now()}-${++createdHealthRecordSequence}`;
  const assessments = input.measurements.map((measurement) => ({
    parameter: measurement.parameter,
    ...riskEngine.assessConfirmedReading(measurement.parameter, measurement.value),
  }));
  const record = {
    id: recordId,
    requestId: input.requestId,
    astronautId: member.id,
    astronautName: member.name,
    measurements: clone(input.measurements),
    symptoms: clone(input.symptoms),
    timestamp: new Date().toISOString(),
    source: "Crew-confirmed self-report",
    assessment: assessments,
    alertIds: [],
  };
  healthRecords.unshift(record);

  for (const [index, assessment] of assessments.entries()) {
    if (!assessment.severity) continue;
    const measurement = input.measurements[index];
    const duplicateAlert = alertRecords.find((alert) =>
      alert.astronautId === member.id
      && alert.parameter === measurement.parameter
      && String(alert.value) === String(measurement.value)
      && alert.unit === measurement.unit
      && alert.status !== "Resolved"
    );
    if (duplicateAlert) {
      record.alertIds.push(duplicateAlert.id);
      continue;
    }

    const alert = {
      astronautId: member.id,
      parameter: measurement.parameter,
      value: measurement.value,
      unit: measurement.unit,
      severity: assessment.severity,
      history: [],
      message: `Crew-confirmed ${measurement.parameter.toLowerCase()} is outside the configured demonstration band.`,
      recommendation: assessment.action,
      sourceRecordId: record.id,
      source: "Confirmed crew health record",
    };
    const created = await createAlert(alert);
    record.alertIds.push(created.id);
  }

  return { record: clone(record), created: true };
};

const resetAlerts = async () => {
  const source = await loadSourceData();
  alertRecords = clone(source.alerts);
  generatedAlertStatuses.clear();
  return clone(alertRecords);
};

module.exports = {
  getData,
  updateAlertStatus,
  createAlert,
  createHealthRecord,
  getHealthRecords: async () => clone(healthRecords),
  resetAlerts,
  metricDefinitions,
};
