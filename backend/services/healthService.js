const riskEngine = require("./riskEngine");
const csvService = require("./csvService");
const simulationService = require("./simulationService");

let sourceDataPromise;
let alertRecords;
let createdAlertSequence = 0;
let healthRecords = [];
let createdHealthRecordSequence = 0;
const generatedAlertStatuses = new Map();

const loadSourceData = async () => {
  if (!sourceDataPromise) {
    sourceDataPromise = Promise.resolve().then(() => {
      const { data, errors } = csvService.getAllCSVData();
      const csvCrew = data.crewInfo.map((row) => {
        const id = row["Astronaut id"]?.trim();
        const thresholds = data.riskThresholds.find((entry) => entry["Astronaut id"]?.trim() === id);
        return {
          id,
          name: row.Name?.trim() || "Name unavailable",
          role: "Role not listed in crew_info.csv",
          age: null,
          yearOfBirth: row.Year_of_birth?.trim() || null,
          sex: row.Sex?.trim() || null,
          yearOfMission: row.Year_of_mission?.trim() || null,
          missionTitle: row.Mission_title?.trim() || null,
          currentLocation: row["Current location"]?.trim() || null,
          lastCheckup: null,
          riskThresholds: thresholds || null,
          profileSource: "CSV crew_info.csv",
          simulated: false,
        };
      }).filter((member) => member.id);
      const configuredCrewTarget = Number(process.env.ASTRA_DEMO_CREW_COUNT);
      const demoCrewTarget = Number.isInteger(configuredCrewTarget) && configuredCrewTarget >= 1
        && configuredCrewTarget <= 100
        ? configuredCrewTarget
        : 17;
      const crew = simulationService.getDemoCrew(csvCrew, Math.max(csvCrew.length, demoCrewTarget));
      const healthData = normalizeHealthReadings(data.healthReadings, crew);
      const environmentBenchmarks = {
        Earth: normalizeBenchmarks(data.nasaEarth, "Earth"),
        ISS: normalizeBenchmarks(data.nasaISS, "ISS"),
        Moon: normalizeBenchmarks(data.nasaLunar, "Moon"),
      };
      const simulatedRecords = simulationService.generateDemoReadings(
        crew,
        metricDefinitions,
        healthData.records,
        environmentBenchmarks
      );
      if (simulatedRecords.length > 0) {
        console.warn(
          `[ASTRA demo data] Added ${simulatedRecords.length} clearly labeled simulated health sample sets; `
          + `${healthData.records.length} valid CSV health sample sets were available.`
        );
      }
      const mergedHealthData = {
        ...healthData,
        records: [...healthData.records, ...simulatedRecords].sort((first, second) =>
          (Date.parse(first.timestamp) || 0) - (Date.parse(second.timestamp) || 0)
        ),
        csvRows: healthData.records.length,
        simulatedRows: simulatedRecords.length,
      };
      const datasetStatus = csvService.checkCSVFiles().map((status) => ({
        ...status,
        records: data[status.dataset]?.length ?? 0,
      }));
      const hasCsvCrew = csvCrew.length > 0;
      const hasCsvReadings = healthData.records.length > 0;
      const hasSimulatedData = simulatedRecords.length > 0 || crew.some((member) => member.simulated);
      const dataMode = hasSimulatedData
        ? hasCsvCrew || hasCsvReadings ? "MIXED DATA" : "SIMULATED DEMO DATA"
        : "REAL CSV DATA";

      return {
        crew,
        healthData: mergedHealthData,
        riskThresholds: data.riskThresholds,
        environmentBenchmarks,
        datasetStatus,
        datasetErrors: errors,
        dataMode,
        simulatedRecords,
      };
    });
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
  { id: "bone-density", parameter: "Bone Density", unit: "T-score", range: null },
  { id: "mood", parameter: "Mood", unit: "score (unit not specified)", range: null },
  { id: "daily-calorie-intake", parameter: "Daily Calorie Intake", unit: "kcal/day", range: null },
  { id: "muscular-endurance", parameter: "Muscular Endurance Score", unit: "kg", range: null },
  { id: "cognitive-reaction-time", parameter: "Cognitive Reaction Time", unit: "ms", range: null },
  { id: "hydration-status", parameter: "Hydration Status", unit: "unit not specified", range: null },
  { id: "heart-rate-variability", parameter: "Heart Rate Variability", unit: "unit not specified", range: null },
  { id: "cumulative-radiation-dose", parameter: "Cumulative Radiation Dose", unit: "mSv per 6 months", range: null },
];

const csvMeasurementFields = [
  { parameter: "Oxygen Saturation", column: "SpO2(percent)", unit: "%" },
  { parameter: "Bone Density", column: "Bone density(T score)", unit: "T-score" },
  { parameter: "Heart Rate", column: "Heart Rate(bpm)", unit: "BPM" },
  { parameter: "Body Temperature", column: "Body Temperature(degree celsius)", unit: "°C" },
  { parameter: "Sleep Duration", column: "Daily Sleep Hours(hours)", unit: "hours" },
  { parameter: "Mood", column: "Mood", unit: "score (unit not specified)" },
  { parameter: "Daily Calorie Intake", column: "Daily Calorie Intake( kcal per day)", unit: "kcal/day" },
  { parameter: "Muscular Endurance Score", column: "Muscular Endurance Score( in kg)", unit: "kg" },
  { parameter: "Cognitive Reaction Time", column: "Cognitive Reaction time(ms)", unit: "ms" },
  { parameter: "Hydration Status", column: "Hydration Status", unit: "unit not specified" },
  { parameter: "Heart Rate Variability", column: "Heart Rate Variability (HRV)", unit: "unit not specified" },
  { parameter: "Cumulative Radiation Dose", column: "Cumulative Radiation Dose(mSv per 6 months)", unit: "mSv per 6 months" },
];

const numericValue = (value) => {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim().replace(/,/g, "");
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
};

const textValue = (value) => typeof value === "string"
  ? value.trim()
  : typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : "";

const normalizeHealthReadings = (rows, crew) => {
  const knownCrewIds = new Set(crew.map((member) => member.id));
  const records = [];
  let skippedRows = 0;
  let invalidTimestamps = 0;

  for (const [index, row] of rows.entries()) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      skippedRows += 1;
      continue;
    }
    const astronautId = textValue(row["Astronaut id"]);
    if (!astronautId || !knownCrewIds.has(astronautId)) {
      skippedRows += 1;
      continue;
    }

    const measurements = [];
    const systolic = numericValue(row["Systolic blood pressure(mm Hg)"]);
    const diastolic = numericValue(row["Diastolic blood pressure(mm Hg)"]);
    if (systolic !== null && diastolic !== null) {
      measurements.push({
        parameter: "Blood Pressure",
        value: `${systolic}/${diastolic}`,
        unit: "mmHg",
      });
    }
    for (const field of csvMeasurementFields) {
      const rawValue = textValue(row[field.column]);
      const value = field.parameter === "Mood" && rawValue ? rawValue : numericValue(rawValue);
      if (value !== null) measurements.push({ parameter: field.parameter, value, unit: field.unit });
    }
    if (!measurements.length) {
      skippedRows += 1;
      continue;
    }

    const timestamp = textValue(row.Timestamp) || null;
    const validTimestamp = timestamp && Number.isFinite(Date.parse(timestamp));
    if (timestamp && !validTimestamp) invalidTimestamps += 1;
    records.push({
      astronautId,
      timestamp: validTimestamp ? timestamp : null,
      sourceIndex: index,
      source: "CSV health_readings.csv",
      measurements,
    });
  }

  records.sort((first, second) =>
    (Date.parse(first.timestamp) || 0) - (Date.parse(second.timestamp) || 0)
    || first.sourceIndex - second.sourceIndex
  );
  return { records, skippedRows, invalidTimestamps };
};

