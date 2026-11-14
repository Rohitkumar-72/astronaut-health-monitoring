const DEFAULT_DEMO_MISSION = {
  name: "ASTRA Demonstration Mission",
  day: 42,
  durationDays: 180,
  phase: "Mission operations · demo",
  status: "SIMULATED · NOT A REAL MISSION",
  source: "SIMULATED DEMO DATA",
};

const DEMO_BOUNDS = {
  "Heart Rate": { lowerLimit: 60, upperLimit: 100 },
  "Systolic blood pressure": { lowerLimit: 90, upperLimit: 120 },
  "Diastolic blood pressure": { lowerLimit: 60, upperLimit: 80 },
  "Oxygen Saturation": { lowerLimit: 95, upperLimit: 100 },
  "Body Temperature": { lowerLimit: 36.1, upperLimit: 37.5 },
  "Respiratory Rate": { lowerLimit: 12, upperLimit: 20 },
  "Sleep Duration": { lowerLimit: 7, upperLimit: 9 },
  "Stress Indicator": { lowerLimit: 0, upperLimit: 60 },
  "Physical Activity": { lowerLimit: 40, upperLimit: 100 },
};

const metricProfiles = {
  "Heart Rate": { baseline: 72, variation: 6 },
  "Blood Pressure": { baseline: [116, 76], variation: [6, 5] },
  "Oxygen Saturation": { baseline: 98, variation: 1.2 },
  "Body Temperature": { baseline: 36.8, variation: 0.25 },
  "Respiratory Rate": { baseline: 16, variation: 2 },
  "Sleep Duration": { baseline: 7.6, variation: 0.8 },
  "Physical Activity": { baseline: 58, variation: 12 },
  "Stress Indicator": { baseline: 38, variation: 10 },
  "Bone Density": { baseline: 0.1, variation: 0.08 },
  Mood: { baseline: 7, variation: 0.8 },
  "Daily Calorie Intake": { baseline: 2250, variation: 140 },
  "Muscular Endurance Score": { baseline: 40, variation: 4 },
  "Cognitive Reaction Time": { baseline: 245, variation: 25 },
  "Hydration Status": { baseline: 70, variation: 8 },
  "Heart Rate Variability": { baseline: 55, variation: 8 },
  "Cumulative Radiation Dose": { baseline: 18, variation: 0.5 },
};

const benchmarkNames = {
  "Heart Rate": ["Heart Rate(bpm)"],
  "Blood Pressure": ["Systolic blood pressure", "Diastolic blood pressure"],
  "Oxygen Saturation": ["SpO2(percent)"],
  "Body Temperature": ["Body Temperature(degree celsius)"],
  "Respiratory Rate": ["Respiratory Rate"],
  "Sleep Duration": ["Daily Sleep Hours(hours)"],
  "Physical Activity": ["Physical Activity"],
  "Stress Indicator": ["Stress Indicator"],
  "Bone Density": ["Bone density(T score)"],
  Mood: ["Mood"],
  "Daily Calorie Intake": ["Daily Calorie Intake"],
  "Muscular Endurance Score": ["Muscular Endurance Score"],
  "Cognitive Reaction Time": ["Cognitive Reaction time"],
  "Hydration Status": ["Hydration Status"],
  "Heart Rate Variability": ["Heart Rate Variability"],
  "Cumulative Radiation Dose": ["Cumulative Radiation Dose"],
};

const numeric = (value) => {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = Number(String(value).trim().replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};

const hash = (value) => {
  let result = 2_166_136_261;
  for (const character of String(value)) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16_777_619);
  }
  return result >>> 0;
};

const createRandom = (seed) => {
  let state = seed || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
};

const getDemoCrew = (crew, targetCount = 17) => {
  const members = [...crew];
  const ids = new Set(members.map((member) => member.id));
  const environments = ["Earth", "ISS", "Moon", "Mars simulation"];

  for (let index = 1; members.length < targetCount; index += 1) {
    const id = `ASTRA-DEMO-${String(index).padStart(3, "0")}`;
    if (ids.has(id)) continue;
    ids.add(id);
    members.push({
      id,
      name: `Demo crew member ${String(index).padStart(2, "0")}`,
      role: "Simulated crew profile",
      age: null,
      yearOfBirth: null,
      sex: null,
      yearOfMission: null,
      missionTitle: DEFAULT_DEMO_MISSION.name,
      currentLocation: environments[(index - 1) % environments.length],
      lastCheckup: null,
      profileSource: "SIMULATED DEMO DATA",
      simulated: true,
    });
  }

  return members;
};

const getMissionMetadata = () => {
  const dayValue = Number(process.env.ASTRA_DEMO_MISSION_DAY);
  const durationValue = Number(process.env.ASTRA_DEMO_MISSION_DURATION_DAYS);
  const day = Number.isInteger(dayValue) && dayValue > 0 ? dayValue : DEFAULT_DEMO_MISSION.day;
  const durationDays = Number.isInteger(durationValue) && durationValue >= day
    ? durationValue
    : Math.max(DEFAULT_DEMO_MISSION.durationDays, day);
  return {
    ...DEFAULT_DEMO_MISSION,
    name: process.env.ASTRA_DEMO_MISSION_NAME?.trim() || DEFAULT_DEMO_MISSION.name,
    day,
    durationDays,
  };
};

