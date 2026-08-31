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
import { Play, Square, Settings, Wifi, Video, RefreshCw, Check, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CongestionBadge from "./CongestionBadge";

const CLASS_CONFIG = [
  { key: "car",        label: "Cars",  color: "#34d399" },
  { key: "truck",      label: "Truck", color: "#fbbf24" },
  { key: "bus",        label: "Bus",   color: "#f97316" },
  { key: "motorcycle", label: "Bike",  color: "#a855f7" },
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
      className="glass-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem", position: "relative" }}
    >
      {/* Title Bar */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-gray-100">{camera.camera_name || camera.name}</span>
            <span className={`status-dot-tiny ${isActive ? "online" : "offline"}`} />
          </div>
          <div className="text-[11px] text-gray-400 font-mono">
            {camera.camera_code || `CAM-${camera.id}`} • {camera.location}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="p-1 text-gray-400 hover:text-blue-400 bg-gray-800/40 rounded transition"
            title="Configure Camera Stream Source"
            onClick={() => setShowConfig(!showConfig)}
          >
            <Settings size={14} />
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
      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-gray-900/60 border border-white/5 rounded text-[10px] text-gray-300">
        <Wifi size={10} className={isActive ? "text-emerald-400" : "text-gray-500"} />
        <span className="font-semibold text-gray-300 truncate">{sourceLabel}</span>
      </div>

      {/* Camera Viewport Area */}
      <div className="camera-viewport" style={{ background: "#05070a", height: 180, position: "relative", borderRadius: 8, overflow: "hidden" }}>
        {/* Animated Background Overlay */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(180deg, rgba(15,23,42,0.8) 0%, rgba(10,15,25,0.95) 100%)",
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
            <Video size={24} className="text-gray-600 mb-1" />
            <div className="text-[11px] font-mono text-gray-400 font-bold tracking-wider">
              FEED OFFLINE • CLICK START TO ANALYSE
            </div>
            <div className="text-[10px] text-gray-500">
              YOLO11 + ByteTrack AI Standby
            </div>
          </div>
        ) : !hasData ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ zIndex: 3, background: "rgba(0,0,0,0.6)" }}>
            <RefreshCw size={20} className="animate-spin text-blue-400" />
            <div className="text-[11px] font-mono text-blue-300 font-bold">
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
          <div className="absolute bottom-6 right-2 z-10 bg-black/70 border border-white/10 px-2 py-0.5 rounded text-[11px] font-mono text-emerald-400 font-bold">
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
            className="p-3 bg-gray-900/90 border border-blue-500/30 rounded-lg text-xs flex flex-col gap-2"
          >
            <div className="font-bold text-gray-200 flex items-center justify-between">
              <span>Configure Input Stream</span>
              <button type="button" onClick={() => setShowConfig(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            
            <div className="flex gap-2">
              <label className="flex-1">
                <span className="text-[10px] text-gray-400 block mb-0.5">Source Type:</span>
                <select
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value)}
                  className="w-full bg-black/60 border border-gray-700 rounded px-2 py-1 text-gray-200 text-xs"
                >
                  <option value="ip_camera">Mobile IP Camera (Phone Stream URL)</option>
                  <option value="webcam">Local Laptop Camera (Webcam Index)</option>
                  <option value="video">Prerecorded Demo Video Fallback</option>
                </select>
              </label>
            </div>

            <label>
              <span className="text-[10px] text-gray-400 block mb-0.5">
                {sourceType === "ip_camera" ? "Stream URL (e.g. http://192.168.1.100:8080/video):"
                 : sourceType === "webcam" ? "Device Index (e.g. 0 for internal, 1 for external):"
                 : "File Path (e.g. datasets/videos/Traffic.mp4):"}
              </span>
              <input
                type="text"
                value={sourceUri}
                onChange={(e) => setSourceUri(e.target.value)}
                placeholder="Enter IP stream URL or webcam index"
                className="w-full bg-black/60 border border-gray-700 rounded px-2 py-1 text-gray-200 text-xs font-mono"
              />
            </label>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="submit"
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs flex items-center gap-1"
              >
                {saveSuccess ? <><Check size={12} /> Saved!</> : "Apply Stream URL"}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Real per-class vehicle counts from YOLO11 */}
      {hasData ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-4 gap-1.5">
          {CLASS_CONFIG.map((item) => (
            <div key={item.key} className="text-center p-1.5 rounded bg-black/40 border border-white/5">
              <div className="font-bold font-mono text-sm" style={{ color: item.color }}>
                {classCounts[item.key] ?? 0}
              </div>
              <div className="text-[10px] text-gray-400">{item.label}</div>
            </div>
          ))}
        </motion.div>
      ) : (
        <div className="grid grid-cols-4 gap-1.5">
          {CLASS_CONFIG.map((item) => (
            <div key={item.key} className="text-center p-1.5 rounded bg-black/20 border border-white/5">
              <div className="font-bold font-mono text-sm text-gray-600">—</div>
              <div className="text-[10px] text-gray-500">{item.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Metrics Bar with Section 13 Speed Calibration Disclosure */}
      <div className="flex items-center justify-between pt-1 border-t border-white/5 text-xs text-gray-300">
        <div className="flex flex-col">
          <span className="text-[10px] text-gray-400">SPEED (ESTIMATED):</span>
          <span className="font-mono font-bold text-amber-400">
            {hasData ? `${speed.toFixed(0)} km/h*` : "NO DATA"}
          </span>
        </div>

        <div className="flex flex-col text-right">
          <span className="text-[10px] text-gray-400">CONGESTION:</span>
          <span className="font-mono font-bold text-blue-400">
            {hasData ? `${(score * 100).toFixed(0)}%` : "NO DATA"}
          </span>
        </div>
      </div>

      {/* Speed Calibration Disclaimer (Section 13) */}
      <div className="text-[9px] text-gray-500 italic">
        *Relative motion tracker. Physical km/h requires per-approach camera calibration.
      </div>

      {/* Action Button */}
      <button
        className={`w-full py-1.5 rounded text-xs font-bold transition flex items-center justify-center gap-1.5 ${
          isActive
            ? "bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30"
            : "bg-emerald-600 hover:bg-emerald-500 text-white shadow"
        }`}
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
