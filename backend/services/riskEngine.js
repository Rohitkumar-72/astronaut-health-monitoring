const trendRules = [
  ["heart-rate", "Heart rate", "up", 8, 0.45, 25],
  ["oxygen-saturation", "SpO₂", "down", 2, 3, 25],
  ["body-temperature", "Body temperature", "up", 0.4, 12, 20],
  ["sleep-duration", "Sleep duration", "down", 0.5, 8, 18],
  ["stress-indicator", "Stress indicator", "up", 10, 0.35, 18],
  ["physical-activity", "Physical activity", "down", 15, 0.25, 14],
];

const alertScore = { Critical: 18, High: 12, Medium: 6, Low: 2 };

const getRiskBand = (score) => {
  if (score >= 70) return { id: "Critical", label: "Critical attention", className: "critical" };
  if (score >= 45) return { id: "High", label: "High attention", className: "high" };
  if (score >= 20) return { id: "Medium", label: "Moderate attention", className: "moderate" };
  return { id: "Low", label: "Lower projected attention", className: "low" };
};

const makeRiskOutlook = (member, metricDefinitions, generatedWarnings = []) => {
  const drivers = [];
  let score = 0;
  let sampleCount = 0;

  for (const [metricId, label, direction, deadband, pointsPerUnit, maximum] of trendRules) {
    const reading = member.readings[metricId];
    const history = reading.history.map(Number).filter(Number.isFinite);
    if (history.length < 3) continue;
    sampleCount += history.length;
    const change = history.at(-1) - history[0];
    const alignedChange = direction === "up" ? change : -change;
    if (alignedChange <= deadband) continue;
    const points = Math.min(maximum, Math.round((alignedChange - deadband) * pointsPerUnit));
    if (points <= 0) continue;
    score += points;
    drivers.push({
      metricId,
      label,
      change,
      unit: reading.unit,
      samples: history.length,
      points,
      action: `Review the ${label.toLowerCase()} trend with the crew medical officer and verify the source readings.`,
    });
  }

  for (const metric of metricDefinitions) {
    const reading = member.readings[metric.id];
    if (!reading || reading.value === null || reading.value === undefined
      || !outsideDemoBand(metric.id, reading.value, reading.referenceBounds)) continue;
    score += 22;
    drivers.push({
      metricId: metric.id,
      label: `${metric.parameter} is outside its configured demonstration reference range`,
      points: 22,
      action: "Verify the source value and consult established mission protocols; this demonstration flag is not a medical assessment.",
    });
  }

  const activeAlerts = [
    ...member.alerts.filter((alert) => alert.status !== "Resolved"),
    ...generatedWarnings,
  ];
  const alertContribution = Math.min(
    32,
    activeAlerts.reduce((total, alert) => total + (alertScore[alert.severity] || 0), 0)
  );
  score = Math.min(100, score + alertContribution);
  const alertRiskFloor = activeAlerts.reduce((floor, alert) => Math.max(
    floor,
    { Critical: 70, High: 45, Medium: 20, Low: 0 }[alert.severity] || 0
  ), 0);
  score = Math.max(score, alertRiskFloor);
  for (const alert of activeAlerts) {
    drivers.push({
      metricId: alert.parameter,
      label: `${alert.parameter} has an unresolved ${String(alert.severity || "unclassified").toLowerCase()} demo alert`,
      points: alertScore[alert.severity] || 0,
      action: alert.recommendation || "Review this record with the crew medical officer using mission protocol.",
    });
  }

  drivers.sort((first, second) => second.points - first.points);
  const topDrivers = drivers.slice(0, 3);
  const band = getRiskBand(score);
  return {
    memberId: member.id,
    score,
    ...band,
    drivers: topDrivers,
    explanation: topDrivers.length
      ? topDrivers.map((driver) =>
        typeof driver.change === "number"
          ? `${driver.label} changed by ${Math.round(Math.abs(driver.change) * 10) / 10} ${driver.unit} over ${driver.samples} samples`
          : driver.label
      )
      : ["No substantial adverse trend or unresolved alert was identified in the available demo samples."],
    actions: [...new Set(topDrivers.map((driver) => driver.action))].slice(0, 3),
    sampleCount,
    activeAlertCount: activeAlerts.length,
    method: "Rule-based trend and unresolved-alert heuristic; not a trained AI model.",
  };
};