const findBenchmarkBounds = (parameter, environmentRows = []) => {
  const names = benchmarkNames[parameter] || [];
  const matches = names.map((name) =>
    environmentRows.find((row) => row.parameter.toLowerCase().startsWith(name.toLowerCase()))
  ).filter(Boolean);

  if (parameter === "Blood Pressure") {
    const systolic = matches.find((row) => row.parameter.toLowerCase().startsWith("systolic"));
    const diastolic = matches.find((row) => row.parameter.toLowerCase().startsWith("diastolic"));
    if (systolic || diastolic) {
      return {
        systolic: systolic
          ? { lowerLimit: systolic.lowerLimit, upperLimit: systolic.upperLimit }
          : DEMO_BOUNDS["Systolic blood pressure"],
        diastolic: diastolic
          ? { lowerLimit: diastolic.lowerLimit, upperLimit: diastolic.upperLimit }
          : DEMO_BOUNDS["Diastolic blood pressure"],
      };
    }
  } else if (matches[0] && matches[0].lowerLimit !== null && matches[0].upperLimit !== null) {
    return { lowerLimit: matches[0].lowerLimit, upperLimit: matches[0].upperLimit };
  }

  if (parameter === "Blood Pressure") {
    return {
      systolic: DEMO_BOUNDS["Systolic blood pressure"],
      diastolic: DEMO_BOUNDS["Diastolic blood pressure"],
    };
  }
  return DEMO_BOUNDS[parameter] || null;
};

const bounded = (value, bounds) => {
  if (!bounds || !Number.isFinite(bounds.lowerLimit) || !Number.isFinite(bounds.upperLimit)) return value;
  return Math.min(bounds.upperLimit, Math.max(bounds.lowerLimit, value));
};

const scenarioFor = (member) => {
  const numericId = String(member.id).match(/(\d+)$/)?.[1];
  return Number(numericId || hash(member.id)) % 7;
};

const getTimestampAnchor = (now) => {
  const configured = process.env.ASTRA_DEMO_END_DATE;
  const parsed = configured ? new Date(`${configured}T12:00:00.000Z`) : new Date(now);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error("ASTRA_DEMO_END_DATE must be a valid YYYY-MM-DD date.");
  }
  return Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 12);
};

const generatedValue = (member, metric, dayIndex, bounds, random) => {
  const profile = metricProfiles[metric.parameter];
  if (!profile) return null;
  const scenario = scenarioFor(member);
  const progress = dayIndex / 13;

  if (metric.parameter === "Blood Pressure") {
    const [systolicBase, diastolicBase] = profile.baseline;
    const [systolicVariation, diastolicVariation] = profile.variation;
    return [
      Math.round(bounded(systolicBase + (random() - 0.5) * systolicVariation * 2, bounds?.systolic)),
      Math.round(bounded(diastolicBase + (random() - 0.5) * diastolicVariation * 2, bounds?.diastolic)),
    ].join("/");
  }

  let scenarioValue = 0;
  if (metric.parameter === "Heart Rate" && scenario === 1) scenarioValue = 35 * progress;
  if (metric.parameter === "Sleep Duration" && scenario === 2) scenarioValue = -1.5 * progress;
  if (metric.parameter === "Stress Indicator" && scenario === 3) scenarioValue = 40 * progress;
  if (metric.parameter === "Physical Activity" && scenario === 4) scenarioValue = -20 * progress;
  if (metric.parameter === "Heart Rate" && scenario === 5) scenarioValue = 4;

  const base = profile.baseline + scenarioValue;
  const value = base + (random() - 0.5) * profile.variation * 2;
  const digits = metric.parameter === "Body Temperature" || metric.parameter === "Sleep Duration"
    || metric.parameter === "Mood" || metric.parameter === "Bone Density"
    ? 1
    : metric.parameter === "Cognitive Reaction Time" || metric.parameter === "Daily Calorie Intake"
      ? 0
      : 1;
  return Number(value.toFixed(digits));
};

const readingKey = (crewId, parameter, timestamp) => `${crewId}\u0000${parameter}\u0000${timestamp}`;

const generateDemoReadings = (
  crew,
  metricDefinitions,
  existingRecords = [],
  environmentBenchmarks = {},
  now = new Date(),
  sampleDays = 14
) => {
  const existingKeys = new Set();
  for (const record of existingRecords) {
    if (!record?.timestamp) continue;
    for (const measurement of record.measurements || []) {
      existingKeys.add(readingKey(record.astronautId, measurement.parameter, record.timestamp));
    }
  }

  const records = [];
  const anchor = getTimestampAnchor(now);
  for (const member of crew) {
    const random = createRandom(hash(member.id));
    for (let dayIndex = 0; dayIndex < sampleDays; dayIndex += 1) {
      const timestamp = new Date(anchor - (sampleDays - dayIndex - 1) * 86_400_000).toISOString();
      const environmentRows = environmentBenchmarks[member.currentLocation] || [];
      const measurements = metricDefinitions.flatMap((metric) => {
        const key = readingKey(member.id, metric.parameter, timestamp);
        if (existingKeys.has(key)) return [];
        const referenceBounds = findBenchmarkBounds(metric.parameter, environmentRows);
        const value = generatedValue(member, metric, dayIndex, referenceBounds, random);
        if (value === null) return [];
        existingKeys.add(key);
        return [{
          parameter: metric.parameter,
          value,
          unit: metric.unit,
          referenceBounds,
        }];
      });

      if (measurements.length > 0) {
        records.push({
          astronautId: member.id,
          timestamp,
          sourceIndex: dayIndex,
          source: "SIMULATED DEMO DATA",
          simulated: true,
          measurements,
        });
      }
    }
  }

  return records;
};

module.exports = {
  DEFAULT_DEMO_MISSION,
  DEMO_BOUNDS,
  generateDemoReadings,
  getDemoCrew,
  getMissionMetadata,
  findBenchmarkBounds,
};
