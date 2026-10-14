import React, { useState, useEffect, useMemo, useRef } from "react";
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

const DEFAULT_VIDEOS = [
  "Traffic.mp4",
  "Traffic2.mp4",
  "Traffic3.mp4",
  "Traffic4.mp4",
  "video.mp4",
  "video1.mp4",
  "video2.mp4",
  "video3.mp4",
];

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
  const [videoList, setVideoList] = useState(DEFAULT_VIDEOS);
  const [rtspUrl, setRtspUrl] = useState("rtsp://10.161.12.181:1945/");
  const [urlError, setUrlError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [streamNonce, setStreamNonce] = useState(Date.now());
  const [liveTelemetry, setLiveTelemetry] = useState(telemetry);
  const [analysisActive, setAnalysisActive] = useState(false);
  const [isRtspConnected, setIsRtspConnected] = useState(false);
  const [lastUpdatedTime, setLastUpdatedTime] = useState("Just now");
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);
  const [incidentHovered, setIncidentHovered] = useState(false);

  // Guard refs to lock video selection and prevent telemetry-induced restart loops
  const hasInitializedRef = useRef(false);
  const prevJunctionIdRef = useRef(selectedJunction?.id);
  const prevCamIdRef = useRef(activeCameraId || "CCTV-TPR-01");
  const userSelectedVideoRef = useRef(null);

  const isOnline = cameraStatus === "online";
  const isFeedActive = sourceMode === "video" ? isOnline : (isOnline && isRtspConnected);

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
    if (sourceMode !== "video") return;

    const currentJunctionId = currentJunction?.id;
    const junctionChanged = prevJunctionIdRef.current !== currentJunctionId;
    const cameraChanged = prevCamIdRef.current !== activeCamId;

    if (hasInitializedRef.current && !junctionChanged && !cameraChanged) {
      return;
    }

    prevJunctionIdRef.current = currentJunctionId;
    prevCamIdRef.current = activeCamId;

    const initCameraFeed = async () => {
      let chosenVideo = userSelectedVideoRef.current || selectedVideo || "Traffic.mp4";
      try {
        const res = await getVideosList();
        if (res?.videos && res.videos.length > 0) {
          if (active) setVideoList(res.videos);
          const list = res.videos.map((v) => (typeof v === "string" ? v : v.filename));
          if (!userSelectedVideoRef.current) {
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
          } else {
            chosenVideo = userSelectedVideoRef.current;
          }
          if (active) setSelectedVideo(chosenVideo);
        }
      } catch (e) {}

      // Auto start camera if in video mode
      if (onStartCamera && sourceMode === "video") {
        try {
          await onStartCamera(activeCamId, { video: chosenVideo, auto_analysis: true });
          if (active) {
            hasInitializedRef.current = true;
            setAnalysisActive(true);
          }
        } catch (err) {
          console.error("Auto start camera failed:", err);
        }
      }
    };

    initCameraFeed();
    return () => {
      active = false;
    };
  }, [activeCamId, currentJunction?.id, sourceMode]);

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
        userSelectedVideoRef.current = file.name;
        setSelectedVideo(file.name);
        setActiveCamId(res.camera_id);
        if (onSelectCamera) onSelectCamera(res.camera_id);
        const vData = await getVideosList().catch(() => null);
        if (vData?.videos) setVideoList(vData.videos);
        if (onStartCamera) {
          setStreamError(false);
          setRetryCount(0);
          setStreamNonce(Date.now());
          await onStartCamera(res.camera_id, { video: file.name, auto_analysis: true });
          setAnalysisActive(true);
        }
      }
    } catch (err) {
      console.error("Video upload failed:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleVideoChange = async (newVideo) => {
    const fname = typeof newVideo === "string" ? newVideo : (newVideo?.filename || "Traffic.mp4");
    userSelectedVideoRef.current = fname;
    setSelectedVideo(fname);
    setLiveTelemetry(null);
    setStreamError(false);
    setRetryCount(0);
    if (onStartCamera) {
      try {
        await onStartCamera(activeCamId, { video: fname, auto_analysis: true });
        setStreamNonce(Date.now());
        setAnalysisActive(true);
      } catch (err) {
        console.error("Video switch failed:", err);
      }
    }
  };

  // Switching to IP Camera: immediately stop video, release capture, clear display and metrics
  const handleSwitchToIp = async () => {
    if (sourceMode === "ip") return;
    setSourceMode("ip");
    setIsRtspConnected(false);
    setUrlError("");
    setStreamError(false);
    setRetryCount(0);
    setAnalysisActive(false);
    setLiveTelemetry(null);
    if (onStopCamera) {
      await onStopCamera(activeCamId);
    }
    try {
      await stopCameraAnalysis(activeCamId).catch(() => null);
    } catch (e) {}
    setActiveCamId("CCTV-IP-01");
    if (onSelectCamera) onSelectCamera("CCTV-IP-01");
  };

  // Switching to Uploaded Video: immediately stop IP camera, clear state, auto start video
  const handleSwitchToVideo = async () => {
    if (sourceMode === "video") return;
    setSourceMode("video");
    setIsRtspConnected(false);
    setUrlError("");
    setStreamError(false);
    setRetryCount(0);
    setLiveTelemetry(null);
    if (onStopCamera) {
      await onStopCamera(activeCamId);
    }
    try {
      await stopCameraAnalysis(activeCamId).catch(() => null);
    } catch (e) {}
    const targetCamId = currentJunction?.cameras?.[0]?.id || "CCTV-TPR-01";
    setActiveCamId(targetCamId);
    if (onSelectCamera) onSelectCamera(targetCamId);
    if (onStartCamera) {
      const vName = userSelectedVideoRef.current || currentSelectedVideoName || "Traffic.mp4";
      try {
        await onStartCamera(targetCamId, { video: vName, auto_analysis: true });
        setStreamNonce(Date.now());
        setAnalysisActive(true);
      } catch (err) {
        console.error("Video start failed:", err);
      }
    }
  };

  const handleStartCamera = async () => {
    if (isConnecting) return;
    setUrlError("");
    setStreamError(false);
    setRetryCount(0);

    if (onStartCamera) {
      if (sourceMode === "video") {
        setLiveTelemetry(null);
        try {
          const videoName = userSelectedVideoRef.current || currentSelectedVideoName;
          await onStartCamera(activeCamId, { video: videoName, auto_analysis: true });
          setStreamNonce(Date.now());
          setAnalysisActive(true);
        } catch (err) {
          console.error("Video camera start failed:", err);
        }
      } else if (sourceMode === "ip") {
        const trimmed = rtspUrl.trim();
        if (!trimmed.toLowerCase().startsWith("rtsp://") && !trimmed.toLowerCase().startsWith("rtsps://") && !trimmed.toLowerCase().startsWith("http://") && !trimmed.toLowerCase().startsWith("https://")) {
          setUrlError("Invalid stream URL. Must begin with rtsp:// or http://");
          return;
        }
        setIsRtspConnected(false);
        setLiveTelemetry(null);
        try {
          await onStartCamera("CCTV-IP-01", { source: trimmed, source_type: "rtsp", auto_analysis: true });
          setActiveCamId("CCTV-IP-01");
          setIsRtspConnected(true);
          setStreamNonce(Date.now());
          setAnalysisActive(true);
        } catch (err) {
          console.error("RTSP camera start failed:", err);
          setIsRtspConnected(false);
          setUrlError(err?.message || "Failed to connect to RTSP camera stream. Verify mobile device is broadcasting.");
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
  const isError = (streamError && !isConnecting) || (cameraStatus === "error" && sourceMode !== "ip");

  let statusText = t("status.live", "LIVE");
  let statusColor = "#22C55E";
  if (isConnecting) {
    statusText = t("status.connecting", "CONNECTING");
    statusColor = "#D97706";
  } else if (sourceMode === "ip" && !isFeedActive) {
    statusText = t("status.standby", "STANDBY");
    statusColor = "#737987";
  } else if (isError) {
    statusText = t("status.unavailable", "CAMERA UNAVAILABLE");
    statusColor = "#EF4444";
  } else if (!isFeedActive) {
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

  const hasIncident = locationIncidents.length > 0;
  const hasAmbulance = Boolean(activeAmbulance);
  const hasAccident = Boolean(activeAccident);

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
    (isFeedActive && (sourceMode === "video" || hasTelemetryMetrics(liveTelemetry) || hasTelemetryMetrics(telemetry)))
  );

  const effTel = isFeedActive && isAnalysisRunning ? (liveTelemetry || telemetry) : null;

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
              border: "1px solid var(--border-default, #D8E0E8)",
              borderRadius: "4px",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Live stream image */}
            {isFeedActive && !isError ? (
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
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    borderRadius: "3px",
                  }}
                >
                  <div
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      background: "var(--status-normal, #22C55E)",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 800,
                      color: "#FFFFFF",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {t("status.live", "LIVE")}
                  </span>
                </div>
              </>
            ) : sourceMode === "ip" && !isConnecting && !streamError ? (
              /* Blank/standby display for IP Camera until stream connects */
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.5rem",
                  color: "#94A3B8",
                  padding: "1.5rem",
                }}
              >
                <div style={{ fontSize: "0.875rem", fontWeight: 700, letterSpacing: "0.05em" }}>
                  {t("cctv.ipCameraStandby", "IP CAMERA STANDBY")}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                  {t("cctv.enterRtspPrompt", "Enter RTSP stream URL and click Connect to start feed")}
                </div>
              </div>
            ) : isConnecting ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.75rem",
                  color: "var(--text-muted, #64748B)",
                }}
              >
                <Loader2 className="animate-spin" size={32} color="var(--accent, #245B86)" />
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#FFFFFF" }}>
                  {sourceMode === "ip"
                    ? t("cctv.connectingRtsp", "Connecting to RTSP stream...")
                    : t("cctv.connectingLiveFeed", "Connecting to live feed...")}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#9299A8" }}>
                  {t("cctv.initDetectionPipeline", "Initializing detection pipeline")}
                </div>
              </div>
            ) : isError ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.75rem",
                  color: "var(--status-critical, #C94B59)",
                }}
              >
                <div style={{ fontSize: "0.9375rem", fontWeight: 700 }}>
                  {t("cctv.cameraUnavailable", "CAMERA UNAVAILABLE")}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#9299A8" }}>
                  {t("cctv.failedConnectFeed", "Failed to connect to video feed")}
                </div>
                {sourceMode === "video" && (
                  <button
                    type="button"
                    onClick={handleStartCamera}
                    style={{
                      marginTop: "0.25rem",
                      padding: "0.35rem 0.85rem",
                      background: "var(--bg-surface-elevated, #222733)",
                      border: "1px solid var(--border-default, #303746)",
                      borderRadius: "3px",
                      color: "var(--text-primary, #F4F5F7)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {t("common.retry", "Retry")}
                  </button>
                )}
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.75rem",
                  color: "var(--text-muted, #64748B)",
                }}
              >
                <Loader2 className="animate-spin" size={32} color="var(--accent, #245B86)" />
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#FFFFFF" }}>
                  {t("cctv.loadingLiveFeed", "Loading live feed...")}
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
              borderBottom: "1px solid var(--border-default, #D8E0E8)",
              gap: "0.75rem",
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text-primary, #162334)", letterSpacing: "-0.01em" }}>
              {locationTitle}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
              <div
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: statusColor,
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
                onChange={async (e) => {
                  const newCamId = e.target.value;
                  setActiveCamId(newCamId);
                  if (onSelectCamera) onSelectCamera(newCamId);
                  setLiveTelemetry(null);
                  setStreamError(false);
                  setRetryCount(0);
                  if (onStartCamera) {
                    try {
                      const videoName = userSelectedVideoRef.current || currentSelectedVideoName;
                      await onStartCamera(newCamId, { video: videoName, auto_analysis: true });
                      setStreamNonce(Date.now());
                    } catch (err) {}
                  }
                }}
                style={{
                  width: "100%",
                  padding: "0.45rem 2rem 0.45rem 0.75rem",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  background: "var(--bg-input, #FFFFFF)",
                  color: "var(--text-primary, #162334)",
                  border: "1px solid var(--border-default, #D8E0E8)",
                  borderRadius: "4px",
                  appearance: "none",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                {junctionCameras.map((c) => (
                  <option key={c.id} value={c.id}>
                    {tJunction(c.approach || c.name || c.id)}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                color="var(--text-muted, #64748B)"
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
              <div style={{ display: "flex", background: "var(--bg-surface-secondary, #EEF2F6)", border: "1px solid var(--border-default, #D8E0E8)", borderRadius: "4px", padding: "2px" }}>
                <button
                  type="button"
                  onClick={handleSwitchToVideo}
                  style={{
                    padding: "0.25rem 0.6rem",
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    background: sourceMode === "video" ? "var(--accent, #245B86)" : "transparent",
                    color: sourceMode === "video" ? "#FFFFFF" : "var(--text-secondary, #344256)",
                    border: "none",
                    borderRadius: "3px",
                    cursor: "pointer",
                  }}
                >
                  {t("actions.uploadVideo", "Upload Video")}
                </button>
                <button
                  type="button"
                  onClick={handleSwitchToIp}
                  style={{
                    padding: "0.25rem 0.6rem",
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    background: sourceMode === "ip" ? "var(--accent, #245B86)" : "transparent",
                    color: sourceMode === "ip" ? "#FFFFFF" : "var(--text-secondary, #344256)",
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
                      background: "var(--bg-input, #FFFFFF)",
                      color: "var(--text-primary, #162334)",
                      border: "1px solid var(--border-default, #D8E0E8)",
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
                      background: "var(--bg-surface-secondary, #EEF2F6)",
                      color: "var(--text-primary, #162334)",
                      border: "1px solid var(--border-default, #D8E0E8)",
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
                    onChange={(e) => {
                      setRtspUrl(e.target.value);
                      if (urlError) setUrlError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isConnecting) {
                        e.preventDefault();
                        handleStartCamera();
                      }
                    }}
                    placeholder="rtsp://host:port/stream"
                    style={{
                      flex: 1,
                      padding: "0.3rem 0.5rem",
                      fontSize: "0.75rem",
                      fontFamily: "var(--font-mono, monospace)",
                      background: "var(--bg-input, #FFFFFF)",
                      color: "var(--text-primary, #162334)",
                      border: urlError ? "1px solid var(--state-red, #EF4444)" : "1px solid var(--border-default, #D8E0E8)",
                      borderRadius: "4px",
                      outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleStartCamera}
                    disabled={isConnecting}
                    style={{
                      padding: "0.3rem 0.75rem",
                      fontSize: "0.6875rem",
                      fontWeight: 700,
                      background: isConnecting ? "var(--border-default, #D8E0E8)" : "var(--accent, #245B86)",
                      color: "#FFFFFF",
                      border: "1px solid var(--accent, #245B86)",
                      borderRadius: "4px",
                      cursor: isConnecting ? "not-allowed" : "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {isConnecting ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <Loader2 size={12} className="animate-spin" />
                        {t("common.connecting", "Connecting...")}
                      </span>
                    ) : (
                      t("common.connect", "Connect")
                    )}
                  </button>
                </div>
              )}
            </div>
            {urlError && (
              <span style={{ fontSize: "0.6875rem", color: "var(--status-critical, #C94B59)" }}>{urlError}</span>
            )}
          </div>

          {/* 3. Telemetry Block */}
          <div
            style={{
              background: "var(--bg-card, #FFFFFF)",
              border: "1px solid var(--border-default, #D8E0E8)",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            {/* Top Telemetry Row: VEHICLES, TRAFFIC, INCIDENTS */}
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", borderBottom: "1px solid var(--border-light, #E7ECF1)" }}>
              <div style={{ padding: "0.75rem 0.85rem", borderRight: "1px solid var(--border-light, #E7ECF1)", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-muted, #64748B)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {t("traffic.vehicles", "VEHICLES")}
                </span>
                <span style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--font-mono, monospace)", color: "var(--text-primary, #162334)", lineHeight: 1.1 }}>
                  {valVehicles != null ? valVehicles : "—"}
                </span>
              </div>

              <div style={{ padding: "0.75rem 0.85rem", borderRight: "1px solid var(--border-light, #E7ECF1)", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-muted, #64748B)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {t("traffic.flow", "TRAFFIC")}
                </span>
                <span style={{ fontSize: "1.05rem", fontWeight: 700, fontFamily: "var(--font-mono, monospace)", color: "var(--text-primary, #162334)", lineHeight: 1.35 }}>
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
                <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-muted, #64748B)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {t("cctv.incidents", "INCIDENTS")}
                </span>
                <span
                  style={{
                    fontSize: locationIncidents.length > 0 ? "1.05rem" : "1.25rem",
                    fontWeight: 700,
                    fontFamily: "var(--font-mono, monospace)",
                    color: locationIncidents.length > 0 ? "var(--status-critical, #C94B59)" : "var(--text-muted, #64748B)",
                    lineHeight: 1.35,
                  }}
                >
                  {locationIncidents.length > 0 ? `${locationIncidents.length} ${t("cctv.active", "Active")}` : t("cctv.none", "None")}
                </span>
              </div>
            </div>

            {/* Breakdown Row: CARS, TRUCKS, BUSES, BIKES */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
              <div style={{ padding: "0.6rem 0.75rem", borderRight: "1px solid var(--border-light, #E7ECF1)", display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                <span style={{ fontSize: "0.625rem", fontWeight: 700, color: "var(--text-muted, #64748B)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  {t("traffic.cars", "CARS")}
                </span>
                <span style={{ fontSize: "1.15rem", fontWeight: 700, fontFamily: "var(--font-mono, monospace)", color: "var(--text-primary, #162334)" }}>
                  {valCars != null ? valCars : "—"}
                </span>
              </div>

              <div style={{ padding: "0.6rem 0.75rem", borderRight: "1px solid var(--border-light, #E7ECF1)", display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                <span style={{ fontSize: "0.625rem", fontWeight: 700, color: "var(--text-muted, #64748B)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  {t("traffic.trucks", "TRUCKS")}
                </span>
                <span style={{ fontSize: "1.15rem", fontWeight: 700, fontFamily: "var(--font-mono, monospace)", color: "var(--text-primary, #162334)" }}>
                  {valTrucks != null ? valTrucks : "—"}
                </span>
              </div>

              <div style={{ padding: "0.6rem 0.75rem", borderRight: "1px solid var(--border-light, #E7ECF1)", display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                <span style={{ fontSize: "0.625rem", fontWeight: 700, color: "var(--text-muted, #64748B)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  {t("traffic.buses", "BUSES")}
                </span>
                <span style={{ fontSize: "1.15rem", fontWeight: 700, fontFamily: "var(--font-mono, monospace)", color: "var(--text-primary, #162334)" }}>
                  {valBuses != null ? valBuses : "—"}
                </span>
              </div>

              <div style={{ padding: "0.6rem 0.75rem", display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                <span style={{ fontSize: "0.625rem", fontWeight: 700, color: "var(--text-muted, #64748B)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  {t("traffic.bikes", "BIKES")}
                </span>
                <span style={{ fontSize: "1.15rem", fontWeight: 700, fontFamily: "var(--font-mono, monospace)", color: "var(--text-primary, #162334)" }}>
                  {valBikes != null ? valBikes : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Operational Incident Status Area (Is Incident Occurred / Is Ambulance Detected / Is Accident Occurred) */}
          <div style={{ padding: "0.45rem 0", display: "flex", flexDirection: "column", gap: "0.55rem" }}>
            <div style={{ fontSize: "0.875rem", fontWeight: 900, color: "var(--text-muted, #64748B)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {t("cctv.trafficIncident", "TRAFFIC INCIDENT")}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", paddingTop: "0.2rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "1.0625rem", color: "var(--text-primary, #162334)", fontWeight: 800 }}>
                  {t("cctv.isIncidentOccurred", "Is Incident Occurred")}
                </span>
                <span
                  style={{
                    fontSize: "1.125rem",
                    color: hasIncident ? "var(--state-red, #C94B59)" : "var(--state-green, #2E8B57)",
                    fontWeight: 900,
                    letterSpacing: "0.04em",
                  }}
                >
                  {hasIncident ? t("common.yes", "YES") : t("common.no", "NO")}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "1.0625rem", color: "var(--text-primary, #162334)", fontWeight: 800 }}>
                  {t("cctv.isAmbulanceDetected", "Is Ambulance Detected")}
                </span>
                <span
                  style={{
                    fontSize: "1.125rem",
                    color: hasAmbulance ? "var(--state-amber, #B08A2E)" : "var(--state-green, #2E8B57)",
                    fontWeight: 900,
                    letterSpacing: "0.04em",
                  }}
                >
                  {hasAmbulance ? t("common.yes", "YES") : t("common.no", "NO")}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "1.0625rem", color: "var(--text-primary, #162334)", fontWeight: 800 }}>
                  {t("cctv.isAccidentOccurred", "Is Accident Occurred")}
                </span>
                <span
                  style={{
                    fontSize: "1.125rem",
                    color: hasAccident ? "var(--state-red, #C94B59)" : "var(--state-green, #2E8B57)",
                    fontWeight: 900,
                    letterSpacing: "0.04em",
                  }}
                >
                  {hasAccident ? t("common.yes", "YES") : t("common.no", "NO")}
                </span>
              </div>
            </div>
          </div>

          {/* 5. Expandable Details */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginTop: "0.25rem" }}>
            {/* Toggle Line: Camera details */}
            <div style={{ borderTop: "1px solid var(--border-default, #D8E0E8)", paddingTop: "0.35rem" }}>
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
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary, #344256)" }}>
                  {t("cctv.cameraDetails", "Camera details")}
                </span>
                <span style={{ fontSize: "0.6875rem", color: "var(--accent, #245B86)", fontWeight: 600 }}>
                  {isInfoExpanded ? `${t("cctv.hideDetails", "Hide")} \u25B4` : `${t("cctv.showDetails", "Show")} \u25BE`}
                </span>
              </button>

              {isInfoExpanded && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "0.6rem",
                    padding: "0.6rem 0.75rem",
                    background: "var(--bg-card-subtle, #F8FAFC)",
                    border: "1px solid var(--border-default, #D8E0E8)",
                    borderRadius: "4px",
                    marginTop: "0.25rem",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                    <span style={{ fontSize: "0.625rem", color: "var(--text-muted, #64748B)", textTransform: "uppercase", fontWeight: 600 }}>{t("cctv.location", "Location")}</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-primary, #162334)" }}>{locationTitle}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                    <span style={{ fontSize: "0.625rem", color: "var(--text-muted, #64748B)", textTransform: "uppercase", fontWeight: 600 }}>{t("cctv.status", "Status")}</span>
                    <span style={{ fontSize: "0.75rem", color: statusColor, fontWeight: 700 }}>{statusText}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                    <span style={{ fontSize: "0.625rem", color: "var(--text-muted, #64748B)", textTransform: "uppercase", fontWeight: 600 }}>{t("cctv.source", "Source")}</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-primary, #162334)", fontFamily: "var(--font-mono, monospace)" }}>
                      {sourceMode === "ip" ? rtspUrl : currentSelectedVideoName}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                    <span style={{ fontSize: "0.625rem", color: "var(--text-muted, #64748B)", textTransform: "uppercase", fontWeight: 600 }}>{t("cctv.updated", "Updated")}</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-primary, #162334)", fontFamily: "var(--font-mono, monospace)" }}>{lastUpdatedTime}</span>
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