const makeTrendInsights = (crew) => {
  const candidates = [
    { id: "sleep-decline", metricId: "sleep-duration", label: "Sleep duration", unit: "hours", direction: "down", threshold: 0.5 },
    { id: "stress-increase", metricId: "stress-indicator", label: "Stress indicator", unit: "%", direction: "up", threshold: 8 },
    { id: "heart-rate-shifts", metricId: "heart-rate", label: "Heart rate", unit: "BPM", direction: "either", threshold: 10 },
  ];

  return candidates.flatMap((candidate) => {
    const changes = crew.flatMap((member) => {
      const history = member.readings[candidate.metricId].history.map(Number).filter(Number.isFinite);
      if (history.length < 3) return [];
      const change = history.at(-1) - history[0];
      const meetsThreshold = candidate.direction === "down"
        ? change <= -candidate.threshold
        : candidate.direction === "up"
          ? change >= candidate.threshold
          : Math.abs(change) >= candidate.threshold;
      return meetsThreshold ? [{ name: member.name, change }] : [];
    });
    if (changes.length < 2) return [];
    return [{
      id: candidate.id,
      label: candidate.label,
      headline: candidate.id === "sleep-decline"
        ? "Several crew members show declining sleep duration"
        : candidate.id === "stress-increase"
          ? "Stress indicators are increasing across part of the crew"
          : "Notable heart-rate shifts appear in multiple crew histories",
      count: changes.length,
      total: crew.length,
      details: changes.map(({ name, change }) => `${name} ${change > 0 ? "up" : "down"} ${Math.round(Math.abs(change) * 10) / 10} ${candidate.unit}`),
      summary: candidate.direction === "either"
        ? `${changes.length} of ${crew.length} show notable shifts; directions differ, so this is not a shared directional trend.`
        : `${changes.length} of ${crew.length} demo crew histories show this direction of change.`,
      caveat: "Exploratory comparison of supplied sample sequences; timestamps are unavailable and this does not establish a clinical correlation or cause.",
    }];
  });
};

const outsideDemoBand = (metricId, value, referenceBounds) => {
  if (metricId === "blood-pressure" && referenceBounds?.systolic && referenceBounds?.diastolic) {
    const [systolic, diastolic] = String(value).split("/").map(Number);
    return (Number.isFinite(referenceBounds.systolic.lowerLimit)
        && systolic < referenceBounds.systolic.lowerLimit)
      || (Number.isFinite(referenceBounds.systolic.upperLimit)
        && systolic > referenceBounds.systolic.upperLimit)
      || (Number.isFinite(referenceBounds.diastolic.lowerLimit)
        && diastolic < referenceBounds.diastolic.lowerLimit)
      || (Number.isFinite(referenceBounds.diastolic.upperLimit)
        && diastolic > referenceBounds.diastolic.upperLimit);
  }
  if (referenceBounds
    && Number.isFinite(referenceBounds.lowerLimit)
    && Number.isFinite(referenceBounds.upperLimit)
    && Number.isFinite(Number(value))) {
    return Number(value) < referenceBounds.lowerLimit || Number(value) > referenceBounds.upperLimit;
  }
  if (metricId === "heart-rate") return value < 60 || value > 100;
  if (metricId === "blood-pressure") {
    const [systolic, diastolic] = String(value).split("/").map(Number);
    return Number.isFinite(systolic) && Number.isFinite(diastolic)
      && (systolic >= 130 || diastolic >= 80 || systolic < 90);
  }
  if (metricId === "oxygen-saturation") return value < 95;
  if (metricId === "body-temperature") return value < 36.1 || value > 37.5;
  if (metricId === "respiratory-rate") return value < 12 || value > 20;
  if (metricId === "sleep-duration") return value < 7 || value > 9;
  if (metricId === "stress-indicator") return value >= 60;
  if (metricId === "physical-activity") return value < 40;
  return false;
};

