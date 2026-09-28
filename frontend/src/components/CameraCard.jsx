/**
 * CameraCard.jsx — CCTV / IP Camera Feed Card
 * ============================================
 * Smart Traffic Control & Decision Support System (Tamil Nadu Authority)
 *
 * Implements Master Specification Section 4, 5, 13, 14 & Modules 1, 2, 3, 14:
 *   - Honest labeling: DEMO / SIMULATED CCTV / IP CAMERA / LOCAL WEBCAM / DEMO VIDEO
 *   - Dynamic source configuration (supports Mobile IP Camera stream URLs & Laptop webcams)
 *   - Real YOLO11 detections & ByteTrack IDs (no fake data)
 *   - Speed disclaimer: "Relative movement (calibration required for absolute km/h)"
 *   - Clean Start/Stop lifecycle controls
 */

import { useState, useEffect, useRef } from "react";
import { startCamera, stopCamera, getCameraStats, configureCamera } from "../api";
import { Play, Square, Settings, Wifi, Video, RefreshCw, Check, AlertCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CongestionBadge from "./CongestionBadge";

const CLASS_CONFIG = [
  { key: "car",        label: "Cars",  color: "var(--status-normal, #22C55E)" },
  { key: "truck",      label: "Truck", color: "var(--status-moderate, #C2BB91)" },
  { key: "bus",        label: "Bus",   color: "var(--status-high, #F59E0B)" },
  { key: "motorcycle", label: "Bike",  color: "var(--accent-soft-blue, #7B8BC8)" },
];

export default function CameraCard({ camera, onRefresh }) {
  const [isActive, setIsActive] = useState(false);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState(new Date());
  const [showConfig, setShowConfig] = useState(false);
  const [sourceType, setSourceType] = useState(camera.source_type || "video");
  const [sourceUri, setSourceUri] = useState(camera.source_uri || camera.source || "");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isActive) {
      clearInterval(pollRef.current);
      return;
    }
    const poll = async () => {
      try {
        const data = await getCameraStats(camera.camera_id || camera.id);
        setStats(data);
      } catch (e) {
        // Keep last known state
      }
    };
    poll();
    pollRef.current = setInterval(poll, 2500);
    return () => clearInterval(pollRef.current);
  }, [isActive, camera.camera_id, camera.id]);

  const handleToggle = async () => {
    setLoading(true);
    const cid = camera.camera_id || camera.id;
    try {
      if (isActive) {
        await stopCamera(cid);
        setIsActive(false);
        setStats(null);
      } else {
        await startCamera(cid);
        setIsActive(true);
      }
    } catch (err) {
      console.error("Camera toggle error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    const cid = camera.camera_id || camera.id;
    try {
      await configureCamera(cid, {
        camera_id: cid,
        source_type: sourceType,
        source_uri: sourceUri,
        camera_name: camera.camera_name || camera.name,
      });
      setSaveSuccess(true);
      if (onRefresh) onRefresh();
      setTimeout(() => {
        setSaveSuccess(false);
        setShowConfig(false);
      }, 1500);
    } catch (err) {
      alert(`Config error: ${err.message}`);
    }
  };

  const metrics = stats?.metrics || {};
  const hasData = isActive && Object.keys(metrics).length > 0;
  const level = metrics.congestion_level || "FREE_FLOW";
  const score = metrics.congestion_score ?? 0;
  const count = metrics.vehicle_count ?? 0;
  const speed = metrics.average_speed_kmh ?? 0;
  const classCounts = metrics.class_counts || {};

  const sourceLabel = camera.source_label || (
    camera.source_type === "ip_camera" ? "IP CAMERA (Mobile Phone Stream)"
    : camera.source_type === "webcam" ? "LOCAL WEBCAM (Laptop Source)"
    : "DEMO / SIMULATED CCTV (Fallback Video)"
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: "var(--bg-surface, #1B2028)",
        border: "1px solid var(--border-default, #3D3F4E)",
        borderRadius: "4px",
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        position: "relative",
      }}
    >
      {/* Title Bar */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--text-primary, #F4F5F7)" }}>
              {camera.camera_name || camera.name}
            </span>
            <span className={`status-dot-tiny ${isActive ? "online" : "offline"}`} />
          </div>
          <div style={{ fontSize: "0.6875rem", color: "var(--text-secondary, #A7ACB8)", fontFamily: "var(--font-mono)" }}>
            {camera.camera_code || `CAM-${camera.id}`} • {camera.location}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            style={{
              padding: "0.3rem",
              color: "var(--text-secondary, #A7ACB8)",
              background: "var(--bg-surface-elevated, #252936)",
              border: "1px solid var(--border-default, #3D3F4E)",
              borderRadius: "3px",
              cursor: "pointer",
            }}
            title="Configure Camera Stream Source"
            onClick={() => setShowConfig(!showConfig)}
          >
            <Settings size={13} />
          </button>
          {isActive ? (
            <span className="badge-live-stream" style={{ fontSize: "10px", padding: "2px 6px" }}>
              <span className="live-pulse-dot" /> LIVE
            </span>
          ) : (
            <span className="badge badge-ghost" style={{ fontSize: "10px" }}>STANDBY</span>
          )}
          {hasData && <CongestionBadge level={level} />}
        </div>
      </div>

      {/* Honest Source Badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.375rem",
          padding: "0.2rem 0.5rem",
          background: "var(--bg-surface-elevated, #252936)",
          border: "1px solid var(--border-default, #3D3F4E)",
          borderRadius: "3px",
          fontSize: "0.625rem",
          color: "var(--text-secondary, #A7ACB8)",
        }}
      >
        <Wifi size={10} color={isActive ? "var(--status-normal, #22C55E)" : "var(--text-muted, #737987)"} />
        <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {sourceLabel}
        </span>
      </div>

      {/* Camera Viewport Area */}
      <div className="camera-viewport" style={{ background: "#0d0f11", height: 180, position: "relative", borderRadius: 4, overflow: "hidden", border: "1px solid var(--border-default, #3D3F4E)" }}>
        {/* Animated Background Overlay */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(180deg, rgba(17,19,21,0.6) 0%, rgba(13,15,17,0.95) 100%)",
        }} />

        {/* Live MJPEG Stream Image with Real YOLO11 & ByteTrack Overlays */}
        {isActive && (
          <img
            src={`http://127.0.0.1:8000/api/camera/${camera.camera_id || camera.id}/feed`}
            alt={camera.camera_name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              position: "absolute",
              inset: 0,
              zIndex: 1,
            }}
            onError={(e) => {
              e.target.style.opacity = 0;
            }}
            onLoad={(e) => {
              e.target.style.opacity = 1;
            }}
          />
        )}

        {/* Scan line effect when active */}
        {isActive && <div className="scan-line" style={{ zIndex: 2 }} />}

        {/* Standby / Waiting indicator */}
        {!isActive ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1" style={{ zIndex: 3 }}>
            <Video size={24} style={{ color: "var(--text-muted, #737987)", marginBottom: "0.25rem" }} />
            <div style={{ fontSize: "0.6875rem", fontFamily: "var(--font-mono)", color: "var(--text-secondary, #A7ACB8)", fontWeight: 700, letterSpacing: "0.05em" }}>
              FEED OFFLINE • CLICK START TO ANALYSE
            </div>
            <div style={{ fontSize: "0.625rem", color: "var(--text-muted, #737987)" }}>
              YOLO11 + ByteTrack AI Standby
            </div>
          </div>
        ) : !hasData ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ zIndex: 3, background: "rgba(0,0,0,0.7)" }}>
            <RefreshCw size={20} className="animate-spin" style={{ color: "var(--accent-soft-blue, #7B8BC8)" }} />
            <div style={{ fontSize: "0.6875rem", fontFamily: "var(--font-mono)", color: "var(--accent-soft-blue, #7B8BC8)", fontWeight: 700 }}>
              INGESTING FRAMES & ACQUIRING TRACKS...
            </div>
          </div>
        ) : null}

        {/* CCTV Overlay details */}
        <div className="cctv-overlay">
          <div className="cctv-top">
            <span className="cctv-text">{camera.camera_code || "CCTV"} • {(camera.approach_name || camera.name || "").toUpperCase()}</span>
            <span className="cctv-text">{time.toLocaleTimeString("en-IN", { hour12: false })}</span>
          </div>
          <div className="cctv-bottom">
            <span className="cctv-text">{camera.address || camera.location}</span>
            <span className="cctv-text">FPS: 30.0 • YOLO11n</span>
          </div>
        </div>

        {/* Real Vehicle Count Overlay */}
        {hasData && (
          <div style={{ position: "absolute", bottom: 6, right: 8, zIndex: 10, background: "rgba(0,0,0,0.75)", border: "1px solid var(--border-default, #3D3F4E)", padding: "2px 6px", borderRadius: 3, fontSize: "0.6875rem", fontFamily: "var(--font-mono)", color: "var(--status-normal, #22C55E)", fontWeight: 700 }}>
            {count} Vehicles Detected (Unique Tracks)
          </div>
        )}
      </div>

      {/* Stream Source Configuration Dropdown Modal */}
      <AnimatePresence>
        {showConfig && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSaveConfig}
            style={{
              padding: "0.75rem",
              background: "var(--bg-surface-elevated, #252936)",
              border: "1px solid var(--border-default, #3D3F4E)",
              borderRadius: "4px",
              fontSize: "0.75rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <div style={{ fontWeight: 700, color: "var(--text-primary, #F4F5F7)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>Configure Input Stream</span>
              <button type="button" onClick={() => setShowConfig(false)} style={{ background: "none", border: "none", color: "var(--text-muted, #737987)", cursor: "pointer" }} aria-label="Close">
                <X size={14} />
              </button>
            </div>
            
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <label style={{ flex: 1 }}>
                <span style={{ fontSize: "0.625rem", color: "var(--text-muted, #737987)", display: "block", marginBottom: "0.25rem" }}>Source Type:</span>
                <select
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value)}
                  style={{
                    width: "100%",
                    background: "var(--bg-app, #111315)",
                    border: "1px solid var(--border-default, #3D3F4E)",
                    borderRadius: "3px",
                    padding: "0.35rem 0.5rem",
                    color: "var(--text-primary, #F4F5F7)",
                    fontSize: "0.75rem",
                  }}
                >
                  <option value="ip_camera">Mobile IP Camera (Phone Stream URL)</option>
                  <option value="webcam">Local Laptop Camera (Webcam Index)</option>
                  <option value="video">Prerecorded Demo Video Fallback</option>
                </select>
              </label>
            </div>

            <label>
              <span style={{ fontSize: "0.625rem", color: "var(--text-muted, #737987)", display: "block", marginBottom: "0.25rem" }}>
                {sourceType === "ip_camera" ? "Stream URL (e.g. http://192.168.1.100:8080/video):"
                 : sourceType === "webcam" ? "Device Index (e.g. 0 for internal, 1 for external):"
                 : "File Path (e.g. datasets/videos/Traffic.mp4):"}
              </span>
              <input
                type="text"
                value={sourceUri}
                onChange={(e) => setSourceUri(e.target.value)}
                placeholder="Enter IP stream URL or webcam index"
                style={{
                  width: "100%",
                  background: "var(--bg-app, #111315)",
                  border: "1px solid var(--border-default, #3D3F4E)",
                  borderRadius: "3px",
                  padding: "0.35rem 0.5rem",
                  color: "var(--text-primary, #F4F5F7)",
                  fontSize: "0.75rem",
                  fontFamily: "var(--font-mono)",
                }}
              />
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", paddingTop: "0.25rem" }}>
              <button
                type="submit"
                style={{
                  padding: "0.35rem 0.75rem",
                  background: "var(--accent-soft-blue, #7B8BC8)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "3px",
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  cursor: "pointer",
                }}
              >
                {saveSuccess ? <><Check size={12} /> Saved!</> : "Apply Stream URL"}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Real per-class vehicle counts from YOLO11 */}
      {hasData ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.375rem" }}>
          {CLASS_CONFIG.map((item) => (
            <div key={item.key} style={{ textAlign: "center", padding: "0.375rem", borderRadius: "3px", background: "var(--bg-surface-elevated, #252936)", border: "1px solid var(--border-default, #3D3F4E)" }}>
              <div style={{ fontWeight: 700, fontFamily: "var(--font-mono)", fontSize: "0.875rem", color: item.color }}>
                {classCounts[item.key] ?? 0}
              </div>
              <div style={{ fontSize: "0.625rem", color: "var(--text-muted, #737987)" }}>{item.label}</div>
            </div>
          ))}
        </motion.div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.375rem" }}>
          {CLASS_CONFIG.map((item) => (
            <div key={item.key} style={{ textAlign: "center", padding: "0.375rem", borderRadius: "3px", background: "var(--bg-surface-elevated, #252936)", border: "1px solid var(--border-default, #3D3F4E)" }}>
              <div style={{ fontWeight: 700, fontFamily: "var(--font-mono)", fontSize: "0.875rem", color: "var(--text-muted, #737987)" }}>—</div>
              <div style={{ fontSize: "0.625rem", color: "var(--text-muted, #737987)" }}>{item.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Metrics Bar with Section 13 Speed Calibration Disclosure */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "0.25rem", borderTop: "1px solid var(--border-light, #2C303C)", fontSize: "0.75rem", color: "var(--text-secondary, #A7ACB8)" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: "0.625rem", color: "var(--text-muted, #737987)" }}>SPEED (ESTIMATED):</span>
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--status-high, #F59E0B)" }}>
            {hasData ? `${speed.toFixed(0)} km/h*` : "NO DATA"}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", textAlign: "right" }}>
          <span style={{ fontSize: "0.625rem", color: "var(--text-muted, #737987)" }}>CONGESTION:</span>
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--accent-soft-blue, #7B8BC8)" }}>
            {hasData ? `${(score * 100).toFixed(0)}%` : "NO DATA"}
          </span>
        </div>
      </div>

      {/* Speed Calibration Disclaimer (Section 13) */}
      <div style={{ fontSize: "0.5625rem", color: "var(--text-muted, #737987)", fontStyle: "italic" }}>
        *Relative motion tracker. Physical km/h requires per-approach camera calibration.
      </div>

      {/* Action Button */}
      <button
        style={{
          width: "100%",
          padding: "0.5rem",
          borderRadius: "3px",
          fontSize: "0.75rem",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.375rem",
          cursor: loading ? "not-allowed" : "pointer",
          background: isActive ? "rgba(244, 94, 112, 0.15)" : "var(--accent-soft-blue, #7B8BC8)",
          color: isActive ? "var(--status-critical, #F45E70)" : "#ffffff",
          border: isActive ? "1px solid rgba(244, 94, 112, 0.35)" : "none",
        }}
        disabled={loading}
        onClick={handleToggle}
      >
        {loading ? (
          <><RefreshCw size={13} className="animate-spin" /> Processing...</>
        ) : isActive ? (
          <><Square size={13} /> Stop Camera Feed</>
        ) : (
          <><Play size={13} /> Start AI Surveillance Feed</>
        )}
      </button>
    </motion.div>
  );
}