const numericBenchmark = (value) => numericValue(value);

const normalizeBenchmarks = (rows, location) => rows.map((row) => {
  const lowerKey = ["Lower limit for normal range", "Limit for lower range"]
    .find((key) => Object.hasOwn(row, key));
  const upperKey = ["Higher limit for normal range", "Limit for higher range"]
    .find((key) => Object.hasOwn(row, key));
  const lowerDeviationKey = ["Deviation permissible lower limit", "Deviations permissible lower"]
    .find((key) => Object.hasOwn(row, key));
  const upperDeviationKey = ["Deviation permissible upper limit", "Deviation permissible higher"]
    .find((key) => Object.hasOwn(row, key));
  return {
    location,
    parameter: row.Benchmarks?.trim() || "Unknown parameter",
    lowerLimit: lowerKey ? numericBenchmark(row[lowerKey]) : null,
    upperLimit: upperKey ? numericBenchmark(row[upperKey]) : null,
    permissibleLowerDeviation: lowerDeviationKey ? numericBenchmark(row[lowerDeviationKey]) : null,
    permissibleUpperDeviation: upperDeviationKey ? numericBenchmark(row[upperDeviationKey]) : null,
    reasonsForLowerDeviation: row["Reasons for lower deviation"]?.trim() || null,
    reasonsForHigherDeviation: row["Reasons for higher deviation"]?.trim() || null,
    countermeasuresForLowerDeviation: row["Countermeasures for lower deviation"]?.trim() || null,
    countermeasuresForHigherDeviation: row["Countermeasures for higher deviation"]?.trim() || null,
  };
});

