const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, ".env") });

const cors = require("cors");
const express = require("express");
const apiRoutes = require("./routes/apiRoutes");
const createAssistantRouter = require("./routes/assistantRoutes");

const app = express();
const port = Number(process.env.PORT || 5000);
const allowedOrigins = (process.env.FRONTEND_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable("x-powered-by");
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS origin not allowed: ${origin}`));
  },
}));
app.use(express.json({ limit: "64kb" }));

app.get("/api/health-check", (_req, res) => {
  res.json({ data: { status: "ok", service: "ASTRA Crew Health API" }, meta: { simulated: false } });
});
app.use("/api/assistant", createAssistantRouter());
app.use("/api", apiRoutes);

app.use((req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "API endpoint was not found." } });
});

app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({ error: { code: "INVALID_JSON", message: "Request body must contain valid JSON." } });
  }
  if (error.message?.startsWith("CORS origin not allowed:")) {
    return res.status(403).json({ error: { code: "CORS_ORIGIN_DENIED", message: "This origin is not allowed." } });
  }
  console.error("API request failed:", error);
  return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "The API could not complete the request." } });
});

app.listen(port, () => {
  console.log(`ASTRA Crew Health API listening on http://localhost:${port}`);
});

module.exports = app;