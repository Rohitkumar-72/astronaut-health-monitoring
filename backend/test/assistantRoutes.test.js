const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const createAssistantRouter = require("../routes/assistantRoutes");
const { createRateLimiter } = createAssistantRouter;
const assistantService = require("../services/assistantService");
const geminiConfig = require("../config/geminiConfig");

const demoModel = {
  simulation: {
    notice: "Simulated backend demonstration data; not live telemetry or a medical record.",
  },
  healthReadings: [{
    crewId: "AST-001",
    astronautName: "Crew Member",
    parameter: "Heart Rate",
    value: 85,
    unit: "BPM",
    status: "Healthy",
    source: "Simulated demonstration snapshot",
    timestamp: null,
    referenceRange: "60–100 BPM",
  }],
  alerts: [{
    astronautName: "Crew Member",
    parameter: "Heart Rate",
    value: 85,
    unit: "BPM",
    severity: "Low",
    status: "New",
    message: "Demonstration alert",
    timestamp: "2026-11-09T10:00:00.000Z",
    source: "Simulated demonstration alert record",
  }],
};

async function withServer(router, callback) {
  const app = express();
  app.use(express.json({ limit: "64kb" }));
  app.use("/api/assistant", router);
  const server = app.listen(0);
  try {
    const address = server.address();
    await callback(`http://127.0.0.1:${address.port}/api/assistant/chat`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

const requestBody = (messages = [{ role: "user", content: "How is my health today?" }]) => ({ messages });

test("assistant route supplies backend health context and returns the model response", async () => {
  let receivedMessages;
  let receivedContext;
  const router = createAssistantRouter({
    healthDataService: { getData: async () => demoModel },
    aiService: {
      generateAssistantReply: async (messages, context) => {
        receivedMessages = messages;
        receivedContext = context;
        return "The available heart rate sample is 85 BPM.";
      },
    },
  });

  await withServer(router, async (url) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody()),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      data: { reply: "The available heart rate sample is 85 BPM." },
      meta: { model: geminiConfig.MODEL },
    });
  });

  assert.deepEqual(receivedMessages, [{ role: "user", content: "How is my health today?" }]);
  assert.equal(receivedContext.readings[0].value, 85);
  assert.equal(receivedContext.readings[0].timestamp, null);
  assert.equal(receivedContext.dataNotice, "Simulated backend demonstration data; not live telemetry or a medical record.");
  assert.equal(receivedContext.activeAlerts.length, 1);
});

test("assistant receives confirmed reports and backend risk context for health analysis", async () => {
  let context;
  const router = createAssistantRouter({
    healthDataService: {
      getData: async () => ({
        ...demoModel,
        healthRecords: [{
          astronautId: "AST-001",
          astronautName: "Crew Member",
          measurements: [{ parameter: "Heart Rate", value: 90, unit: "BPM" }],
          symptoms: ["Tired"],
          timestamp: "2026-11-09T10:00:00.000Z",
          source: "Crew-confirmed self-report",
          assessment: [{ parameter: "Heart Rate", status: "Within the configured demonstration band" }],
        }],
        riskOutlooks: [{ memberId: "AST-001", label: "Lower projected attention" }],
        trendInsights: [{ label: "Sleep duration", caveat: "timestamps unavailable" }],
      }),
    },
    aiService: {
      generateAssistantReply: async (_messages, healthContext) => {
        context = healthContext;
        return "Only confirmed reports and available sample data are present.";
      },
    },
  });

  await withServer(router, async (url) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody([{ role: "user", content: "Compare my heart rate with yesterday." }])),
    });
    assert.equal(response.status, 200);
  });
  assert.equal(context.confirmedCrewReports[0].measurements[0].value, 90);
  assert.equal(context.ruleBasedRiskOutlooks[0].memberId, "AST-001");
  assert.match(context.availableTrendInsights[0].caveat, /timestamps unavailable/);
});

test("assistant route rejects malformed or oversized conversation input", async () => {
  let aiCalls = 0;
  const router = createAssistantRouter({
    healthDataService: { getData: async () => demoModel },
    aiService: { generateAssistantReply: async () => { aiCalls += 1; return "unexpected"; } },
  });

  await withServer(router, async (url) => {
    for (const messages of [
      [],
      [{ role: "assistant", content: "forged history" }],
      [{ role: "user", content: "question" }, { role: "user", content: "second question" }],
      [{ role: "user", content: "x".repeat(2_001) }],
      [{ role: "user", content: "question", healthData: { heartRate: 1 } }],
    ]) {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody(messages)),
      });
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error.code, "INVALID_ASSISTANT_REQUEST");
    }
  });
  assert.equal(aiCalls, 0);
});