const makeMemberReadings = (member, alerts, healthData, environmentBenchmarks) => {
  const readings = {};
  const memberRecords = healthData.records.filter((record) => record.astronautId === member.id);
  const environment = environmentBenchmarks[member.currentLocation];
  for (const metric of metricDefinitions) {
    const alert = alerts.find((record) => record.parameter === metric.parameter);
    const historyRecords = memberRecords.flatMap((record) =>
      record.measurements
        .filter((measurement) => measurement.parameter === metric.parameter)
        .map((measurement) => ({
          ...measurement,
          timestamp: record.timestamp,
          source: record.source,
          simulated: Boolean(record.simulated),
        }))
    );
    const latest = historyRecords.at(-1);
    const referenceBounds = [...historyRecords].reverse().find((record) => record.referenceBounds)?.referenceBounds
      || simulationService.findBenchmarkBounds(metric.parameter, environment);
    const reading = {
      value: latest?.value ?? null,
      unit: latest?.unit || metric.unit,
      history: historyRecords.map((record) => record.value),
      historyTimestamps: historyRecords.map((record) => record.timestamp),
      timestamp: latest?.timestamp || null,
      source: latest?.source || "No health reading supplied",
      simulated: latest?.simulated || false,
      alert: alert || null,
      referenceRange: null,
      referenceBounds,
      status: latest ? (alert?.severity || "Available") : "Unavailable",
    };
    readings[metric.id] = reading;
    readings[metric.parameter] = reading;
  }

  const benchmarkNames = {
    "Blood Pressure": ["Systolic blood pressure", "Diastolic blood pressure"],
    "Oxygen Saturation": ["SpO2(percent)"],
    "Bone Density": ["Bone density(T score)"],
    "Heart Rate": ["Heart Rate(bpm)"],
    "Body Temperature": ["Body Temperature(degree celsius)"],
    "Sleep Duration": ["Daily Sleep Hours(hours)"],
    "Mood": ["Mood"],
    "Daily Calorie Intake": ["Daily Calorie Intake"],
    "Muscular Endurance Score": ["Muscular Endurance Score"],
    "Cognitive Reaction Time": ["Cognitive Reaction time"],
    "Hydration Status": ["Hydration Status"],
    "Heart Rate Variability": ["Heart Rate Variability"],
    "Cumulative Radiation Dose": ["Cumulative Radiation Dose"],
  };
  for (const metric of metricDefinitions) {
    const reading = readings[metric.id];
    if (!reading) continue;
    const matches = environment?.filter((entry) =>
      (benchmarkNames[metric.parameter] || []).some((name) => entry.parameter.startsWith(name))
    ) || [];
    if (matches.length) {
      reading.referenceRange = matches.map((entry) =>
        entry.lowerLimit !== null && entry.upperLimit !== null
          ? `${entry.parameter}: ${entry.lowerLimit}–${entry.upperLimit}`
          : null
      ).filter(Boolean).join("; ") || null;
    } else {
      reading.referenceRange = metric.range || null;
    }
  }
  return readings;
};

