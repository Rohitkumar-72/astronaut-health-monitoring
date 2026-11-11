const MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL?.trim() || "gemini-3.8-live";
const REQUEST_TIMEOUT_MS = 30_000;
const LIVE_SESSION_DURATION_MS = 30 * 60_000;
const RETRY_OPTIONS = Object.freeze({
  attempts: 3,
  initialDelay: 1,
  maxDelay: 4,
  expBase: 2,
  jitter: 0.25,
  httpStatusCodes: Object.freeze([429, 500, 503]),
});

module.exports = {
  MODEL,
  LIVE_MODEL,
  REQUEST_TIMEOUT_MS,
  LIVE_SESSION_DURATION_MS,
  RETRY_OPTIONS,
};