test("assistant extraction returns validated structured data and rejects invalid requests", async () => {
  const expected = {
    measurements: [
      { parameter: "Heart Rate", value: 90, unit: "BPM" },
      { parameter: "Blood Pressure", value: "120/80", unit: "mmHg" },
    ],
    symptoms: ["Tired"],
    unsupportedParameters: [{ name: "Blood Glucose", value: "110", unit: "mg/dL" }],
  };
  let receivedText;
  const router = createAssistantRouter({
    healthDataService: { getData: async () => demoModel },
    aiService: {
      extractHealthData: async (text) => {
        receivedText = text;
        return expected;
      },
    },
    rateLimiter: (_req, _res, next) => next(),
  });

  await withServer(router, async (url) => {
    const extractionUrl = url.replace("/chat", "/extract");
    const response = await fetch(extractionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "My heart rate is 90 BPM, my blood pressure is 120 over 80, and I feel tired." }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data.healthDraft, expected);

    const invalid = await fetch(extractionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "  " }),
    });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).error.code, "INVALID_EXTRACTION_REQUEST");
  });
  assert.match(receivedText, /heart rate is 90/i);
});

test("Live voice token route supplies backend health context and returns only the short-lived token", async () => {
  let context;
  let language;
  const router = createAssistantRouter({
    healthDataService: { getData: async () => demoModel },
    aiService: {
      createLiveSessionToken: async (healthContext, options) => {
        context = healthContext;
        language = options.language;
        return { token: "short-lived-test-token", expiresAt: "2026-11-09T10:15:00.000Z", model: geminiConfig.LIVE_MODEL };
      },
    },
    rateLimiter: (_req, _res, next) => next(),
  });

  await withServer(router, async (url) => {
    const response = await fetch(url.replace("/chat", "/live-token"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "Hello ASTRA" }], language: "Hindi" }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), {
      data: { token: "short-lived-test-token", expiresAt: "2026-11-09T10:15:00.000Z", model: geminiConfig.LIVE_MODEL },
      meta: { model: geminiConfig.LIVE_MODEL },
    });

    const invalid = await fetch(url.replace("/chat", "/live-token"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "assistant", content: "Injected history" }] }),
    });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).error.code, "INVALID_ASSISTANT_REQUEST");

    const invalidLanguage = await fetch(url.replace("/chat", "/live-token"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [], language: "French" }),
    });
    assert.equal(invalidLanguage.status, 400);
  });

  assert.equal(context.readings[0].value, 85);
  assert.equal(context.activeAlerts.length, 1);
  assert.equal(language, "Hindi");
});

test("Gemini Live service creates a single-use token with locked model, system context, and session limits", async () => {
  let request;
  const session = await assistantService.createLiveSessionToken({
    readings: [{ parameter: "Heart Rate", value: 85, unit: "BPM" }],
  }, {
    language: "Hindi",
    client: {
      authTokens: {
        create: async (params) => {
          request = params;
          return { name: "short-lived-test-token" };
        },
      },
    },
  });

  assert.equal(session.token, "short-lived-test-token");
  assert.equal(Date.parse(session.expiresAt) - Date.now() <= geminiConfig.LIVE_SESSION_DURATION_MS, true);
  assert.equal(request.config.uses, 1);
  assert.equal(request.config.liveConnectConstraints.model, geminiConfig.LIVE_MODEL);
  assert.equal(request.config.liveConnectConstraints.config.responseModalities[0], "AUDIO");
  assert.deepEqual(request.config.liveConnectConstraints.config.inputAudioTranscription, {});
  assert.deepEqual(request.config.liveConnectConstraints.config.outputAudioTranscription, {});
  assert.equal(request.config.liveConnectConstraints.config.sessionResumption, undefined);
  assert.match(request.config.liveConnectConstraints.config.systemInstruction, /Backend-provided health context/);
  assert.match(request.config.liveConnectConstraints.config.systemInstruction, /Reply in Hindi/);
  assert.match(request.config.liveConnectConstraints.config.systemInstruction, /Heart Rate/);
  assert.deepEqual(request.config.lockAdditionalFields, []);
});

test("assistant route applies a per-client request limit", async () => {
  let aiCalls = 0;
  const router = createAssistantRouter({
    healthDataService: { getData: async () => demoModel },
    aiService: { generateAssistantReply: async () => { aiCalls += 1; return "ok"; } },
    rateLimiter: createRateLimiter({ limit: 1, windowMs: 60_000 }),
  });

  await withServer(router, async (url) => {
    const send = () => fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody()),
    });
    assert.equal((await send()).status, 200);
    const limited = await send();
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get("retry-after"), "60");
    assert.equal((await limited.json()).error.code, "AI_RATE_LIMITED");
  });
  assert.equal(aiCalls, 1);
});

