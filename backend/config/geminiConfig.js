const MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
const REQUEST_TIMEOUT_MS = 30_000;
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
  REQUEST_TIMEOUT_MS,
  RETRY_OPTIONS,
};
