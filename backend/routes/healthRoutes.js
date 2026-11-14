const express = require("express");
const csvService = require("../services/csvService");

const router = express.Router();

// Check all CSV files
router.get("/csv/status", (req, res) => {
  const files = csvService.checkCSVFiles();

  const allAvailable = files.every((file) => file.exists && file.readable);

  res.status(allAvailable ? 200 : 503).json({
    success: allAvailable,
    message: allAvailable
      ? "All declared CSV files are available."
      : "One or more declared CSV files are missing.",
    data: files,
  });
});

// Get all CSV datasets
router.get("/csv", (req, res, next) => {
  try {
    const { data, errors } = csvService.getAllCSVData();

    res.status(errors.length ? 206 : 200).json({
      success: errors.length === 0,
      source: "backend/data CSV files",
      data,
      errors,
    });
  } catch (error) {
    next(error);
  }
});

// Get a particular CSV dataset
router.get("/csv/:datasetName", (req, res, next) => {
  try {
    const data = csvService.getCSVData(req.params.datasetName);

    res.json({
      success: true,
      dataset: req.params.datasetName,
      count: data.length,
      data,
    });
  } catch (error) {
    if (error.message.startsWith("Unknown CSV dataset")) {
      return res.status(404).json({
        error: { code: "UNKNOWN_CSV_DATASET", message: error.message },
      });
    }
    if (error.code === "CSV_FILE_NOT_FOUND") {
      return res.status(503).json({
        error: { code: error.code, message: error.message },
      });
    }

    next(error);
  }
});

module.exports = router;