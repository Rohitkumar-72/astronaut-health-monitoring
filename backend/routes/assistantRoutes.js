const express = require("express");
const dataService = require("../services/healthService");
const assistantService = require("../services/assistantService");
const { MODEL } = require("../config/geminiConfig");

const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 2_000;
const MAX_TOTAL_LENGTH = 12_000;

function createRateLimiter({ limit = 12, windowMs = 60_000, now = Date.now } = {}) {
  const requestsByClient = new Map();

  return (req, res, next) => {
    const timestamp = now();
    const clientId = req.socket?.remoteAddress || req.ip || "unknown";

    if (requestsByClient.size > 4_096) {
      for (const [key, record] of requestsByClient) {
        if (timestamp - record.startedAt >= windowMs) requestsByClient.delete(key);
      }
    }

    const record = requestsByClient.get(clientId);
    if (!record && requestsByClient.size >= 4_096) {
      res.set("Retry-After", String(Math.ceil(windowMs / 1_000)));
      return res.status(429).json({
        error: { code: "AI_RATE_LIMITED", message: "Too many assistant clients are active. Please try again later." },
      });
    }

    if (!record || timestamp - record.startedAt >= windowMs) {
      requestsByClient.set(clientId, { startedAt: timestamp, count: 1 });
      res.set("RateLimit-Limit", String(limit));
      res.set("RateLimit-Remaining", String(limit - 1));
      return next();
    }

    if (record.count >= limit) {
      const retryAfter = Math.max(1, Math.ceil((record.startedAt + windowMs - timestamp) / 1_000));
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({
        error: { code: "AI_RATE_LIMITED", message: "Too many assistant requests. Please wait before trying again." },
      });
    }

    record.count += 1;
    res.set("RateLimit-Limit", String(limit));
    res.set("RateLimit-Remaining", String(limit - record.count));
    return next();
  };
}

function validateMessages(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MESSAGES) {
    return "messages must contain between 1 and 20 conversation entries.";
  }

  let totalLength = 0;
  for (let index = 0; index < value.length; index += 1) {
    const message = value[index];
    const expectedRole = index % 2 === 0 ? "user" : "assistant";
    if (
      !message
      || typeof message !== "object"
      || Array.isArray(message)
      || Object.keys(message).some((key) => key !== "role" && key !== "content")
      || message.role !== expectedRole
      || typeof message.content !== "string"
    ) {
      return "messages must alternate between user and assistant, beginning and ending with a user message.";
    }
    const content = message.content.trim();
    if (!content || content.length > MAX_MESSAGE_LENGTH) {
      return "Each message must contain between 1 and 2000 characters.";
    }
    totalLength += content.length;
  }

  if (value.at(-1)?.role !== "user") {
    return "The last conversation entry must be a user message.";
  }
  if (totalLength > MAX_TOTAL_LENGTH) {
    return "The conversation exceeds the 12000 character limit.";
  }
  return null;
}

function validateRequestBody(body) {
  if (
    !body
    || typeof body !== "object"
    || Array.isArray(body)
    || Object.keys(body).some((key) => key !== "messages")
  ) {
    return "The request must contain only a messages array.";
  }
  return validateMessages(body.messages);
}

function validateExtractionBody(body) {
  if (
    !body
    || typeof body !== "object"
    || Array.isArray(body)
    || Object.keys(body).some((key) => key !== "text")
    || typeof body.text !== "string"
    || !body.text.trim()
    || body.text.trim().length > MAX_MESSAGE_LENGTH
  ) {
    return "text must contain between 1 and 2000 characters.";
  }
  return null;
}

function buildHealthContext(model) {
  return {
    dataNotice: "Simulated backend demonstration data; not live telemetry or a medical record.",
    capturedAt: new Date().toISOString(),
    readings: model.healthReadings.map((reading) => ({
      astronautId: reading.crewId,
      astronautName: reading.astronautName,
      parameter: reading.parameter,
      value: reading.value,
      unit: reading.unit,
      status: reading.status,
      source: reading.source,
      timestamp: reading.timestamp,
      referenceRange: reading.referenceRange,
    })),
    activeAlerts: model.alerts
      .filter((alert) => alert.status !== "Resolved")
      .slice(0, 20)
      .map((alert) => ({
        astronautName: alert.astronautName,
        parameter: alert.parameter,
        value: alert.value,
        unit: alert.unit,
        severity: alert.severity,
        status: alert.status,
        message: alert.message,
        timestamp: alert.timestamp,
        source: alert.source,
      })),
    confirmedCrewReports: (model.healthRecords || []).slice(0, 40).map((record) => ({
      astronautId: record.astronautId,
      astronautName: record.astronautName,
      measurements: record.measurements,
      symptoms: record.symptoms,
      timestamp: record.timestamp,
      source: record.source,
      assessment: record.assessment,
    })),
    ruleBasedRiskOutlooks: model.riskOutlooks,
    availableTrendInsights: model.trendInsights,
  };
}

function createAssistantRouter({
  healthDataService = dataService,
  aiService = assistantService,
  rateLimiter = createRateLimiter(),
} = {}) {
  const router = express.Router();

  router.post("/chat", rateLimiter, async (req, res) => {
    const validationError = validateRequestBody(req.body);
    if (validationError) {
      return res.status(400).json({
        error: { code: "INVALID_ASSISTANT_REQUEST", message: validationError },
      });
    }

    const messages = req.body.messages.map(({ role, content }) => ({
      role,
      content: content.trim(),
    }));

    try {
      const model = await healthDataService.getData();
      const reply = await aiService.generateAssistantReply(messages, buildHealthContext(model));
      return res.json({
        data: { reply },
        meta: { model: MODEL },
      });
    } catch (error) {
      if (error.status && error.code) {
        return res.status(error.status).json({
          error: { code: error.code, message: error.message },
        });
      }
      return res.status(500).json({
        error: { code: "AI_REQUEST_FAILED", message: "The assistant request could not be completed." },
      });
    }
  });

  router.post("/extract", rateLimiter, async (req, res) => {
    const validationError = validateExtractionBody(req.body);
    if (validationError) {
      return res.status(400).json({
        error: { code: "INVALID_EXTRACTION_REQUEST", message: validationError },
      });
    }

    try {
      const healthDraft = await aiService.extractHealthData(req.body.text.trim());
      return res.json({
        data: { healthDraft },
        meta: { model: MODEL },
      });
    } catch (error) {
      if (error.status && error.code) {
        return res.status(error.status).json({
          error: { code: error.code, message: error.message },
        });
      }
      return res.status(500).json({
        error: { code: "AI_EXTRACTION_FAILED", message: "Health information could not be extracted." },
      });
    }
  });

  return router;
}

module.exports = createAssistantRouter;
module.exports.createRateLimiter = createRateLimiter;
