import React, { useState, useEffect, useMemo } from "react";
import { Loader2, Upload } from "lucide-react";
import { getStreamUrl, getVideosList, uploadVideoFile, getCameraTelemetry, startCameraAnalysis, stopCameraAnalysis } from "../api";
import { trafficService } from "../services/trafficService";

export default function CCTVPanel({
  telemetry,
  cameraStatus,
  onStartCamera,
  onStopCamera,
  onStartAnalysis,
  onStopAnalysis,
  isLoadingAction = false,
  activeCameraId = "CCTV-SKG-01",
  onSelectCamera,
  selectedJunction = null,
  onTelemetryUpdate = null,
  areaJunctions = [],
  onSelectJunction = null,
}) {
  const [sourceMode, setSourceMode] = useState("video"); // "video" | "ip"
  const [videoList, setVideoList] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState("Traffic.mp4");
  const [rtspUrl, setRtspUrl] = useState("rtsp://10.161.12.181:1945/");
  const [urlError, setUrlError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [streamNonce, setStreamNonce] = useState(Date.now());
  const [liveTelemetry, setLiveTelemetry] = useState(telemetry);
  const [analysisActive, setAnalysisActive] = useState(false);
  const [isStartingAnalysis, setIsStartingAnalysis] = useState(false);

  const isOnline = cameraStatus === "online";

  // Keep liveTelemetry synced with parent telemetry when provided
  useEffect(() => {
    if (telemetry) setLiveTelemetry(telemetry);
  }, [telemetry]);

  // High-frequency telemetry polling (750ms) while camera is online to ensure metric cards match live frame
  useEffect(() => {
    if (!isOnline) {
      setLiveTelemetry(null);
      setStreamError(false);
      setAnalysisActive(false);
      return;
    }
    const interval = setInterval(async () => {
      try {
        const res = await getCameraTelemetry(activeCameraId);
        if (res?.is_analyzing !== undefined) {
          setAnalysisActive(Boolean(res.is_analyzing));
        } else if (res?.telemetry) {
          setAnalysisActive(true);
        }
        if (res?.telemetry) {
          setLiveTelemetry(res.telemetry);
          if (onTelemetryUpdate) onTelemetryUpdate(res.telemetry);
        } else if (res && res.is_analyzing === false) {
          setLiveTelemetry(null);
        }
      } catch (e) {}
    }, 750);
    return () => clearInterval(interval);
  }, [isOnline, activeCameraId]);

  // Reset stream nonce and retry count when camera becomes online or changes
  useEffect(() => {
    if (isOnline) {
      setStreamNonce(Date.now());
      setStreamError(false);
      setRetryCount(0);
    }
  }, [isOnline, activeCameraId]);

  // Load available sample videos on mount
  useEffect(() => {
    getVideosList()
      .then((res) => {
        if (res?.videos) setVideoList(res.videos);
      })
      .catch(() => {});
  }, []);

  // Auto start camera feed whenever activeCameraId or selectedJunction changes
  useEffect(() => {
    let active = true;
    const autoInit = async () => {
      if (!onStartCamera) return;
      try {
        let chosenVideo = selectedVideo || "Traffic.mp4";
        const vData = await getVideosList().catch(() => null);
        if (vData?.videos && vData.videos.length > 0) {
          if (active) setVideoList(vData.videos);
          const list = vData.videos.map((v) => (typeof v === "string" ? v : v.filename));
          const jName = (selectedJunction?.name || "").toLowerCase();
          const cId = (activeCameraId || "").toLowerCase();
          const matched = list.find((v) => {
            const vl = v.toLowerCase();
            return (jName && vl.includes(jName)) || (cId && vl.includes(cId));
          });
          if (matched) chosenVideo = matched;
          else {
            const num = (activeCameraId || "").match(/\d+/);
            const idx = num ? parseInt(num[0], 10) - 1 : 0;
            chosenVideo = list[Math.abs(idx) % list.length] || "Traffic.mp4";
          }
          if (active) setSelectedVideo(chosenVideo);
        }
        await onStartCamera(activeCameraId, { video: chosenVideo, auto_analysis: true });
      } catch (e) {
        console.warn("Auto-start camera notice:", e);
      }
    };
    autoInit();
    return () => {
      active = false;
    };
  }, [activeCameraId, selectedJunction]);

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
    setSelectedVideo(newVideo);
    if (isOnline && onStartCamera) {
      setStreamError(false);
      setRetryCount(0);
      setStreamNonce(Date.now());
      onStartCamera(activeCameraId, { video: newVideo, auto_analysis: true });
    }
  };

  const handleStartCamera = async () => {
    setStreamError(false);
    setRetryCount(0);
    setUrlError("");
    setStreamNonce(Date.now());
    if (sourceMode === "video") {
      setAnalysisActive(true);
    }
    if (onStartCamera) {
      if (sourceMode === "video") {
        try {
          await onStartCamera(activeCameraId, { video: selectedVideo, auto_analysis: true });
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
          await onStartCamera(activeCameraId, { source: trimmed, source_type: "rtsp", auto_analysis: true });
        } catch (err) {
          console.error("RTSP camera start failed:", err);
          setUrlError(err?.message || "Failed to connect to RTSP camera stream.");
        }
      } else {
        try {
          await onStartCamera(activeCameraId);
        } catch (err) {
          console.error("Camera start failed:", err);
        }
      }
    }
  };

  const handleStartAnalysis = async () => {
    setIsStartingAnalysis(true);
    try {
      if (onStartAnalysis) {
        await onStartAnalysis(activeCameraId);
      } else {
        await startCameraAnalysis(activeCameraId);
      }
      setAnalysisActive(true);
      setStreamNonce(Date.now());
    } catch (e) {
      console.error("Start analysis error:", e);
      setAnalysisActive(true);
    } finally {
      setIsStartingAnalysis(false);
    }
  };

  const handleStopAll = () => {
    setAnalysisActive(false);
    setLiveTelemetry(null);
    if (onStopCamera) {
      onStopCamera(activeCameraId);
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

  const isConnecting = isLoadingAction || cameraStatus === "connecting" || cameraStatus === "starting";
  const isError = (streamError && !isConnecting) || cameraStatus === "error";
  const isDisconnected = cameraStatus === "disconnected";
  const isStopped = cameraStatus === "stopped";

  // Status mapping: READY | LIVE | OFFLINE | CAMERA UNAVAILABLE
  let statusText = "READY";
  let statusColor = "var(--text-muted, #737987)";
  if (isConnecting) {
    statusText = "CONNECTING";
    statusColor = "var(--status-high, #F59E0B)";
  } else if (isOnline && !isError) {
    statusText = "LIVE";
    statusColor = "var(--status-normal, #22C55E)";
  } else if (isError) {
    statusText = "CAMERA UNAVAILABLE";
    statusColor = "var(--status-critical, #F45E70)";
  } else if (isDisconnected) {
    statusText = "OFFLINE";
    statusColor = "var(--status-critical, #F45E70)";
  } else if (isStopped) {
    statusText = "READY";
    statusColor = "var(--text-muted, #737987)";
  }

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

  // Real measurements from live telemetry only when analysis is active
  const effectiveTelemetry = isOnline && isAnalysisRunning ? (liveTelemetry || telemetry) : null;

  const valVehicles = (effectiveTelemetry && (effectiveTelemetry.total_tracked != null || effectiveTelemetry.vehicle_count != null || effectiveTelemetry.active_tracks != null || effectiveTelemetry.total != null))
    ? (effectiveTelemetry.total_tracked ?? effectiveTelemetry.vehicle_count ?? effectiveTelemetry.active_tracks ?? effectiveTelemetry.total)
    : null;

  const valCars = (effectiveTelemetry && (effectiveTelemetry.cars != null || effectiveTelemetry.vehicles?.car != null || effectiveTelemetry.vehicle_breakdown?.car != null || effectiveTelemetry.class_counts?.car != null))
    ? (effectiveTelemetry.cars ?? effectiveTelemetry.vehicles?.car ?? effectiveTelemetry.vehicle_breakdown?.car ?? effectiveTelemetry.class_counts?.car)
    : null;

  const valTrucks = (effectiveTelemetry && (effectiveTelemetry.trucks != null || effectiveTelemetry.vehicles?.truck != null || effectiveTelemetry.vehicle_breakdown?.truck != null || effectiveTelemetry.class_counts?.truck != null))
    ? (effectiveTelemetry.trucks ?? effectiveTelemetry.vehicles?.truck ?? effectiveTelemetry.vehicle_breakdown?.truck ?? effectiveTelemetry.class_counts?.truck)
    : null;

  const valBuses = (effectiveTelemetry && (effectiveTelemetry.buses != null || effectiveTelemetry.vehicles?.bus != null || effectiveTelemetry.vehicle_breakdown?.bus != null || effectiveTelemetry.class_counts?.bus != null))
    ? (effectiveTelemetry.buses ?? effectiveTelemetry.vehicles?.bus ?? effectiveTelemetry.vehicle_breakdown?.bus ?? effectiveTelemetry.class_counts?.bus)
    : null;

  const valBikes = (effectiveTelemetry && (effectiveTelemetry.bikes != null || effectiveTelemetry.vehicles?.bike != null || effectiveTelemetry.vehicles?.motorcycle != null || effectiveTelemetry.vehicle_breakdown?.bike != null || effectiveTelemetry.class_counts?.bike != null || effectiveTelemetry.class_counts?.motorcycle != null))
    ? (effectiveTelemetry.bikes ?? effectiveTelemetry.vehicles?.bike ?? effectiveTelemetry.vehicles?.motorcycle ?? effectiveTelemetry.vehicle_breakdown?.bike ?? effectiveTelemetry.class_counts?.bike ?? effectiveTelemetry.class_counts?.motorcycle)
    : null;

  const rawFlow = effectiveTelemetry?.flow_per_minute ?? effectiveTelemetry?.traffic_flow_vpm;
  const valFlow = rawFlow != null ? `${rawFlow.toFixed(0)}/min` : null;

  const streamSrc = `${getStreamUrl(activeCameraId)}?t=${streamNonce}`;

  // Default cameras list with approach labels
  const defaultNearby = [
    { id: "CCTV-SKG-01", name: "Sankagiri Junction Main Approach", status: "LIVE" },
    { id: "CCTV-SKG-02", name: "South Outflow (Erode)", status: "LIVE" },
    { id: "CCTV-SKG-03", name: "East Toll Plaza", status: "LIVE" },
    { id: "CCTV-SKG-04", name: "West Bypass", status: "OFFLINE" },
  ];

  const availableCameras = (selectedJunction?.cameras && selectedJunction.cameras.length > 0)
    ? selectedJunction.cameras.map((c) => ({
        id: c.id,
        name: c.approach || c.name || "Corridor Approach",
        status: activeCameraId === c.id
          ? (isOnline ? "LIVE" : "OFFLINE")
          : (c.status === "ONLINE" || c.status === "LIVE" ? "LIVE" : "OFFLINE"),
      }))
    : defaultNearby;

  const activeCamObj = availableCameras.find((c) => c.id === activeCameraId) || {
    id: activeCameraId,
    name: selectedJunction ? `${selectedJunction.name} Approach` : "Corridor Approach",
    status: isOnline ? "LIVE" : "OFFLINE",
  };

  // Combined statewide and monitored junctions list
  const allAvailableJunctions = useMemo(() => {
    const list = [...(trafficService.allJunctions || []), ...(areaJunctions || [])];
    const unique = new Map();
    list.forEach((j) => {
      if (!j || !j.name) return;
      const key = (j.name || j.id || "").trim().toLowerCase();
      if (!unique.has(key)) {
        unique.set(key, j);
      }
    });
    return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [areaJunctions]);

  return (
    <div
      style={{
        background: "var(--bg-surface, #1B2028)",
        border: "1px solid var(--border-default, #3D3F4E)",
        borderRadius: "4px",
        padding: "0.875rem 1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* 1. COMPACT JUNCTION SELECTOR DROPDOWN */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        <select
          value={selectedJunction?.id || ""}
          onChange={(e) => {
            const jId = e.target.value;
            const jnc = allAvailableJunctions.find((j) => j.id === jId || (j.cameras || []).some((c) => c.id === jId));
            if (jnc) {
              if (onSelectJunction) onSelectJunction(jnc);
              const firstCam = jnc.cameras?.[0]?.id;
              if (firstCam && onSelectCamera) onSelectCamera(firstCam);
            }
          }}
          aria-label="Select Junction"
          style={{
            width: "100%",
            height: "32px",
            padding: "0 0.65rem",
            fontSize: "0.8125rem",
            fontWeight: 700,
            border: "1px solid var(--border-default, #3D3F4E)",
            borderRadius: "4px",
            background: "var(--bg-surface-elevated, #252936)",
            color: "var(--text-primary, #F4F5F7)",
            cursor: "pointer",
          }}
        >
          <option value="" disabled>Select Junction...</option>
          {allAvailableJunctions.map((j) => (
            <option key={j.id} value={j.id}>
              {j.name}
            </option>
          ))}
        </select>

        {/* 2. CAMERA APPROACH SELECTOR (Only if junction has multiple cameras) */}
        {selectedJunction?.cameras && selectedJunction.cameras.length > 1 && (
          <select
            value={activeCameraId}
            onChange={(e) => {
              if (onSelectCamera) onSelectCamera(e.target.value);
            }}
            aria-label="Select Camera Approach"
            style={{
              width: "100%",
              height: "28px",
              padding: "0 0.5rem",
              fontSize: "0.75rem",
              fontWeight: 600,
              border: "1px solid var(--border-default, #3D3F4E)",
              borderRadius: "4px",
              background: "var(--bg-surface-secondary, #252936)",
              color: "var(--text-secondary, #A7ACB8)",
              cursor: "pointer",
            }}
          >
            {selectedJunction.cameras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.approach || c.name || c.id}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* 3. MODE SWITCH: UPLOAD VIDEO | IP CAMERA */}
      <div style={{ display: "flex", gap: "0.35rem" }}>
        <button
          type="button"
          onClick={() => {
            setSourceMode("video");
            if (onSelectCamera) onSelectCamera(selectedJunction?.cameras?.[0]?.id || activeCameraId || "CCTV-TPR-01");
          }}
          style={{
            flex: 1,
            height: "28px",
            padding: "0 0.5rem",
            fontSize: "0.6875rem",
            fontWeight: 800,
            letterSpacing: "0.03em",
            border: sourceMode === "video" ? "1px solid var(--accent-soft-blue, #7B8BC8)" : "1px solid var(--border-default, #3D3F4E)",
            borderRadius: "4px",
            background: sourceMode === "video" ? "var(--accent-indigo, #3E4776)" : "transparent",
            color: sourceMode === "video" ? "var(--text-primary, #F4F5F7)" : "var(--text-secondary, #A7ACB8)",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          UPLOAD VIDEO
        </button>

        <button
          type="button"
          onClick={() => {
            setSourceMode("ip");
            if (onSelectCamera) onSelectCamera("CCTV-IP-01");
          }}
          style={{
            flex: 1,
            height: "28px",
            padding: "0 0.5rem",
            fontSize: "0.6875rem",
            fontWeight: 800,
            letterSpacing: "0.03em",
            border: sourceMode === "ip" ? "1px solid var(--accent-soft-blue, #7B8BC8)" : "1px solid var(--border-default, #3D3F4E)",
            borderRadius: "4px",
            background: sourceMode === "ip" ? "var(--accent-indigo, #3E4776)" : "transparent",
            color: sourceMode === "ip" ? "var(--text-primary, #F4F5F7)" : "var(--text-secondary, #A7ACB8)",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          IP CAMERA
        </button>
      </div>

      {/* Mode Controls: Video Dropdown + Upload MP4 OR RTSP URL */}
      {sourceMode === "video" && (
        <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
          <select
            value={selectedVideo}
            onChange={(e) => handleVideoChange(e.target.value)}
            style={{
              flex: 1,
              height: "30px",
              padding: "0 0.5rem",
              fontSize: "0.75rem",
              border: "1px solid var(--border-default, #3D3F4E)",
              borderRadius: "4px",
              background: "var(--bg-surface-elevated, #252936)",
              color: "var(--text-primary, #F4F5F7)",
            }}
          >
            <option value="Traffic.mp4">Traffic.mp4 (Sankagiri Inflow)</option>
            <option value="Traffic2.mp4">Traffic2.mp4 (Salem Corridor)</option>
            <option value="Traffic3.mp4">Traffic3.mp4 (Erode Radial)</option>
            {videoList
              .filter((v) => {
                const fname = typeof v === "string" ? v : v?.filename;
                return !["Traffic.mp4", "Traffic2.mp4", "Traffic3.mp4"].includes(fname);
              })
              .map((v) => {
                const fname = typeof v === "string" ? v : (v?.filename || "video.mp4");
                const size = typeof v === "object" && v?.size_mb ? ` (${v.size_mb} MB)` : "";
                return (
                  <option key={fname} value={fname}>
                    {fname}{size}
                  </option>
                );
              })}
          </select>

          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.3rem",
              height: "30px",
              padding: "0 0.65rem",
              background: "var(--bg-surface-elevated, #252936)",
              border: "1px solid var(--border-default, #3D3F4E)",
              borderRadius: "4px",
              fontSize: "0.6875rem",
              fontWeight: 700,
              cursor: "pointer",
              color: "var(--text-secondary, #A7ACB8)",
              whiteSpace: "nowrap",
            }}
          >
            <Upload size={12} />
            <span>{isUploading ? "Uploading..." : "Upload MP4"}</span>
            <input type="file" accept="video/mp4,video/avi,video/mov" onChange={handleFileUpload} style={{ display: "none" }} />
          </label>
        </div>
      )}

      {sourceMode === "ip" && (
        <div>
          <input
            type="text"
            placeholder="rtsp://10.203.2.136:1945/"
            value={rtspUrl}
            onChange={(e) => {
              setRtspUrl(e.target.value);
              if (urlError) setUrlError("");
            }}
            style={{
              width: "100%",
              height: "30px",
              padding: "0 0.5rem",
              fontSize: "0.75rem",
              border: urlError ? "1px solid var(--status-critical, #F45E70)" : "1px solid var(--border-default, #3D3F4E)",
              borderRadius: "4px",
              background: "var(--bg-surface-elevated, #252936)",
              fontFamily: "var(--font-mono)",
              color: "var(--text-primary, #F4F5F7)",
              boxSizing: "border-box",
            }}
          />
          {urlError && (
            <div style={{ fontSize: "0.6875rem", color: "var(--status-critical, #F45E70)", marginTop: "2px", fontWeight: 600 }}>
              {urlError}
            </div>
          )}
        </div>
      )}

      {/* 4. VIDEO CANVAS (Dominating visual element) */}
      <div
        style={{
          position: "relative",
          width: "100%",
          minHeight: "240px",
          maxHeight: "320px",
          background: "#0d0f11",
          borderRadius: "4px",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid var(--border-default, #3D3F4E)",
        }}
      >
        {isOnline && !streamError ? (
          <>
            <img
              key={`${activeCameraId}-${streamNonce}`}
              src={streamSrc}
              alt="Live Camera Feed"
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
              onError={handleStreamError}
            />
            <div
              style={{
                position: "absolute",
                top: "8px",
                left: "8px",
                background: "rgba(17, 19, 21, 0.85)",
                color: "var(--status-normal, #22C55E)",
                fontSize: "10px",
                fontWeight: 800,
                padding: "2px 6px",
                borderRadius: "3px",
                letterSpacing: "0.05em",
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              LIVE
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "1.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
            {isConnecting || !isError ? (
              <>
                <Loader2 size={24} className="animate-spin" color="var(--accent-soft-blue, #7B8BC8)" />
                <div style={{ color: "var(--text-muted, #737987)", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.04em" }}>
                  CONNECTING TO LIVE FEED...
                </div>
              </>
            ) : (
              <>
                <div style={{ color: "var(--status-critical, #F45E70)", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.04em" }}>
                  CAMERA UNAVAILABLE
                </div>
                <button
                  type="button"
                  onClick={handleStartCamera}
                  style={{
                    padding: "0.25rem 0.65rem",
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    background: "var(--bg-surface-elevated, #252936)",
                    color: "var(--text-primary, #F4F5F7)",
                    border: "1px solid var(--border-default, #3D3F4E)",
                    borderRadius: "3px",
                    cursor: "pointer",
                  }}
                >
                  Retry
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 5. STOP / STATUS CONTROLS (Only when active) */}
      {isOnline && (
        <div>
          {!isAnalysisRunning ? (
            <button
            type="button"
            onClick={handleStartAnalysis}
            disabled={isLoadingAction || isStartingAnalysis}
            style={{
              width: "100%",
              height: "32px",
              padding: "0 1rem",
              background: "var(--status-normal, #22C55E)",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "4px",
              fontSize: "0.75rem",
              fontWeight: 800,
              letterSpacing: "0.04em",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              transition: "all 0.15s ease",
            }}
          >
            {isStartingAnalysis ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>STARTING ANALYSIS...</span>
              </>
            ) : (
              <span>START ANALYSIS</span>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStopAll}
            disabled={isLoadingAction}
            style={{
              width: "100%",
              height: "32px",
              padding: "0 1rem",
              background: "var(--status-critical, #F45E70)",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "4px",
              fontSize: "0.75rem",
              fontWeight: 800,
              letterSpacing: "0.04em",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              transition: "all 0.15s ease",
            }}
          >
            <span>STOP</span>
          </button>
        )}
      </div>
    )}

      {/* 6. TELEMETRY MEASUREMENTS (Clean 3x2 Grid with hairline divider, bold high-contrast text) */}
      <div style={{ borderTop: "1px solid var(--border-light, #2C303C)", paddingTop: "0.75rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem 0.5rem" }}>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary, #A0A5B5)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Vehicles
            </div>
            <div
              style={{
                fontSize: "1.375rem",
                fontWeight: 900,
                color: valVehicles != null ? "var(--text-primary, #F4F5F7)" : "var(--text-muted, #737987)",
                fontFamily: "var(--font-sans)",
                marginTop: "2px",
                lineHeight: 1.2,
              }}
            >
              {valVehicles != null ? valVehicles : "—"}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary, #A0A5B5)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Cars
            </div>
            <div
              style={{
                fontSize: "1.375rem",
                fontWeight: 900,
                color: valCars != null ? "var(--text-primary, #F4F5F7)" : "var(--text-muted, #737987)",
                fontFamily: "var(--font-sans)",
                marginTop: "2px",
                lineHeight: 1.2,
              }}
            >
              {valCars != null ? valCars : "—"}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary, #A0A5B5)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Trucks
            </div>
            <div
              style={{
                fontSize: "1.375rem",
                fontWeight: 900,
                color: valTrucks != null ? "var(--text-primary, #F4F5F7)" : "var(--text-muted, #737987)",
                fontFamily: "var(--font-sans)",
                marginTop: "2px",
                lineHeight: 1.2,
              }}
            >
              {valTrucks != null ? valTrucks : "—"}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary, #A0A5B5)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Buses
            </div>
            <div
              style={{
                fontSize: "1.375rem",
                fontWeight: 900,
                color: valBuses != null ? "var(--text-primary, #F4F5F7)" : "var(--text-muted, #737987)",
                fontFamily: "var(--font-sans)",
                marginTop: "2px",
                lineHeight: 1.2,
              }}
            >
              {valBuses != null ? valBuses : "—"}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary, #A0A5B5)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Bikes
            </div>
            <div
              style={{
                fontSize: "1.375rem",
                fontWeight: 900,
                color: valBikes != null ? "var(--text-primary, #F4F5F7)" : "var(--text-muted, #737987)",
                fontFamily: "var(--font-sans)",
                marginTop: "2px",
                lineHeight: 1.2,
              }}
            >
              {valBikes != null ? valBikes : "—"}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary, #A0A5B5)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Flow
            </div>
            <div
              style={{
                fontSize: "1.375rem",
                fontWeight: 900,
                color: valFlow != null ? "var(--text-primary, #F4F5F7)" : "var(--text-muted, #737987)",
                fontFamily: "var(--font-sans)",
                marginTop: "2px",
                lineHeight: 1.2,
              }}
            >
              {valFlow != null ? valFlow : "—"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
