/**
 * api.js — Frontend API Client
 * ==============================
 * Smart Traffic Congestion Prediction & Route Planning System
 * Automatically connects to the backend host (localhost or LAN IP).
 */

export const getBackendHost = () => {
  if (typeof window !== "undefined" && window.location && window.location.hostname) {
    return window.location.hostname;
  }
  return "127.0.0.1";
};

export const getBackendBase = () => `http://${getBackendHost()}:8000/api`;
export const getStreamUrl = (camId = "CCTV-SKG-01") =>
  `http://${getBackendHost()}:8000/api/cameras/${camId}/stream`;

const post = async (url, body = {}) => {
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

// ── Health & System Status ──────────────────────────────────────────────────

export const getHealth = async () => get(`${getBackendBase()}/health`);

export const getNetworkInfo = async () => get(`${getBackendBase()}/system/network`);

export const getRoutingStatus = async () => get(`${getBackendBase()}/routing-status`);

export const getLocations = async () => get(`${getBackendBase()}/locations`);

export const getVideosList = async () => get(`${getBackendBase()}/videos`);

// ── CCTV Camera & Telemetry ─────────────────────────────────────────────────

export const getCamerasList = async () => get(`${getBackendBase()}/cameras`);

export const startCamera = async (camId = "CCTV-SKG-01") =>
  post(`${getBackendBase()}/cameras/${camId}/start`, {});

export const stopCamera = async (camId = "CCTV-SKG-01") =>
  post(`${getBackendBase()}/cameras/${camId}/stop`, {});

export const getCameraTelemetry = async (camId = "CCTV-SKG-01") =>
  get(`${getBackendBase()}/cameras/${camId}/telemetry`);

export const getCameraForecast = async (camId = "CCTV-SKG-01") =>
  get(`${getBackendBase()}/cameras/${camId}/forecast`);

export const getCameraStats = async (camId = "CCTV-SKG-01") =>
  get(`${getBackendBase()}/cameras/${camId}/metrics`);

export const getCamerasAggregate = async () =>
  get(`${getBackendBase()}/cameras/aggregate`);

export const createCamera = async (cameraData) =>
  post(`${getBackendBase()}/cameras`, cameraData);

export const uploadVideoFile = async (formData) => {
  const res = await fetch(`${getBackendBase()}/cameras/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  return res.json();
};

export const pushFrameBytes = async (camId, frameBytes) => {
  const res = await fetch(`${getBackendBase()}/cameras/${camId}/frame`, {
    method: "POST",
    headers: { "Content-Type": "image/jpeg" },
    body: frameBytes,
  });
  return res.json();
};

// ── Route Planning ──────────────────────────────────────────────────────────

export const getRouteByName = async (fromName, toName, fromCoords = null, toCoords = null) => {
  const payload = {
    from_name: fromName,
    to_name: toName,
  };
  if (fromCoords) {
    payload.from_lat = fromCoords.lat;
    payload.from_lon = fromCoords.lon;
  }
  if (toCoords) {
    payload.to_lat = toCoords.lat;
    payload.to_lon = toCoords.lon;
  }
  return post(`${getBackendBase()}/get-route-by-name`, payload);
};

export const getRouteByCoords = async (originLat, originLon, destLat, destLon) =>
  post(`${getBackendBase()}/get-route`, {
    origin_lat: originLat,
    origin_lon: originLon,
    dest_lat: destLat,
    dest_lon: destLon,
  });

// ── Alerts & Incidents ──────────────────────────────────────────────────────

export const getAlerts = async () => get(`${getBackendBase()}/alerts`);

export const sendOfficerAction = async (alertId, action, officerId = "OFFICER_TN_042", notes = "") =>
  post(`${getBackendBase()}/alerts/${alertId}/action`, { action, officer_id: officerId, notes });

export const getTrafficStats = async () => get(`${getBackendBase()}/get-traffic-stats`);

export const getPrediction = async () => get(`${getBackendBase()}/predict-congestion`);
