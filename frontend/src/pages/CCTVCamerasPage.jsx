import React, { useState, useEffect, useMemo } from "react";
import { Loader2, Upload, ChevronDown } from "lucide-react";
import {
  getStreamUrl,
  getVideosList,
  uploadVideoFile,
  getCameraTelemetry,
  startCameraAnalysis,
  stopCameraAnalysis,
} from "../api";
import { trafficService } from "../services/trafficService";
import { useSettings } from "../context/SettingsContext";

export default function CCTVCamerasPage({
  telemetry,
  cameraStatus = "standby",
  isLoadingCameraAction = false,
  onStartCamera,
  onStopCamera,
  activeCameraId = "CCTV-TPR-01",
  onSelectCamera,
  selectedJunction = null,
  selectedLocation = null,
  districtName = "",
  alerts = [],
  onOfficerAction,
  onNavigateTab,
  onIncidentClick = null,
  onSelectJunction = null,
}) {
  const { t, tJunction } = useSettings();
  const [activeCamId, setActiveCamId] = useState(activeCameraId || "CCTV-TPR-01");
  const [sourceMode, setSourceMode] = useState("video"); // "video" | "ip"
  const [selectedVideo, setSelectedVideo] = useState("Traffic.mp4");
  const currentSelectedVideoName = typeof selectedVideo === "string" ? selectedVideo : (selectedVideo?.filename || "Traffic.mp4");
  const [videoList, setVideoList] = useState([]);
  const [rtspUrl, setRtspUrl] = useState("rtsp://10.161.12.181:1945/");
  const [urlError, setUrlError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [streamNonce, setStreamNonce] = useState(Date.now());
  const [liveTelemetry, setLiveTelemetry] = useState(telemetry);
  const [analysisActive, setAnalysisActive] = useState(false);
  const [lastUpdatedTime, setLastUpdatedTime] = useState("Just now");
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);
  const [incidentHovered, setIncidentHovered] = useState(false);

  const isOnline = cameraStatus === "online";

  // Sync active camera ID when changed from global top search bar
  useEffect(() => {
    if (activeCameraId && activeCameraId !== activeCamId) {
      setActiveCamId(activeCameraId);
      setStreamError(false);
      setRetryCount(0);
      setStreamNonce(Date.now());
    }
  }, [activeCameraId]);

  // Sync camera when selected junction changes from global search bar
  useEffect(() => {
    if (selectedJunction?.cameras && selectedJunction.cameras.length > 0) {
      const hasCam = selectedJunction.cameras.some((c) => c.id === activeCamId);
      if (!hasCam) {
        const firstOnline = selectedJunction.cameras.find((c) => c.status === "ONLINE") || selectedJunction.cameras[0];
        setActiveCamId(firstOnline.id);
        if (onSelectCamera) onSelectCamera(firstOnline.id);
        setStreamError(false);
        setRetryCount(0);
        setStreamNonce(Date.now());
      }
    }
  }, [selectedJunction]);

  // Sync telemetry from parent prop
  useEffect(() => {
    if (telemetry) {
      setLiveTelemetry(telemetry);
      setLastUpdatedTime(
        new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    }
  }, [telemetry]);

  // High-frequency telemetry polling (750ms) while camera is online
  useEffect(() => {
    if (!isOnline) {
      setLiveTelemetry(null);
      setStreamError(false);
      setAnalysisActive(false);
      return;
    }
    const interval = setInterval(async () => {
      try {
        const res = await getCameraTelemetry(activeCamId);
        if (res?.is_analyzing !== undefined) {
          setAnalysisActive(Boolean(res.is_analyzing));
        } else if (res?.telemetry) {
          setAnalysisActive(true);
        }
        if (res?.telemetry) {
          setLiveTelemetry(res.telemetry);
          setLastUpdatedTime(
            new Date().toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: true,
            })
          );
        } else if (res && res.is_analyzing === false) {
          setLiveTelemetry(null);
        }
      } catch (e) {}
    }, 750);
    return () => clearInterval(interval);
  }, [isOnline, activeCamId]);

  // Reset stream nonce and retry count when camera becomes online or changes
  useEffect(() => {
    if (isOnline) {
      setStreamNonce(Date.now());
      setStreamError(false);
      setRetryCount(0);
    }
  }, [isOnline, activeCamId]);

  // Resolve current junction and camera metadata
  const currentJunction = useMemo(() => {
    if (selectedJunction) return selectedJunction;
    const found = trafficService.allJunctions.find((j) =>
      (j.cameras || []).some((c) => c.id === activeCamId)
    );
    return found || trafficService.allJunctions[0];
  }, [selectedJunction, activeCamId]);

  const currentCamera = useMemo(() => {
    const fromCurrent = (currentJunction?.cameras || []).find((c) => c.id === activeCamId);
    if (fromCurrent) return fromCurrent;
    const fromAll = trafficService.allJunctions.flatMap((j) => j.cameras || []).find((c) => c.id === activeCamId);
    if (fromAll) return fromAll;
    return {
      id: activeCamId,
      name: activeCamId,
      approach: "Approach Corridor",
      status: isOnline ? "ONLINE" : "STANDBY",
      type: "YOLO11 ByteTrack Live",
    };
  }, [currentJunction, activeCamId, isOnline]);

  // Clean location title - location name ONLY without any CCTV ID or middle dots
  const locationTitle = useMemo(() => {
    const locName = typeof selectedLocation === "string"
      ? selectedLocation
      : (selectedLocation?.name || null);

    const raw = (
      currentCamera?.approach ||
      locName ||
      currentJunction?.name ||
      "Approach Corridor"
    );
    return tJunction ? tJunction(raw) : raw;
  }, [currentCamera, selectedLocation, currentJunction, tJunction]);

  // Load sample videos and AUTO-START live feed stream immediately as per location
  useEffect(() => {
    let active = true;
    const initCameraFeed = async () => {
      let chosenVideo = "Traffic.mp4";
      try {
        const res = await getVideosList();
        if (res?.videos && res.videos.length > 0) {
          if (active) setVideoList(res.videos);
          const list = res.videos.map((v) => (typeof v === "string" ? v : v.filename));
          const locStr = typeof selectedLocation === "string" ? selectedLocation : (selectedLocation?.name || "");
          const jName = (currentJunction?.name || locStr || "").toLowerCase();
          const cId = (activeCamId || "").toLowerCase();
          const matched = list.find((v) => {
            const vl = v.toLowerCase();
            return (jName && vl.includes(jName)) || (cId && vl.includes(cId));
          });
          if (matched) {
            chosenVideo = matched;
          } else {
            const num = activeCamId.match(/\d+/);
            const idx = num ? parseInt(num[0], 10) - 1 : 0;
            chosenVideo = list[Math.abs(idx) % list.length] || "Traffic.mp4";
          }
          if (active) setSelectedVideo(chosenVideo);
        }
      } catch (e) {}

      // Auto start camera if not already streaming
      if (onStartCamera && !isOnline) {
        try {
          await onStartCamera(activeCamId, { video: chosenVideo, auto_analysis: true });
        } catch (err) {
          console.error("Auto start camera failed:", err);
        }
      }
    };

    initCameraFeed();
    return () => {
      active = false;
    };
  }, [activeCamId, currentJunction, selectedLocation]);

  // Video File Upload Handler
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("camera_name", `Custom Video (${file.name})`);
    try {
      const res = await uploadVideoFile(formData);
      if (res?.camera_id) {
        setSelectedVideo(file.name);
        setActiveCamId(res.camera_id);
        if (onSelectCamera) onSelectCamera(res.camera_id);
        const vData = await getVideosList().catch(() => null);
        if (vData?.videos) setVideoList(vData.videos);
        if (onStartCamera) {
          setStreamError(false);
          setRetryCount(0);
          setStreamNonce(Date.now());
          onStartCamera(res.camera_id, { video: file.name, auto_analysis: true });
        }
      }
    } catch (err) {
      console.error("Video upload failed:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleVideoChange = (newVideo) => {
    const fname = typeof newVideo === "string" ? newVideo : (newVideo?.filename || "Traffic.mp4");
    setSelectedVideo(fname);
    if (onStartCamera) {
      setStreamError(false);
      setRetryCount(0);
      setStreamNonce(Date.now());
      onStartCamera(activeCamId, { video: fname, auto_analysis: true });
    }
  };

  const handleStartCamera = async () => {
    setStreamError(false);
    setRetryCount(0);
    setUrlError("");
    setStreamNonce(Date.now());
    setAnalysisActive(true);

    if (onStartCamera) {
      if (sourceMode === "video") {
        try {
          const videoName = currentSelectedVideoName;
          await onStartCamera(activeCamId, { video: videoName, auto_analysis: true });
        } catch (err) {
          console.error("Video camera start failed:", err);
        }
      } else if (sourceMode === "ip") {
        const trimmed = rtspUrl.trim();
        if (!trimmed.toLowerCase().startsWith("rtsp://") && !trimmed.toLowerCase().startsWith("rtsps://")) {
          setUrlError("Invalid RTSP URL. Must begin with rtsp://");
          return;
        }
        try {
          await onStartCamera(activeCamId, { source: trimmed, source_type: "rtsp", auto_analysis: true });
        } catch (err) {
          console.error("RTSP camera start failed:", err);
          setUrlError(err?.message || "Failed to connect to RTSP camera stream.");
        }
      } else {
        try {
          await onStartCamera(activeCamId, { auto_analysis: true });
        } catch (err) {
          console.error("Camera start failed:", err);
        }
      }
    }
  };

  const handleStopAll = async () => {
    setAnalysisActive(false);
    setLiveTelemetry(null);
    try {
      await stopCameraAnalysis(activeCamId).catch(() => null);
    } catch (e) {}
    if (onStopCamera) {
      onStopCamera(activeCamId);
    }
  };

  const handleStreamError = () => {
    if (retryCount < 3) {
      setTimeout(() => {
        setRetryCount((prev) => prev + 1);
        setStreamNonce(Date.now());
      }, 800);
    } else {
      setStreamError(true);
    }
  };

  // Status mapping
  const isConnecting = isLoadingCameraAction || cameraStatus === "connecting" || cameraStatus === "starting";
  const isError = (streamError && !isConnecting) || cameraStatus === "error";

  let statusText = t("status.live", "LIVE");
  let statusColor = "#22C55E";
  if (isConnecting) {
    statusText = t("status.connecting", "CONNECTING");
    statusColor = "#D97706";
  } else if (isError) {
    statusText = t("status.unavailable", "UNAVAILABLE");
    statusColor = "#EF4444";
  } else if (!isOnline) {
    statusText = t("status.ready", "READY");
    statusColor = "#737987";
  }

  const locationIncidents = useMemo(() => {
    if (!alerts || alerts.length === 0) return [];
    const jName = (currentJunction?.name || "").toLowerCase().trim();
    const cId = (activeCamId || "").toLowerCase().trim();

    const matched = alerts.filter((a) => {
      if (a.status === "RESOLVED") return false;
      const aCam = (a.camera_id || "").toLowerCase().trim();
      const aLoc = (a.location || a.junction || "").toLowerCase().trim();
      if (cId && aCam === cId) return true;
      if (jName && (aLoc.includes(jName) || jName.includes(aLoc))) return true;
      return false;
    });

    // Deduplicate: show only the unique respective incidents (max 1 or 2 distinct incidents, e.g. 1 accident, 1 ambulance)
    const deduped = [];
    const seenCategories = new Set();

    for (const a of matched) {
      const typeStr = (a.type || a.incident_type || a.title || a.reason || a.description || "").toLowerCase();
      const isAccident = typeStr.includes("accident") || typeStr.includes("collision") || typeStr.includes("crash");
      const isAmbulance = typeStr.includes("ambulance") || typeStr.includes("emergency");
      const category = isAccident ? "accident" : isAmbulance ? "ambulance" : "other";

      if (!seenCategories.has(category)) {
        seenCategories.add(category);
        deduped.push(a);
      }
      if (deduped.length >= 2) break; // Maximum 1 or 2 distinct incidents
    }

    return deduped;
  }, [alerts, currentJunction, activeCamId]);

  const activeIncident = locationIncidents.length > 0 ? locationIncidents[0] : null;

  const formatIncidentTime = (ts) => {
    if (!ts) return "Time unavailable";
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return "Time unavailable";
      return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    } catch {
      return "Time unavailable";
    }
  };

  const activeAccident = useMemo(() => {
    return locationIncidents.find((a) => {
      const t = (a.type || a.incident_type || a.title || "").toLowerCase();
      const desc = (a.reason || a.description || "").toLowerCase();
      return (
        t.includes("accident") ||
        t.includes("collision") ||
        t.includes("crash") ||
        desc.includes("accident") ||
        desc.includes("collision") ||
        desc.includes("bike")
      );
    });
  }, [locationIncidents]);

  const activeAmbulance = useMemo(() => {
    return locationIncidents.find((a) => {
      const t = (a.type || a.incident_type || a.title || "").toLowerCase();
      const desc = (a.reason || a.description || "").toLowerCase();
      return (
        t.includes("ambulance") ||
        t.includes("emergency") ||
        desc.includes("ambulance") ||
        desc.includes("emergency vehicle")
      );
    });
  }, [locationIncidents]);

  const activeOtherIncident = useMemo(() => {
    return locationIncidents.find((a) => a !== activeAccident && a !== activeAmbulance);
  }, [locationIncidents, activeAccident, activeAmbulance]);

  const getAccidentHeadline = (inc) => {
    if (!inc) return "ACCIDENT DETECTED";
    const t = (inc.type || inc.incident_type || inc.title || "").toLowerCase();
    const desc = (inc.reason || inc.description || "").toLowerCase();
    if (t.includes("bike") || desc.includes("bike") || desc.includes("motorcycle")) {
      return "BIKE ACCIDENT DETECTED";
    }
    if (t.includes("collision") || desc.includes("multiple vehicles") || (inc.vehicles_involved && inc.vehicles_involved > 1)) {
      return "VEHICLE COLLISION DETECTED";
    }
    if (t.includes("block") || desc.includes("block") || desc.includes("obstruction")) {
      return "ROAD BLOCKED";
    }
    return "ACCIDENT DETECTED";
  };

  const junctionCameras = (currentJunction?.cameras && currentJunction.cameras.length > 0)
    ? currentJunction.cameras
    : [
        { id: "CCTV-TPR-01", name: "CCTV-TPR-01", approach: "Kumaran Road (North Inflow)", status: "ONLINE" },
        { id: "CCTV-TPR-02", name: "CCTV-TPR-02", approach: "Palladam Road (South Outflow)", status: "ONLINE" },
        { id: "CCTV-TPR-03", name: "CCTV-TPR-03", approach: "Railway Station Connector", status: "ONLINE" },
        { id: "CCTV-TPR-04", name: "CCTV-TPR-04", approach: "Dharapuram Road Approach", status: "ONLINE" },
      ];

  const hasTelemetryMetrics = (t) =>
    Boolean(
      t &&
      (t.total_tracked != null ||
       t.vehicle_count != null ||
       t.total != null ||
       t.cars != null ||
       t.vehicles?.car != null ||
       t.class_counts?.car != null ||
       t.traffic_flow_vpm != null ||
       t.flow_per_minute != null)
    );

  const isAnalysisRunning = Boolean(
    analysisActive ||
    (isOnline && (sourceMode === "video" || hasTelemetryMetrics(liveTelemetry) || hasTelemetryMetrics(telemetry)))
  );

  const effTel = isOnline && isAnalysisRunning ? (liveTelemetry || telemetry) : null;

  const valVehicles = effTel && (effTel.total_tracked != null || effTel.vehicle_count != null || effTel.active_tracks != null || effTel.total != null)
    ? (effTel.total_tracked ?? effTel.vehicle_count ?? effTel.active_tracks ?? effTel.total)
    : null;

  const valCars = effTel && (effTel.cars != null || effTel.vehicles?.car != null || effTel.vehicle_breakdown?.car != null || effTel.class_counts?.car != null)
    ? (effTel.cars ?? effTel.vehicles?.car ?? effTel.vehicle_breakdown?.car ?? effTel.class_counts?.car)
    : null;

  const valTrucks = effTel && (effTel.trucks != null || effTel.vehicles?.truck != null || effTel.vehicle_breakdown?.truck != null || effTel.class_counts?.truck != null)
    ? (effTel.trucks ?? effTel.vehicles?.truck ?? effTel.vehicle_breakdown?.truck ?? effTel.class_counts?.truck)
    : null;

  const valBuses = effTel && (effTel.buses != null || effTel.vehicles?.bus != null || effTel.vehicle_breakdown?.bus != null || effTel.class_counts?.bus != null)
    ? (effTel.buses ?? effTel.vehicles?.bus ?? effTel.vehicle_breakdown?.bus ?? effTel.class_counts?.bus)
    : null;

  const valBikes = effTel && (effTel.bikes != null || effTel.vehicles?.bike != null || effTel.vehicles?.motorcycle != null || effTel.vehicle_breakdown?.bike != null || effTel.class_counts?.bike != null || effTel.class_counts?.motorcycle != null)
    ? (effTel.bikes ?? effTel.vehicles?.bike ?? effTel.vehicles?.motorcycle ?? effTel.vehicle_breakdown?.bike ?? effTel.class_counts?.bike ?? effTel.class_counts?.motorcycle)
    : null;

  const valFlow = effTel && (effTel.flow_per_minute != null || effTel.traffic_flow_vpm != null)
    ? `${(effTel.flow_per_minute ?? effTel.traffic_flow_vpm).toFixed(0)} veh/min`
    : null;

  const streamSrc = `${getStreamUrl(activeCamId)}?t=${streamNonce}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "1520px", margin: "0 auto", width: "100%" }}>
      {/* 2-Column Workstation Layout: Left = Live Video Feed, Right = Location, Controls & Telemetry */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.65fr) minmax(360px, 1fr)",
          gap: "1.25rem",
          alignItems: "start",
          width: "100%",
        }}
      >
        {/* LEFT SIDE: Live Feed Video Frame */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", width: "100%" }}>
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "16 / 9",
              background: "#0D0F12",
              border: "1px solid #303746",
              borderRadius: "4px",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Live stream image */}
            {isOnline && !isError ? (
              <>
                <img
                  src={streamSrc}
                  alt="Live CCTV Feed"
                  onError={handleStreamError}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
                {/* Live overlay indicator */}
                <div
                  style={{
                    position: "absolute",
                    top: "12px",
                    left: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.45rem",
                    padding: "0.25rem 0.6rem",
                    background: "rgba(16, 18, 22, 0.85)",
                    backdropFilter: "blur(4px)",
                    border: "1px solid rgba(48, 55, 70, 0.75)",
                    borderRadius: "3px",
                  }}
                >
                  <div
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      background: "#22C55E",
                      boxShadow: "0 0 6px #22C55E",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 800,
                      color: "#F4F5F7",
                      letterSpacing: "0.08em",
                    }}
                  >
                    LIVE
                  </span>
                </div>
              </>
            ) : isConnecting ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.75rem",
                  color: "#9299A8",
                }}
              >
                <Loader2 className="animate-spin" size={32} color="#7C8FD8" />
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#F4F5F7" }}>
                  Connecting to live feed...
                </div>
                <div style={{ fontSize: "0.75rem", color: "#9299A8" }}>
                  Initializing detection pipeline
                </div>
              </div>
            ) : isError ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.75rem",
                  color: "#FF5B6E",
                }}
              >
                <div style={{ fontSize: "0.9375rem", fontWeight: 700 }}>
                  CAMERA UNAVAILABLE
                </div>
                <div style={{ fontSize: "0.75rem", color: "#9299A8" }}>
                  Failed to connect to video feed
                </div>
                <button
                  type="button"
                  onClick={handleStartCamera}
                  style={{
                    marginTop: "0.25rem",
                    padding: "0.35rem 0.85rem",
                    background: "#222733",
                    border: "1px solid #303746",
                    borderRadius: "3px",
                    color: "#F4F5F7",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Retry
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.75rem",
                  color: "#9299A8",
                }}
              >
                <Loader2 className="animate-spin" size={32} color="#7C8FD8" />
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#F4F5F7" }}>
                  Loading live feed...
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDE: Location Header, Controls, Telemetry & Info */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%" }}>
          {/* 1. Location Header + Status (Location name only, no CCTV ID) */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: "0.5rem",
              borderBottom: "1px solid #303746",
              gap: "0.75rem",
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#F4F5F7", letterSpacing: "-0.01em" }}>
              {locationTitle}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
              <div
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: statusColor,
                  boxShadow: isOnline ? `0 0 6px ${statusColor}` : "none",
                }}
              />
              <span style={{ fontSize: "0.6875rem", fontWeight: 800, color: statusColor, letterSpacing: "0.08em" }}>
                {statusText}
              </span>
            </div>
          </div>

          {/* 2. Controls: Camera Approach Selector + Video Source Controls */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {/* Approach Dropdown (Location name only) */}
            <div style={{ position: "relative", width: "100%" }}>
              <select
                value={activeCamId}
                onChange={(e) => {
                  const newCamId = e.target.value;
                  setActiveCamId(newCamId);
                  if (onSelectCamera) onSelectCamera(newCamId);
                  setStreamError(false);
                  setRetryCount(0);
                  setStreamNonce(Date.now());
                  if (onStartCamera) {
                    const videoName = currentSelectedVideoName;
                    onStartCamera(newCamId, { video: videoName, auto_analysis: true });
                  }
                }}
                style={{
                  width: "100%",
                  padding: "0.45rem 2rem 0.45rem 0.75rem",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  background: "#161920",
                  color: "#F4F5F7",
                  border: "1px solid #303746",
                  borderRadius: "4px",
                  appearance: "none",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                {junctionCameras.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.approach || c.name || c.id}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                color="#9299A8"
                style={{
                  position: "absolute",
                  right: "0.75rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                }}
              />
            </div>

            {/* Source Mode Toggles & Video Selection */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <div style={{ display: "flex", background: "#161920", border: "1px solid #303746", borderRadius: "4px", padding: "2px" }}>
                <button
                  type="button"
                  onClick={() => setSourceMode("video")}
                  style={{
                    padding: "0.25rem 0.6rem",
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    background: sourceMode === "video" ? "#222733" : "transparent",
                    color: sourceMode === "video" ? "#F4F5F7" : "#9299A8",
                    border: "none",
                    borderRadius: "3px",
                    cursor: "pointer",
                  }}
                >
                  {t("actions.uploadVideo", "Upload Video")}
                </button>
                <button
                  type="button"
                  onClick={() => setSourceMode("ip")}
                  style={{
                    padding: "0.25rem 0.6rem",
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    background: sourceMode === "ip" ? "#222733" : "transparent",
                    color: sourceMode === "ip" ? "#F4F5F7" : "#9299A8",
                    border: "none",
                    borderRadius: "3px",
                    cursor: "pointer",
                  }}
                >
                  {t("actions.ipCamera", "IP Camera")}
                </button>
              </div>

              {sourceMode === "video" && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flex: 1, minWidth: "220px" }}>
                  <select
                    value={currentSelectedVideoName}
                    onChange={(e) => handleVideoChange(e.target.value)}
                    style={{
                      flex: 1,
                      padding: "0.3rem 0.5rem",
                      fontSize: "0.75rem",
                      background: "#161920",
                      color: "#F4F5F7",
                      border: "1px solid #303746",
                      borderRadius: "4px",
                      outline: "none",
                      cursor: "pointer",
                    }}
                  >
                    {videoList.length > 0 ? (
                      videoList.map((v) => {
                        const fname = typeof v === "string" ? v : (v?.filename || "video.mp4");
                        const size = typeof v === "object" && v?.size_mb ? ` (${v.size_mb} MB)` : "";
                        return (
                          <option key={fname} value={fname}>
                            {fname}{size}
                          </option>
                        );
                      })
                    ) : (
                      <option value={currentSelectedVideoName}>{currentSelectedVideoName}</option>
                    )}
                  </select>

                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.3rem",
                      padding: "0.3rem 0.6rem",
                      fontSize: "0.6875rem",
                      fontWeight: 700,
                      background: "#1A1E26",
                      color: "#F4F5F7",
                      border: "1px solid #303746",
                      borderRadius: "4px",
                      cursor: isUploading ? "wait" : "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {isUploading ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Upload size={12} />
                    )}
                    {t("actions.uploadFile", "Upload File")}
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleFileUpload}
                      disabled={isUploading}
                      style={{ display: "none" }}
                    />
                  </label>
                </div>
              )}

              {sourceMode === "ip" && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flex: 1, minWidth: "220px" }}>
                  <input
                    type="text"
                    value={rtspUrl}
                    onChange={(e) => setRtspUrl(e.target.value)}
                    placeholder="rtsp://host:port/stream"
                    style={{
                      flex: 1,
                      padding: "0.3rem 0.5rem",
                      fontSize: "0.75rem",
                      fontFamily: "var(--font-mono, monospace)",
                      background: "#161920",
                      color: "#F4F5F7",
                      border: "1px solid #303746",
                      borderRadius: "4px",
                      outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleStartCamera}
                    style={{
                      padding: "0.3rem 0.6rem",
                      fontSize: "0.6875rem",
                      fontWeight: 700,
                      background: "#222733",
                      color: "#F4F5F7",
                      border: "1px solid #303746",
                      borderRadius: "4px",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Connect
                  </button>
                </div>
              )}
            </div>
            {urlError && (
              <span style={{ fontSize: "0.6875rem", color: "#FF5B6E" }}>{urlError}</span>
            )}
          </div>

          {/* 3. Telemetry Block */}
          <div
            style={{
              background: "#13161C",
              border: "1px solid #303746",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            {/* Top Telemetry Row: VEHICLES, TRAFFIC, INCIDENTS */}
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", borderBottom: "1px solid #303746" }}>
              <div style={{ padding: "0.75rem 0.85rem", borderRight: "1px solid #303746", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#9299A8", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {t("traffic.vehicles", "VEHICLES")}
                </span>
                <span style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--font-mono, monospace)", color: "#F4F5F7", lineHeight: 1.1 }}>
                  {valVehicles != null ? valVehicles : "—"}
                </span>
              </div>

              <div style={{ padding: "0.75rem 0.85rem", borderRight: "1px solid #303746", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#9299A8", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {t("traffic.flow", "TRAFFIC")}
                </span>
                <span style={{ fontSize: "1.05rem", fontWeight: 700, fontFamily: "var(--font-mono, monospace)", color: "#F4F5F7", lineHeight: 1.35 }}>
                  {valFlow != null ? valFlow : "—"}
                </span>
              </div>

              <div
                style={{
                  padding: "0.75rem 0.85rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.2rem",
                }}
              >
                <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#9299A8", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {t("cctv.incidents", "INCIDENTS")}
                </span>
                <span
                  style={{
                    fontSize: locationIncidents.length > 0 ? "1.05rem" : "1.25rem",
                    fontWeight: 700,
                    fontFamily: "var(--font-mono, monospace)",
                    color: locationIncidents.length > 0 ? "#FF5B6E" : "#737987",
                    lineHeight: 1.35,
                  }}
                >
                  {locationIncidents.length > 0 ? `${locationIncidents.length} ${t("cctv.active", "Active")}` : t("cctv.none", "None")}
                </span>
              </div>
            </div>

            {/* Breakdown Row: CARS, TRUCKS, BUSES, BIKES */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
              <div style={{ padding: "0.6rem 0.75rem", borderRight: "1px solid #303746", display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                <span style={{ fontSize: "0.625rem", fontWeight: 700, color: "#9299A8", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  {t("traffic.cars", "CARS")}
                </span>
                <span style={{ fontSize: "1.15rem", fontWeight: 700, fontFamily: "var(--font-mono, monospace)", color: "#F4F5F7" }}>
                  {valCars != null ? valCars : "—"}
                </span>
              </div>

              <div style={{ padding: "0.6rem 0.75rem", borderRight: "1px solid #303746", display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                <span style={{ fontSize: "0.625rem", fontWeight: 700, color: "#9299A8", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  {t("traffic.trucks", "TRUCKS")}
                </span>
                <span style={{ fontSize: "1.15rem", fontWeight: 700, fontFamily: "var(--font-mono, monospace)", color: "#F4F5F7" }}>
                  {valTrucks != null ? valTrucks : "—"}
                </span>
              </div>

              <div style={{ padding: "0.6rem 0.75rem", borderRight: "1px solid #303746", display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                <span style={{ fontSize: "0.625rem", fontWeight: 700, color: "#9299A8", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  {t("traffic.buses", "BUSES")}
                </span>
                <span style={{ fontSize: "1.15rem", fontWeight: 700, fontFamily: "var(--font-mono, monospace)", color: "#F4F5F7" }}>
                  {valBuses != null ? valBuses : "—"}
                </span>
              </div>

              <div style={{ padding: "0.6rem 0.75rem", display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                <span style={{ fontSize: "0.625rem", fontWeight: 700, color: "#9299A8", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  {t("traffic.bikes", "BIKES")}
                </span>
                <span style={{ fontSize: "1.15rem", fontWeight: 700, fontFamily: "var(--font-mono, monospace)", color: "#F4F5F7" }}>
                  {valBikes != null ? valBikes : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Operational Incident Status Area (No colored borders, no card boxes, clean and simple) */}
          <div style={{ padding: "0.45rem 0", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {locationIncidents.length === 0 ? (
              // Status summary when NO incident is detected
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <div style={{ fontSize: "0.6875rem", fontWeight: 800, color: "#9299A8", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  {t("cctv.trafficIncident", "TRAFFIC INCIDENT")}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.18rem", fontSize: "0.75rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#9299A8" }}>{t("traffic.status", "Status")}</span>
                    <span style={{ color: "#22C55E", fontWeight: 700 }}>{t("cctv.noAccidentDetected", "NO ACCIDENT DETECTED")}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#9299A8" }}>{t("cctv.emergency", "Emergency")}</span>
                    <span style={{ color: "#22C55E", fontWeight: 700 }}>{t("cctv.noAmbulanceDetected", "NO AMBULANCE DETECTED")}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#9299A8" }}>{t("traffic.flow", "Traffic")}</span>
                    <span style={{ color: "#22C55E", fontWeight: 700 }}>{t("status.normal", "NORMAL")}</span>
                  </div>
                </div>
              </div>
            ) : (
              // When one or more incidents / emergencies are detected
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                {locationIncidents.map((inc, idx) => {
                  const isAmbulance = (inc.type || inc.title || "").toLowerCase().includes("ambulance");
                  const headline = isAmbulance
                    ? t("cctv.ambulanceDetected", "AMBULANCE DETECTED")
                    : getAccidentHeadline(inc).includes("BIKE")
                    ? t("cctv.bikeAccidentDetected", "BIKE ACCIDENT DETECTED")
                    : t("cctv.accidentDetected", "ACCIDENT DETECTED");
                  const titleCategory = isAmbulance
                    ? t("cctv.emergencyVehicle", "EMERGENCY VEHICLE")
                    : t("cctv.trafficIncident", "TRAFFIC INCIDENT");
                  const titleColor = "#F59E0B";

                  return (
                    <div
                      key={inc.id || idx}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.25rem",
                        paddingBottom: idx < locationIncidents.length - 1 ? "0.65rem" : "0",
                        borderBottom: idx < locationIncidents.length - 1 ? "1px solid #2C303C" : "none",
                      }}
                    >
                      <div style={{ fontSize: "0.6875rem", fontWeight: 800, color: titleColor, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                        {titleCategory}
                      </div>
                      <div style={{ fontSize: "0.9375rem", fontWeight: 900, color: titleColor, textTransform: "uppercase", letterSpacing: "0.02em" }}>
                        {headline}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#F4F5F7", fontWeight: 700 }}>
                        {tJunction ? tJunction(inc.junction || inc.location || currentJunction?.name || locationTitle) : (inc.junction || inc.location || currentJunction?.name || locationTitle)} · {formatIncidentTime(inc.timestamp)}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#A0A5B5", lineHeight: 1.4 }}>
                        {inc.reason || inc.description || t("cctv.movementAffected", "Traffic movement affected.")}
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (onNavigateTab) onNavigateTab("map");
                            if (onSelectJunction && currentJunction) onSelectJunction(currentJunction);
                          }}
                          style={{
                            height: "28px",
                            padding: "0 0.85rem",
                            fontSize: "0.6875rem",
                            fontWeight: 800,
                            letterSpacing: "0.04em",
                            background: "#222733",
                            color: "#7B8BC8",
                            border: "1px solid #3D3F4E",
                            borderRadius: "3px",
                            cursor: "pointer",
                          }}
                        >
                          {t("actions.viewLocation", "VIEW LOCATION")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setStreamNonce(Date.now())}
                          style={{
                            height: "28px",
                            padding: "0 0.85rem",
                            fontSize: "0.6875rem",
                            fontWeight: 800,
                            letterSpacing: "0.04em",
                            background: "#222733",
                            color: "#F4F5F7",
                            border: "1px solid #3D3F4E",
                            borderRadius: "3px",
                            cursor: "pointer",
                          }}
                        >
                          {t("actions.viewCCTV", "VIEW CCTV")}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 5. Expandable Details */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginTop: "0.25rem" }}>
            {/* Toggle Line: Camera details */}
            <div style={{ borderTop: "1px solid #303746", paddingTop: "0.35rem" }}>
              <button
                type="button"
                onClick={() => setIsInfoExpanded(!isInfoExpanded)}
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "none",
                  border: "none",
                  padding: "0.35rem 0.1rem",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#9299A8" }}>
                  Camera details
                </span>
                <span style={{ fontSize: "0.6875rem", color: "#7C8FD8", fontWeight: 600 }}>
                  {isInfoExpanded ? "Hide \u25B4" : "Show \u25BE"}
                </span>
              </button>

              {isInfoExpanded && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "0.6rem",
                    padding: "0.6rem 0.75rem",
                    background: "#13161C",
                    border: "1px solid #303746",
                    borderRadius: "4px",
                    marginTop: "0.25rem",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                    <span style={{ fontSize: "0.625rem", color: "#9299A8", textTransform: "uppercase", fontWeight: 600 }}>Location</span>
                    <span style={{ fontSize: "0.75rem", color: "#F4F5F7" }}>{locationTitle}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                    <span style={{ fontSize: "0.625rem", color: "#9299A8", textTransform: "uppercase", fontWeight: 600 }}>Status</span>
                    <span style={{ fontSize: "0.75rem", color: statusColor, fontWeight: 700 }}>{statusText}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                    <span style={{ fontSize: "0.625rem", color: "#9299A8", textTransform: "uppercase", fontWeight: 600 }}>Source</span>
                    <span style={{ fontSize: "0.75rem", color: "#F4F5F7", fontFamily: "var(--font-mono, monospace)" }}>
                      {sourceMode === "ip" ? rtspUrl : currentSelectedVideoName}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                    <span style={{ fontSize: "0.625rem", color: "#9299A8", textTransform: "uppercase", fontWeight: 600 }}>Updated</span>
                    <span style={{ fontSize: "0.75rem", color: "#F4F5F7", fontFamily: "var(--font-mono, monospace)" }}>{lastUpdatedTime}</span>
                  </div>
                </div>
              )}
            </div>


          </div>
        </div>
      </div>
    </div>
  );
}