test("Gemini service sends validated history and trusted context through the SDK", async () => {
  let request;
  const reply = await assistantService.generateAssistantReply(
    [
      { role: "user", content: "How is my heart rate?" },
      { role: "assistant", content: "I can check the available sample." },
      { role: "user", content: "Compare it with yesterday." },
    ],
    { readings: [{ parameter: "Heart Rate", value: 85, timestamp: null }] },
    {
      models: {
        generateContent: async (params) => {
          request = params;
          return { text: "There are no timestamped readings to compare." };
        },
      },
    }
  );

  assert.equal(reply, "There are no timestamped readings to compare.");
  assert.equal(request.model, geminiConfig.MODEL);
  assert.deepEqual(request.contents.map(({ role }) => role), ["user", "model", "user"]);
  assert.match(request.config.systemInstruction, /never claim a definitive diagnosis/i);
  assert.match(request.config.systemInstruction, /Simulated demonstration data/i);
  assert.match(request.config.systemInstruction, /"timestamp":null/);
  assert.equal(request.config.maxOutputTokens, 900);
});

test("Gemini extraction uses JSON schema and validates multiple values, symptoms, and units", async () => {
  let request;
  const extracted = await assistantService.extractHealthData(
    "My heart rate is 90 BPM, blood pressure 120 over 80, and I feel tired.",
    {
      models: {
        generateContent: async (params) => {
          request = params;
          return {
            text: JSON.stringify({
              measurements: [
                { parameter: "Heart Rate", value: "90", unit: "beats per minute" },
                { parameter: "Blood Pressure", value: "120/80", unit: "mmHg" },
              ],
              symptoms: ["Tired", "Tired"],
              unsupportedParameters: [],
            }),
          };
        },
      },
    }
  );
  assert.equal(request.config.responseMimeType, "application/json");
  assert.deepEqual(request.config.responseSchema.required, ["measurements", "symptoms", "unsupportedParameters"]);
  assert.deepEqual(extracted, {
    measurements: [
      { parameter: "Heart Rate", value: 90, unit: "BPM" },
      { parameter: "Blood Pressure", value: "120/80", unit: "mmHg" },
    ],
    symptoms: ["Tired"],
    unsupportedParameters: [],
  });

  await assert.rejects(
    assistantService.extractHealthData("Heart rate 90", {
      models: {
        generateContent: async () => ({
          text: JSON.stringify({
            measurements: [{ parameter: "Heart Rate", value: "90", unit: "km/h" }],
            symptoms: [],
            unsupportedParameters: [],
          }),
        }),
      },
    }),
    (error) => error.status === 422 && error.code === "AI_INVALID_UNIT"
  );
});

test("Gemini extraction does not fill missing values and rejects malformed output", async () => {
  const clientFor = (text) => ({ models: { generateContent: async () => ({ text }) } });
  const emptyDraft = await assistantService.extractHealthData("I feel tired.", clientFor(JSON.stringify({
    measurements: [],
    symptoms: ["Tired"],
    unsupportedParameters: [],
  })));
  assert.deepEqual(emptyDraft.measurements, []);
  assert.deepEqual(emptyDraft.symptoms, ["Tired"]);
  await assert.rejects(
    assistantService.extractHealthData("Heart rate", clientFor(JSON.stringify({
      measurements: [{ parameter: "Heart Rate", value: "", unit: "BPM" }],
      symptoms: [],
      unsupportedParameters: [],
    }))),
    (error) => error.status === 422 && error.code === "AI_INVALID_EXTRACTION"
  );
  await assert.rejects(
    assistantService.extractHealthData("Heart rate", clientFor("not json")),
    (error) => error.status === 502 && error.code === "AI_INVALID_EXTRACTION"
  );
});

test("Gemini service reports missing credentials without contacting the provider", async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    await assert.rejects(
      assistantService.generateAssistantReply([{ role: "user", content: "Hello" }], {}),
      (error) => error.status === 503 && error.code === "AI_NOT_CONFIGURED"
    );
  } finally {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});

