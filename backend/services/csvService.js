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
    const error = new Error(`CSV file not found: ${fileName}`);
    error.code = "CSV_FILE_NOT_FOUND";
    throw error;
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");

  if (!fileContent.trim()) {
    return [];
  }

  try {
    return parse(fileContent, {
      columns: (headers) =>
        headers.map((header) => header.replace(/^\uFEFF/, "").trim()),
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      bom: true,
    });
  } catch (cause) {
    const error = new Error(`CSV file could not be parsed: ${fileName}`, { cause });
    error.code = "CSV_PARSE_ERROR";
    throw error;
  }
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
  const errors = [];

  for (const [key, fileName] of Object.entries(CSV_FILES)) {
    try {
      data[key] = readCSV(fileName);
    } catch (error) {
      data[key] = [];
      errors.push({
        dataset: key,
        file: fileName,
        code: error.code || "CSV_READ_ERROR",
        message: error.code === "CSV_FILE_NOT_FOUND"
          ? `Dataset file is missing: ${fileName}`
          : `Dataset could not be read: ${fileName}`,
      });
    }
  }

  return { data, errors };
}

// Check whether all CSV files are available
function checkCSVFiles() {
  return Object.entries(CSV_FILES).map(([key, fileName]) => {
    const filePath = path.join(DATA_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      return {
        dataset: key,
        file: fileName,
        exists: false,
        readable: false,
        records: null,
        error: "CSV_FILE_NOT_FOUND",
      };
    }

    try {
      return {
        dataset: key,
        file: fileName,
        exists: true,
        readable: true,
        records: readCSV(fileName).length,
        error: null,
      };
    } catch (error) {
      return {
        dataset: key,
        file: fileName,
        exists: true,
        readable: false,
        records: null,
        error: error.code || "CSV_READ_ERROR",
      };
    }
  });
}

module.exports = {
  readCSV,
  getCSVData,
  getAllCSVData,
  checkCSVFiles,
  CSV_FILES,
};