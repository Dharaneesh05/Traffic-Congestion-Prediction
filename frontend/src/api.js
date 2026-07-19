/**
 * api.js — Frontend API Client
 * ==============================
 * Smart Traffic Congestion System
 * All calls to the FastAPI backend are centralized here.
 */

const API_BASE = "http://localhost:8000/api";

// ── Helper ──────────────────────────────────────────────────────────────────

const post = async (url, body) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  return res.json();
};

const get = async (url) => {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  return res.json();
};

// ── Existing Endpoints (unchanged) ──────────────────────────────────────────

export const uploadVideo = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_BASE}/upload-video`, {
    method: "POST",
    body: formData,
  });
  return response.json();
};

export const setDetection = async (enable) =>
  post(`${API_BASE}/start-detection`, { enable });

export const setTracking = async (enable) =>
  post(`${API_BASE}/start-tracking`, { enable });

export const getTrafficStats = async () =>
  get(`${API_BASE}/get-traffic-stats`);

export const getPrediction = async () =>
  get(`${API_BASE}/predict-congestion`);

export const getRoute = async (originLat, originLon, destLat, destLon) =>
  post(`${API_BASE}/get-route`, {
    origin_lat: originLat,
    origin_lon: originLon,
    dest_lat: destLat,
    dest_lon: destLon,
  });

// ── New Endpoints ────────────────────────────────────────────────────────────

/** Return all Tamil Nadu searchable locations */
export const getLocations = async () =>
  get(`${API_BASE}/locations`);

/** Return 4-camera configuration list */
export const getCameras = async () =>
  get(`${API_BASE}/cameras`);

/** Start a specific camera (background YOLO11 + ByteTrack processing) */
export const startCamera = async (camId) =>
  post(`${API_BASE}/camera/${camId}/start`, {});

/** Stop a specific camera */
export const stopCamera = async (camId) =>
  post(`${API_BASE}/camera/${camId}/stop`, {});

/** Get latest YOLO11 stats for a specific camera */
export const getCameraStats = async (camId) =>
  get(`${API_BASE}/camera/${camId}/stats`);

/**
 * Route by human-readable name (no lat/lon needed in frontend).
 * @param {string} fromName  - e.g. "Salem Bus Stand"
 * @param {string} toName    - e.g. "Erode Bus Stand"
 */
export const getRouteByName = async (fromName, toName) =>
  post(`${API_BASE}/get-route-by-name`, {
    from_name: fromName,
    to_name: toName,
  });

/** AI recommendations from all active cameras */
export const getAgentReport = async () =>
  get(`${API_BASE}/agent-report`);