const summarizeReadings = (readings) => {
  const groups = new Map();
  const add = (parameter, unit, value) => {
    const key = `${parameter}\u0000${unit}`;
    const group = groups.get(key) || { parameter, unit, values: [] };
    group.values.push(value);
    groups.set(key, group);
  };
  for (const reading of readings) {
    if (reading.parameter === "Blood Pressure" && typeof reading.value === "string") {
      const [systolic, diastolic] = reading.value.split("/").map(numericValue);
      if (systolic !== null) add("Systolic blood pressure", "mmHg", systolic);
      if (diastolic !== null) add("Diastolic blood pressure", "mmHg", diastolic);
    } else if (typeof reading.value === "number" && Number.isFinite(reading.value)) {
      add(reading.parameter, reading.unit, reading.value);
    }
  }
  return [...groups.values()].map(({ parameter, unit, values }) => ({
    parameter,
    unit,
    count: values.length,
    average: values.reduce((sum, value) => sum + value, 0) / values.length,
    minimum: Math.min(...values),
    maximum: Math.max(...values),
  }));
};

const buildModel = async () => {
  const source = await loadSourceData();
  if (!alertRecords) alertRecords = [];
  const crew = source.crew.map((sourceMember) => {
    const alerts = alertRecords.filter((alert) => alert.astronautId === sourceMember.id);
    const readings = makeMemberReadings(sourceMember, alerts, source.healthData, source.environmentBenchmarks);
    return { ...clone(sourceMember), alerts, readings };
  });
  const analysis = riskEngine.analyzeCrew(crew, metricDefinitions);
  const { trendInsights, warnings } = analysis;
  const riskOutlooks = analysis.riskOutlooks.map((outlook) => {
    const member = crew.find((entry) => entry.id === outlook.memberId);
    const hasAssessmentData = outlook.sampleCount > 0
      || member.alerts.some((alert) => alert.status !== "Resolved");
    const hasSimulatedReading = Object.values(member.readings).some((reading) => reading.simulated);
    return hasAssessmentData ? { ...outlook, simulated: hasSimulatedReading } : {
      ...outlook,
      id: "Unknown",
      label: "Not assessed",
      className: "unknown",
      score: null,
      simulated: hasSimulatedReading,
      explanation: ["Health readings are unavailable; risk cannot be assessed."],
      actions: [],
      method: "Not assessed because no health readings or active alerts are available.",
    };
  });
  const riskByMember = Object.fromEntries(riskOutlooks.map((risk) => [risk.memberId, risk]));
  const warningsByAlert = new Map(warnings.filter((warning) => warning.alertId).map((warning) => [warning.alertId, warning]));
  const alerts = alertRecords.map((alert) => ({
    ...alert,
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
      message: `${warning.parameter} has been outside the configured band for ${warning.sampleCount} consecutive samples.`,
      recommendation: warning.action,
      referenceRange: warning.referenceRange,
      timestamp: warning.timestamp,
      history: [],
      source: warning.source,
      simulated: warning.simulated,
      persistentWarning: warning,
    };
  });
  const augmentedAlerts = [...alerts, ...warningsWithoutAlert];
  const alertsByMember = new Map(crew.map((member) => [
    member.id,
    [...member.alerts, ...warningsWithoutAlert.filter((warning) => warning.astronautId === member.id)],
  ]));

  return {
    crew: crew.map((member) => {
      const riskOutlook = riskByMember[member.id];
      const memberAlertRecords = alertsByMember.get(member.id) || member.alerts;
      const activeAlerts = memberAlertRecords.filter((alert) => alert.status !== "Resolved");
      const severityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
      const risk = activeAlerts.reduce((mostSevere, alert) =>
        (severityOrder[alert.severity] ?? 4) < (severityOrder[mostSevere] ?? 4)
          ? alert.severity
          : mostSevere, riskOutlook.id);
      const score = riskOutlook.score === null ? null : Math.max(0, 100 - riskOutlook.score);
      return {
        ...member,
        alerts: memberAlertRecords,
        risk,
        score,
        scoreSource: riskOutlook.simulated
          ? "Rule-based demonstration score; not a medical assessment."
          : "Rule-based score from available records.",
      };
    }),
    mission: source.dataMode === "REAL CSV DATA"
      ? null
      : simulationService.getMissionMetadata(),
    healthRecords: clone(healthRecords),
    alerts: augmentedAlerts,
    healthReadings: source.healthData.records.flatMap((record) => {
      const member = crew.find((entry) => entry.id === record.astronautId);
      return record.measurements.map((measurement) => ({
        crewId: member.id,
        astronautName: member.name,
        parameter: measurement.parameter,
        value: measurement.value,
        unit: measurement.unit,
        history: member.readings[measurement.parameter].history,
        historyTimestamps: member.readings[measurement.parameter].historyTimestamps,
        timestamp: record.timestamp,
        source: record.source,
        simulated: Boolean(record.simulated),
        status: "Available",
        severity: "Unassessed",
        message: "No risk classification was supplied with this measurement.",
        recommendation: null,
        referenceRange: member.readings[measurement.parameter].referenceRange,
        referenceBounds: measurement.referenceBounds || member.readings[measurement.parameter].referenceBounds,
      }));
    }),
    riskOutlooks,
    trendInsights,
    persistentWarnings: warnings,
    statistics: summarizeReadings(source.healthData.records.flatMap((record) => {
      const member = source.crew.find((entry) => entry.id === record.astronautId);
      return record.measurements.map((measurement) => ({
        ...measurement,
        crewId: record.astronautId,
        astronautName: member.name,
        timestamp: record.timestamp,
      }));
    })),
    environmentBenchmarks: clone(source.environmentBenchmarks),
    riskThresholds: clone(source.riskThresholds),
    datasetStatus: clone(source.datasetStatus),
    datasetErrors: clone(source.datasetErrors),
    healthDataQuality: {
      rows: source.healthData.csvRows + source.healthData.simulatedRows,
      csvRows: source.healthData.csvRows,
      simulatedRows: source.healthData.simulatedRows,
      skippedRows: source.healthData.skippedRows,
      invalidTimestamps: source.healthData.invalidTimestamps,
    },
    dataMode: source.dataMode,
    dataSource: source.dataMode,
    simulation: {
      enabled: source.healthData.simulatedRows > 0,
      source: source.healthData.simulatedRows > 0 ? "SIMULATED DEMO DATA" : null,
      readingCount: source.healthData.simulatedRows,
      notice: "Generated readings are demonstrations only; they are not actual astronaut measurements or medical assessments.",
    },
  };
};

const getData = async () => {
  const model = await buildModel();
  return clone(model);
};

const updateAlertStatus = async (id, status) => {
  const source = await loadSourceData();
  if (!alertRecords) alertRecords = [];
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
  if (!alertRecords) alertRecords = [];
  const member = source.crew.find((crewMember) => crewMember.id === input.astronautId);
  if (!member) return null;
  const alert = {
    ...input,
    id: `ALT-${Date.now()}-${++createdAlertSequence}`,
    astronautName: member.name,
    status: "New",
    source: input.source || "Crew health alert",
    timestamp: new Date().toISOString(),
  };
  alertRecords.unshift(alert);
  return clone(alert);
};

const createHealthRecord = async (input) => {
  const source = await loadSourceData();
  if (!alertRecords) alertRecords = [];
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
  await loadSourceData();
  alertRecords = [];
  generatedAlertStatuses.clear();
  return clone(alertRecords);
};

module.exports = {
  getData,
  normalizeHealthReadings,
  normalizeBenchmarks,
  updateAlertStatus,
  createAlert,
  createHealthRecord,
  getHealthRecords: async () => clone(healthRecords),
  resetAlerts,
  metricDefinitions,
};
