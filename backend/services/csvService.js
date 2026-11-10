const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

const DATA_DIR = path.join(__dirname, "../data");

const CSV_FILES = {
  crewInfo: "crew_info.csv",
  healthBenchmarks: "health_benchmarks.csv",
  healthReadings: "health_readings.csv",
  riskThresholds: "risk_thresholds.csv",
  nasaEarth: "nasa_metrics_earth.csv",
  nasaISS: "nasa_metrics_iss.csv",
  nasaLunar: "nasa_metrics_lunar.csv",
};

// Read and parse a CSV file
function readCSV(fileName) {
  const filePath = path.join(DATA_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found: ${fileName}`);
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");

  if (!fileContent.trim()) {
    return [];
  }

  return parse(fileContent, {
    columns: (headers) =>
      headers.map((header) => header.replace(/^\uFEFF/, "").trim()),
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    bom: true,
  });
}

// Get a particular CSV dataset
function getCSVData(datasetName) {
  const fileName = CSV_FILES[datasetName];

  if (!fileName) {
    throw new Error(`Unknown CSV dataset: ${datasetName}`);
  }

  return readCSV(fileName);
}

// Load all seven CSV datasets
function getAllCSVData() {
  const data = {};

  for (const [key, fileName] of Object.entries(CSV_FILES)) {
    data[key] = readCSV(fileName);
  }

  return data;
}

// Check whether all CSV files are available
function checkCSVFiles() {
  return Object.entries(CSV_FILES).map(([key, fileName]) => {
    const filePath = path.join(DATA_DIR, fileName);

    return {
      dataset: key,
      file: fileName,
      exists: fs.existsSync(filePath),
    };
  });
}

module.exports = {
  readCSV,
  getCSVData,
  getAllCSVData,
  checkCSVFiles,
  CSV_FILES,
};