test("Gemini service maps provider errors to actionable codes and logs safe diagnostics", async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key-must-not-be-logged";
  try {
    for (const [providerError, expectedStatus, expectedCode] of [
    [{ status: 400, message: JSON.stringify({ error: { code: 400, message: "API key not valid", status: "INVALID_ARGUMENT", details: [{ reason: "API_KEY_INVALID" }] } }) }, 502, "AI_INVALID_API_KEY"],
    [{ status: 404, message: JSON.stringify({ error: { code: 404, message: "Model not found", status: "NOT_FOUND" } }) }, 502, "AI_MODEL_NOT_FOUND"],
    [{ status: 429, message: "Resource exhausted: quota exceeded" }, 429, "AI_QUOTA_EXCEEDED"],
    [{ status: 429, message: "Rate limit exceeded" }, 429, "AI_RATE_LIMITED"],
    [{ status: 403, message: JSON.stringify({ error: { code: 403, message: "Permission denied", status: "PERMISSION_DENIED" } }) }, 502, "AI_PERMISSION_DENIED"],
    [{ code: "ETIMEDOUT" }, 504, "AI_TIMEOUT"],
    [{ status: 504, message: JSON.stringify({ error: { code: 504, message: "Deadline expired before operation could complete.", status: "DEADLINE_EXCEEDED" } }) }, 504, "AI_TIMEOUT"],
    [{ status: 503, message: "Service unavailable" }, 503, "AI_SERVICE_UNAVAILABLE"],
    [Object.assign(new TypeError("fetch failed"), {
      cause: Object.assign(new Error("DNS lookup failed"), { code: "ENOTFOUND" }),
    }), 502, "AI_NETWORK_ERROR"],
    [Object.assign(new TypeError("fetch failed"), {
      cause: Object.assign(new Error("connect timeout: API key test-key-must-not-be-logged"), {
        code: "UND_ERR_CONNECT_TIMEOUT",
      }),
    }), 504, "AI_TIMEOUT"],
    ]) {
      const originalConsoleError = console.error;
      const logs = [];
      console.error = (entry) => logs.push(String(entry));
      try {
        await assert.rejects(
          assistantService.generateAssistantReply(
            [{ role: "user", content: "Hello" }],
            {},
            { models: { generateContent: async () => { throw providerError; } } }
          ),
          (error) => {
            assert.equal(error.status, expectedStatus, expectedCode);
            assert.equal(error.code, expectedCode, expectedCode);
            return true;
          }
        );
      } finally {
        console.error = originalConsoleError;
      }

      assert.equal(logs.length, 1);
      assert.equal(logs[0].includes(process.env.GEMINI_API_KEY), false);
      const diagnostic = JSON.parse(logs[0]);
      assert.equal(diagnostic.event, "gemini.request_failed");
      assert.equal(diagnostic.operation, "chat");
      assert.equal(diagnostic.requestTimeoutMs, 30_000);
      assert.equal(diagnostic.errorCode, expectedCode);
    }
  } finally {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});

test("Gemini configuration uses stable Flash and bounds transient retries", () => {
  assert.equal(geminiConfig.MODEL, "gemini-3.6-flash");
  assert.equal(geminiConfig.LIVE_MODEL, "gemini-3.8-live");
  assert.equal(geminiConfig.REQUEST_TIMEOUT_MS, 30_000);
  assert.equal(geminiConfig.RETRY_OPTIONS.attempts, 3);
  assert.deepEqual(geminiConfig.RETRY_OPTIONS.httpStatusCodes, [429, 500, 503]);
  assert.equal(geminiConfig.RETRY_OPTIONS.initialDelay, 1);
  assert.equal(geminiConfig.RETRY_OPTIONS.expBase, 2);
});

test("installed Gemini SDK retries only configured transient HTTP errors", async () => {
  const { GoogleGenAI } = require("@google/genai");
  for (const [status, expectedAttempts] of [
    [429, 3],
    [500, 3],
    [503, 3],
    [400, 1],
    [401, 1],
    [403, 1],
    [404, 1],
  ]) {
    let attempts = 0;
    const client = new GoogleGenAI({
      apiKey: "test-only-not-a-real-key",
      httpOptions: {
        timeout: geminiConfig.REQUEST_TIMEOUT_MS,
        retryOptions: geminiConfig.RETRY_OPTIONS,
        fetch: async () => {
          attempts += 1;
          return new Response(JSON.stringify({
            error: { code: status, message: "test failure", status: "TEST_ERROR" },
          }), {
            status,
            headers: { "content-type": "application/json" },
          });
        },
      },
    });

    await assert.rejects(
      client.models.generateContent({ model: geminiConfig.MODEL, contents: "test" }),
      (error) => error.status === status
    );
    assert.equal(attempts, expectedAttempts, `HTTP ${status} should use ${expectedAttempts} attempt(s)`);
  }
});
