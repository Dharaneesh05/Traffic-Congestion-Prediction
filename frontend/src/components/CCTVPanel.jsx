import React, { useState, useEffect, useRef } from "react";
import {
  Video,
  Play,
  Square,
  Upload,
  Camera,
  Smartphone,
  Globe,
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { getStreamUrl, getBackendHost, getVideosList, uploadVideoFile, startCamera, stopCamera, pushFrameBytes } from "../api";

export default function CCTVPanel({
  telemetry,
  cameraStatus,
  onStartCamera,
  onStopCamera,
  isLoadingAction = false,
  activeCameraId = "CCTV-SKG-01",
  onSelectCamera,
}) {
  const [sourceMode, setSourceMode] = useState("video"); // "video" | "ip" | "mobile" | "webcam"
  const [videoList, setVideoList] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState("Traffic.mp4");
  const [rtspUrl, setRtspUrl] = useState("rtsp://demo:demo@192.168.1.100:554/stream1");
  const [isUploading, setIsUploading] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [webcamActive, setWebcamActive] = useState(false);
  const [webcamStatus, setWebcamStatus] = useState("idle");

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const webcamIntervalRef = useRef(null);

  const isOnline = cameraStatus === "online";
  const lanIp = getBackendHost();

  // Load available sample videos on mount
  useEffect(() => {
    getVideosList()
      .then((res) => {
        if (res?.videos) setVideoList(res.videos);
      })
      .catch(() => {});
  }, []);

  // WebCam Browser Streaming Loop
  const startBrowserWebcam = async () => {
    try {
      setWebcamStatus("requesting");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setWebcamActive(true);
      setWebcamStatus("streaming");

      // Register and start CCTV-WEBCAM-01
      await startCamera("CCTV-WEBCAM-01").catch(() => {});
      if (onSelectCamera) onSelectCamera("CCTV-WEBCAM-01");

      // Frame push interval (10 FPS)
      const canvas = canvasRef.current || document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext("2d");

      webcamIntervalRef.current = setInterval(() => {
        if (videoRef.current && videoRef.current.readyState >= 2) {
          ctx.drawImage(videoRef.current, 0, 0, 640, 480);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                blob.arrayBuffer().then((buf) => {
                  pushFrameBytes("CCTV-WEBCAM-01", new Uint8Array(buf)).catch(() => {});
                });
              }
            },
            "image/jpeg",
            0.7
          );
        }
      }, 100);
    } catch (err) {
      console.error("Webcam access error:", err);
      setWebcamStatus("error");
    }
  };

  const stopBrowserWebcam = () => {
    if (webcamIntervalRef.current) {
      clearInterval(webcamIntervalRef.current);
      webcamIntervalRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setWebcamActive(false);
    setWebcamStatus("idle");
    stopCamera("CCTV-WEBCAM-01").catch(() => {});
  };

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
        if (onSelectCamera) onSelectCamera(res.camera_id);
        getVideosList().then((v) => v?.videos && setVideoList(v.videos));
      }
    } catch (err) {
      console.error("Video upload failed:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const streamSrc = getStreamUrl(activeCameraId);

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">
            <Video size={16} color="var(--state-blue)" />
            {activeCameraId} • Live Video & AI Feed
          </h2>
          <p className="card-subtitle">
            YOLO11 Vehicle Detection & ByteTrack ID Tracking
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`status-pill ${isOnline ? "online" : "offline"}`}>
            <span className="status-dot"></span>
            {isOnline ? "ANALYZING" : "NO LIVE DATA"}
          </span>
        </div>
      </div>

      {/* 1. Camera Source Selector Tabs */}
      <div style={{ display: "flex", gap: "0.25rem", background: "var(--bg-card-subtle)", padding: "0.25rem", borderRadius: "var(--radius-sm)", marginBottom: "0.75rem" }}>
        <button
          onClick={() => { setSourceMode("video"); if (onSelectCamera) onSelectCamera("CCTV-SKG-01"); }}
          style={{
            flex: 1,
            padding: "0.35rem 0.5rem",
            fontSize: "0.6875rem",
            fontWeight: 700,
            border: "none",
            borderRadius: "var(--radius-xs)",
            cursor: "pointer",
            background: sourceMode === "video" ? "#ffffff" : "transparent",
            color: sourceMode === "video" ? "var(--text-primary)" : "var(--text-muted)",
            boxShadow: sourceMode === "video" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.25rem",
          }}
        >
          <Video size={12} />
          <span>Upload Video</span>
        </button>

        <button
          onClick={() => { setSourceMode("ip"); if (onSelectCamera) onSelectCamera("CCTV-IP-01"); }}
          style={{
            flex: 1,
            padding: "0.35rem 0.5rem",
            fontSize: "0.6875rem",
            fontWeight: 700,
            border: "none",
            borderRadius: "var(--radius-xs)",
            cursor: "pointer",
            background: sourceMode === "ip" ? "#ffffff" : "transparent",
            color: sourceMode === "ip" ? "var(--text-primary)" : "var(--text-muted)",
            boxShadow: sourceMode === "ip" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.25rem",
          }}
        >
          <Globe size={12} />
          <span>IP Camera</span>
        </button>

        <button
          onClick={() => { setSourceMode("mobile"); if (onSelectCamera) onSelectCamera("CCTV-MOBILE-01"); }}
          style={{
            flex: 1,
            padding: "0.35rem 0.5rem",
            fontSize: "0.6875rem",
            fontWeight: 700,
            border: "none",
            borderRadius: "var(--radius-xs)",
            cursor: "pointer",
            background: sourceMode === "mobile" ? "#ffffff" : "transparent",
            color: sourceMode === "mobile" ? "var(--text-primary)" : "var(--text-muted)",
            boxShadow: sourceMode === "mobile" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.25rem",
          }}
        >
          <Smartphone size={12} />
          <span>Mobile Cam</span>
        </button>

        <button
          onClick={() => { setSourceMode("webcam"); }}
          style={{
            flex: 1,
            padding: "0.35rem 0.5rem",
            fontSize: "0.6875rem",
            fontWeight: 700,
            border: "none",
            borderRadius: "var(--radius-xs)",
            cursor: "pointer",
            background: sourceMode === "webcam" ? "#ffffff" : "transparent",
            color: sourceMode === "webcam" ? "var(--text-primary)" : "var(--text-muted)",
            boxShadow: sourceMode === "webcam" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.25rem",
          }}
        >
          <Camera size={12} />
          <span>PC Webcam</span>
        </button>
      </div>

      {/* 2. Source-Specific Operational Controls */}
      {sourceMode === "video" && (
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", alignItems: "center" }}>
          <select
            value={selectedVideo}
            onChange={(e) => setSelectedVideo(e.target.value)}
            style={{
              flex: 1,
              padding: "0.35rem 0.5rem",
              fontSize: "0.75rem",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-xs)",
              background: "#ffffff",
              color: "var(--text-primary)",
            }}
          >
            <option value="Traffic.mp4">Traffic.mp4 (Sankagiri Inflow)</option>
            <option value="Traffic2.mp4">Traffic2.mp4 (Salem Corridor)</option>
            <option value="Traffic3.mp4">Traffic3.mp4 (Erode Radial)</option>
            {videoList.filter(v => !["Traffic.mp4", "Traffic2.mp4", "Traffic3.mp4"].includes(v.filename)).map((v) => (
              <option key={v.filename} value={v.filename}>{v.filename} ({v.size_mb} MB)</option>
            ))}
          </select>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
              padding: "0.35rem 0.6rem",
              background: "#f1f5f9",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-xs)",
              fontSize: "0.6875rem",
              fontWeight: 700,
              cursor: "pointer",
              color: "var(--text-secondary)",
            }}
          >
            <Upload size={12} />
            <span>{isUploading ? "Uploading..." : "Upload MP4"}</span>
            <input type="file" accept="video/mp4,video/avi,video/mov" onChange={handleFileUpload} style={{ display: "none" }} />
          </label>
        </div>
      )}

      {sourceMode === "ip" && (
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", alignItems: "center" }}>
          <input
            type="text"
            placeholder="rtsp://user:pass@ip:554/stream"
            value={rtspUrl}
            onChange={(e) => setRtspUrl(e.target.value)}
            style={{
              flex: 1,
              padding: "0.35rem 0.5rem",
              fontSize: "0.75rem",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-xs)",
              background: "#ffffff",
              fontFamily: "var(--font-mono)",
            }}
          />
        </div>
      )}

      {sourceMode === "mobile" && (
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "var(--radius-xs)", padding: "0.5rem 0.75rem", marginBottom: "0.75rem", fontSize: "0.6875rem", color: "#1e40af", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>📱 Open on Mobile: <strong>http://{lanIp}:5173</strong></span>
          <span style={{ fontSize: "0.625rem", background: "#dbeafe", padding: "2px 6px", borderRadius: "2px", fontWeight: 700 }}>LAN Ready</span>
        </div>
      )}

      {/* 3. Video Stream Container with YOLO + ByteTrack Overlays */}
      <div className="cctv-view-box mb-3" style={{ minHeight: "210px" }}>
        {sourceMode === "webcam" && webcamActive ? (
          <div style={{ width: "100%", height: "100%", position: "relative" }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <canvas ref={canvasRef} style={{ display: "none" }} />
            <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(15, 23, 42, 0.85)", color: "#ffffff", padding: "2px 6px", borderRadius: "2px", fontSize: "10px", fontWeight: 700 }}>
              WEBCAM FEEDING YOLO11 AI
            </div>
          </div>
        ) : isOnline && !streamError ? (
          <img
            src={streamSrc}
            alt="Live Camera Feed"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={() => setStreamError(true)}
          />
        ) : (
          <div className="cctv-standby-overlay">
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "0.5rem" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "var(--radius-xs)",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#94a3b8",
                }}
              >
                <Video size={18} />
              </div>
            </div>
            <div style={{ fontWeight: 700, fontSize: "0.8125rem", color: "#f1f5f9" }}>
              {isOnline ? "Processing Stream Frame Buffer..." : "Camera Stream Offline"}
            </div>
            <p style={{ fontSize: "0.6875rem", color: "#64748b", marginTop: "0.25rem" }}>
              {sourceMode === "video" ? `Selected: ${selectedVideo} • YOLO11 + ByteTrack` :
               sourceMode === "ip" ? "Ingesting RTSP Stream via OpenCV/FFmpeg" :
               sourceMode === "mobile" ? "Awaiting Frame Stream from Mobile Device" :
               "PC Workstation Local Webcam Ingestion"}
            </p>
          </div>
        )}

        {/* Live Active Badge */}
        {isOnline && (
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              background: "rgba(15, 23, 42, 0.85)",
              border: "1px solid rgba(255,255,255,0.2)",
              padding: "0.2rem 0.5rem",
              borderRadius: "var(--radius-xs)",
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              color: "#ffffff",
              fontSize: "0.625rem",
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#ef4444" }}></span>
            YOLO11 + BYTETRACK ACTIVE
          </div>
        )}
      </div>

      {/* 4. Action Buttons */}
      <div className="flex items-center gap-2 mb-3">
        {sourceMode === "webcam" ? (
          !webcamActive ? (
            <button className="btn btn-primary w-full" onClick={startBrowserWebcam}>
              <Camera size={14} />
              <span>Start PC Webcam AI Analysis</span>
            </button>
          ) : (
            <button className="btn btn-danger w-full" onClick={stopBrowserWebcam}>
              <Square size={14} />
              <span>Stop PC Webcam Stream</span>
            </button>
          )
        ) : !isOnline ? (
          <button
            className="btn btn-success w-full"
            onClick={() => {
              setStreamError(false);
              if (onStartCamera) onStartCamera(activeCameraId);
            }}
            disabled={isLoadingAction}
          >
            {isLoadingAction ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Launching YOLO11 Pipeline...</span>
              </>
            ) : (
              <>
                <Play size={14} />
                <span>Start Video Analysis</span>
              </>
            )}
          </button>
        ) : (
          <button
            className="btn btn-danger w-full"
            onClick={() => onStopCamera && onStopCamera(activeCameraId)}
            disabled={isLoadingAction}
          >
            {isLoadingAction ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Stopping Pipeline...</span>
              </>
            ) : (
              <>
                <Square size={14} />
                <span>Stop Analysis</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* 5. Live Detected Vehicles Breakdown */}
      <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: "0.625rem" }}>
        <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "0.375rem" }}>
          Tracked Vehicle Classes
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.375rem" }}>
          <div style={{ background: "var(--bg-card-subtle)", padding: "0.4rem 0.5rem", borderRadius: "var(--radius-xs)", textAlign: "center" }}>
            <span style={{ fontSize: "0.625rem", color: "#64748b", fontWeight: 700 }}>CARS</span>
            <div style={{ fontSize: "0.875rem", fontWeight: 800, color: "#10b981", fontFamily: "var(--font-mono)" }}>
              {isOnline && telemetry?.vehicle_breakdown?.car != null ? telemetry.vehicle_breakdown.car : (isOnline ? "0" : "--")}
            </div>
          </div>

          <div style={{ background: "var(--bg-card-subtle)", padding: "0.4rem 0.5rem", borderRadius: "var(--radius-xs)", textAlign: "center" }}>
            <span style={{ fontSize: "0.625rem", color: "#64748b", fontWeight: 700 }}>TRUCKS</span>
            <div style={{ fontSize: "0.875rem", fontWeight: 800, color: "#f59e0b", fontFamily: "var(--font-mono)" }}>
              {isOnline && telemetry?.vehicle_breakdown?.truck != null ? telemetry.vehicle_breakdown.truck : (isOnline ? "0" : "--")}
            </div>
          </div>

          <div style={{ background: "var(--bg-card-subtle)", padding: "0.4rem 0.5rem", borderRadius: "var(--radius-xs)", textAlign: "center" }}>
            <span style={{ fontSize: "0.625rem", color: "#64748b", fontWeight: 700 }}>BUSES</span>
            <div style={{ fontSize: "0.875rem", fontWeight: 800, color: "#2563eb", fontFamily: "var(--font-mono)" }}>
              {isOnline && telemetry?.vehicle_breakdown?.bus != null ? telemetry.vehicle_breakdown.bus : (isOnline ? "0" : "--")}
            </div>
          </div>

          <div style={{ background: "var(--bg-card-subtle)", padding: "0.4rem 0.5rem", borderRadius: "var(--radius-xs)", textAlign: "center" }}>
            <span style={{ fontSize: "0.625rem", color: "#64748b", fontWeight: 700 }}>BIKES</span>
            <div style={{ fontSize: "0.875rem", fontWeight: 800, color: "#8b5cf6", fontFamily: "var(--font-mono)" }}>
              {isOnline && (telemetry?.vehicle_breakdown?.motorcycle != null || telemetry?.vehicle_breakdown?.bike != null) ?
                (telemetry?.vehicle_breakdown?.motorcycle || telemetry?.vehicle_breakdown?.bike || 0) : (isOnline ? "0" : "--")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