const warningSeverity = (metricId, value) => {
  if (metricId === "heart-rate") return value >= 120 ? "Critical" : value > 100 ? "High" : "Medium";
  if (metricId === "blood-pressure") {
    const [systolic, diastolic] = String(value).split("/").map(Number);
    if (systolic >= 160 || diastolic >= 100) return "Critical";
    if (systolic >= 140 || diastolic >= 90) return "High";
    return "Medium";
  }
  if (metricId === "oxygen-saturation") return value < 90 ? "Critical" : "High";
  if (metricId === "body-temperature") return value >= 39 ? "Critical" : "High";
  if (metricId === "respiratory-rate") return value > 24 ? "Critical" : "High";
  if (metricId === "sleep-duration") return value < 5 ? "High" : "Medium";
  if (metricId === "stress-indicator") return value >= 85 ? "Critical" : value >= 75 ? "High" : "Medium";
  return "Medium";
};

const confirmedMetricIds = new Map([
  ["Heart Rate", "heart-rate"],
  ["Blood Pressure", "blood-pressure"],
  ["Oxygen Saturation", "oxygen-saturation"],
  ["Body Temperature", "body-temperature"],
  ["Respiratory Rate", "respiratory-rate"],
  ["Sleep Duration", "sleep-duration"],
  ["Stress Indicator", "stress-indicator"],
  ["Physical Activity", "physical-activity"],
]);

const assessConfirmedReading = (parameter, value) => {
  const metricId = confirmedMetricIds.get(parameter);
  if (!metricId) return { status: "No configured assessment rule", severity: null };
  const numericValue = Number(value);
  if (metricId !== "blood-pressure" && !Number.isFinite(numericValue)) {
    return { status: "Unable to assess this value", severity: null };
  }
  if (!outsideDemoBand(metricId, metricId === "blood-pressure" ? value : numericValue)) {
    return { status: "Within the configured demonstration band", severity: null };
  }
  return {
    status: "Outside the configured demonstration band",
    severity: warningSeverity(metricId, metricId === "blood-pressure" ? value : numericValue),
    action: "Verify the reported value and follow the applicable mission medical protocol.",
  };
};

const makeWarnings = (crew, metricDefinitions) => crew.flatMap((member) => metricDefinitions.flatMap((metric) => {
  const metricId = metric.id;
  const reading = member.readings[metricId];
  const history = reading.history.filter((value) =>
    metricId === "blood-pressure"
      ? /^\d{1,3}\s*\/\s*\d{1,3}$/.test(String(value))
      : Number.isFinite(Number(value))
  );
  const latestPair = history.slice(-2);
  if (latestPair.length < 2
    || !latestPair.every((value) => outsideDemoBand(metricId, value, reading.referenceBounds))) return [];
  const matchingAlert = member.alerts.find((alert) =>
    alert.parameter === metric.parameter && alert.status !== "Resolved"
  );
  return [{
    id: `${member.id}:${metricId}`,
    memberId: member.id,
    name: member.name,
    metric: metric.parameter,
    parameter: metric.parameter,
    value: latestPair.at(-1),
    unit: reading.unit,
    severity: matchingAlert?.severity || warningSeverity(metricId, latestPair.at(-1)),
    action: matchingAlert?.recommendation || "Verify the sample and follow the applicable mission medical protocol.",
    alertId: matchingAlert?.id || null,
    timestamp: matchingAlert?.timestamp || reading.historyTimestamps?.at(-1) || null,
    sampleCount: latestPair.length,
    source: matchingAlert?.source || reading.source || "Rule-detected from demonstration history",
    simulated: Boolean(reading.simulated),
    referenceRange: reading.referenceRange || null,
  }];
}));

const analyzeCrew = (crew, metricDefinitions) => {
  const warnings = makeWarnings(crew, metricDefinitions);
  return {
    riskOutlooks: crew.map((member) => makeRiskOutlook(
      member,
      metricDefinitions,
      warnings.filter((warning) => warning.memberId === member.id && !warning.alertId)
    )),
    trendInsights: makeTrendInsights(crew),
    warnings,
  };
};

module.exports = { analyzeCrew, assessConfirmedReading };