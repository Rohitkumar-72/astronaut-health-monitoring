const express = require("express");
const csvService = require("../services/csvService");

const router = express.Router();

// Check all CSV files
router.get("/csv/status", (req, res) => {
  const files = csvService.checkCSVFiles();

  const allAvailable = files.every((file) => file.exists);

  res.status(allAvailable ? 200 : 503).json({
    success: allAvailable,
    message: allAvailable
      ? "All CSV files are connected successfully."
      : "Some CSV files are missing.",
    data: files,
  });
});

// Get all CSV datasets
router.get("/csv", (req, res, next) => {
  try {
    const data = csvService.getAllCSVData();

    res.json({
      success: true,
      source: "backend/data CSV files",
      data,
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
        success: false,
        message: error.message,
      });
    }

    next(error);
  }
});

module.exports = router;