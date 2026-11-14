const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api")
  .replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request(path, { signal, ...options } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError(
      `Unable to reach or read the ASTRA API at ${API_BASE_URL}. Check that the backend is running, VITE_API_BASE_URL is correct, and backend CORS allows this frontend origin.`
    );
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new ApiError(`The API returned an invalid response (${response.status}).`, response.status);
  }

  if (!response.ok) {
    throw new ApiError(
      body?.error?.message || `API request failed with status ${response.status}.`,
      response.status,
      body?.error?.code
    );
  }
  return body.data;
}

const queryString = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, value);
  });
  const serialized = search.toString();
  return serialized ? `?${serialized}` : "";
};

export const getDashboardOverview = (options) => request("/dashboard/overview", options);
export const getHealthSummary = (options) => request("/dashboard/health-summary", options);
export const getDashboardHealthTrends = (options) => request("/dashboard/health-trends", options);
export const getCrew = (options) => request("/crew", options);
export const getCrewMember = (crewId, options) => request(`/crew/${encodeURIComponent(crewId)}`, options);
export const getCrewHealth = (crewId, options) => request(`/crew/${encodeURIComponent(crewId)}/health`, options);
export const getCrewHistory = (crewId, options) => request(`/crew/${encodeURIComponent(crewId)}/history`, options);
export const getHealthReadings = (params, options) => request(`/health${queryString(params)}`, options);
export const getHealthMetrics = (options) => request("/health/metrics", options);
export const getHealthTrends = (params, options) => request(`/health/trends${queryString(params)}`, options);
export const getHealthHistory = (options) => request("/health/history", options);
export const getHealthRecords = (options) => request("/health/records", options);
export const createHealthRecord = (record) => request("/health/records", {
  method: "POST",
  body: JSON.stringify(record),
});
export const extractHealthData = (text, options = {}) => request("/assistant/extract", {
  ...options,
  method: "POST",
  body: JSON.stringify({ text }),
});
export const getAlerts = (params, options) => request(`/alerts${queryString(params)}`, options);
export const getAlert = (alertId, options) => request(`/alerts/${encodeURIComponent(alertId)}`, options);
export const updateAlert = (alertId, status) => request(`/alerts/${encodeURIComponent(alertId)}`, {
  method: "PATCH",
  body: JSON.stringify({ status }),
});
export const createAlert = (alert) => request("/alerts", {
  method: "POST",
  body: JSON.stringify(alert),
});
export const resetDemoAlerts = () => request("/alerts/reset-demo", { method: "POST" });
export const getRisks = (options) => request("/risks", options);
export const getCrewRisk = (crewId, options) => request(`/risks/${encodeURIComponent(crewId)}`, options);
export const getMission = (options) => request("/mission", options);
export const getMissionStatus = (options) => request("/mission/status", options);
export const getCsvDataset = (datasetName, options) =>
  request(`/data/csv/${encodeURIComponent(datasetName)}`, options);
export const getCsvDatasetStatus = (options) => request("/data/csv/status", options);
export const sendAssistantMessage = (messages, options = {}) => request("/assistant/chat", {
  ...options,
  method: "POST",
  body: JSON.stringify({ messages }),
});
export const createLiveVoiceSession = (messages, language = "auto", options = {}) => request("/assistant/live-token", {
  ...options,
  method: "POST",
  body: JSON.stringify({ messages, language }),
});