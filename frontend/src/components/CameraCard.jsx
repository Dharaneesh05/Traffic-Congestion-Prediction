/**
 * CameraCard.jsx
 * Individual CCTV camera card with animated feed simulation,
 * real-time YOLO11 stats, and controls.
 */

import { useState, useEffect, useRef } from "react";
import { startCamera, stopCamera, getCameraStats } from "../api";
import { Play, Square, Wifi, WifiOff, Car, Truck, Zap } from "lucide-react";
import { motion } from "framer-motion";
import CongestionBadge from "./CongestionBadge";

// Simulated detection boxes overlaid on the CCTV placeholder
const FAKE_BOXES = [
  { x: "12%", y: "25%", w: "18%", h: "22%", color: "#10b981", label: "Car" },
  { x: "42%", y: "35%", w: "14%", h: "18%", color: "#3b82f6", label: "Truck" },
  { x: "65%", y: "20%", w: "16%", h: "20%", color: "#f59e0b", label: "Bike" },
  { x: "28%", y: "55%", w: "20%", h: "24%", color: "#10b981", label: "Car" },
];

export default function CameraCard({ camera }) {
  const [isActive, setIsActive] = useState(false);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState(new Date());
  const pollRef = useRef(null);

  // Clock tick
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Poll stats when active
  useEffect(() => {
    if (!isActive) { clearInterval(pollRef.current); return; }
    const poll = async () => {
      try {
        const data = await getCameraStats(camera.id);
        setStats(data);
      } catch { /* ignore */ }
    };
    poll();
    pollRef.current = setInterval(poll, 2000);
    return () => clearInterval(pollRef.current);
  }, [isActive, camera.id]);

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (isActive) {
        await stopCamera(camera.id);
        setIsActive(false);
        setStats(null);
      } else {
        await startCamera(camera.id);
        setIsActive(true);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const metrics = stats?.metrics || {};
  const level   = metrics.congestion_level || "FREE_FLOW";
  const score   = metrics.congestion_score ?? 0;
  const count   = metrics.vehicle_count ?? 0;
  const speed   = metrics.average_speed_kmh ?? 0;

  // Fake per-type vehicle breakdown (proportional to total count)
  const carCount   = Math.round(count * 0.55);
  const busCount   = Math.round(count * 0.10);
  const truckCount = Math.round(count * 0.15);
  const bikeCount  = count - carCount - busCount - truckCount;

  const scoreColor = score > 0.7 ? "var(--accent-danger)"
    : score > 0.45 ? "var(--accent-warning)"
    : "var(--accent-success)";

  return (
    <motion.div
      className="glass-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.875rem" }}
    >
      {/* Title bar */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">{camera.name}</span>
            <span className="status-dot" style={{ background: isActive ? "var(--accent-success)" : "var(--text-muted)", boxShadow: isActive ? "0 0 6px var(--accent-success)" : "none" }} />
          </div>
          <div className="text-xs text-muted">{camera.location}</div>
        </div>
        <div className="flex items-center gap-2">
          {isActive ? (
            <span className="live-badge">
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "white", display: "inline-block" }} />
              LIVE
            </span>
          ) : (
            <span className="badge badge-ghost">OFFLINE</span>
          )}
          <CongestionBadge level={level} />
        </div>
      </div>

      {/* Camera Viewport */}
      <div className="camera-viewport" style={{ background: "#060809" }}>
        {/* Gradient background simulating road at night */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(180deg, #0a0e14 0%, #111820 40%, #0d1218 100%)",
        }} />

        {/* Grid lines — road markings */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />

        {/* Scan line */}
        {isActive && <div className="scan-line" />}

        {/* Detection bounding boxes */}
        {isActive && FAKE_BOXES.map((b, i) => (
          <motion.div
            key={i}
            className="detection-box"
            style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, borderColor: b.color }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0, 1, 1, 0.7, 1], scale: 1 }}
            transition={{ delay: i * 0.2, duration: 0.4, repeat: Infinity, repeatDelay: 5 }}
          >
            <span style={{
              position: "absolute", top: -16, left: 0,
              fontSize: "0.55rem", fontFamily: "var(--font-mono)",
              background: b.color, color: "#fff", padding: "1px 4px", borderRadius: "2px"
            }}>
              {b.label}
            </span>
          </motion.div>
        ))}

        {/* Pulse when active but no boxes yet */}
        {isActive && (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>
            <div className="pulse-ring" />
          </div>
        )}

        {/* CCTV overlay */}
        <div className="cctv-overlay">
          <div className="cctv-top">
            <span className="cctv-text">CAM {String(camera.id).padStart(2, "0")} — {camera.name.toUpperCase()}</span>
            <span className="cctv-text">{time.toLocaleTimeString("en-IN", { hour12: false })}</span>
          </div>
          <div className="cctv-bottom">
            <span className="cctv-text">{camera.address}</span>
            <span className="cctv-text">{time.toLocaleDateString("en-IN")}</span>
          </div>
        </div>

        {/* YOLO11 label when active */}
        {isActive && (
          <div style={{ position: "absolute", top: 6, left: "50%", transform: "translateX(-50%)", zIndex: 10 }}>
            <span style={{ fontSize: "0.55rem", fontFamily: "var(--font-mono)", background: "rgba(59,130,246,0.85)", color: "#fff", padding: "1px 6px", borderRadius: "2px" }}>
              YOLO11 + ByteTrack
            </span>
          </div>
        )}
      </div>

      {/* Stats row */}
      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-4 gap-2"
        >
          {[
            { label: "Cars",  value: carCount,   color: "var(--accent-success)" },
            { label: "Bus",   value: busCount,   color: "var(--accent-warning)" },
            { label: "Truck", value: truckCount, color: "var(--accent-orange)" },
            { label: "Bike",  value: bikeCount,  color: "var(--accent-purple)" },
          ].map((item) => (
            <div key={item.label} className="text-center p-2 rounded-md" style={{ background: "rgba(255,255,255,0.03)" }}>
              <div className="font-bold font-mono text-base" style={{ color: item.color }}>{item.value}</div>
              <div className="text-xs text-muted">{item.label}</div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Metrics bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-secondary">
          <span>
            <span className="text-muted">Speed: </span>
            <span className="font-mono font-bold text-primary">{speed.toFixed(0)} km/h</span>
          </span>
          <span>
            <span className="text-muted">Vehicles: </span>
            <span className="font-mono font-bold text-primary">{count}</span>
          </span>
          <span>
            <span className="text-muted">Score: </span>
            <span className="font-mono font-bold" style={{ color: scoreColor }}>{(score * 100).toFixed(0)}%</span>
          </span>
        </div>
        <button
          className={`btn ${isActive ? "btn-danger" : "btn-success"}`}
          style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}
          onClick={handleToggle}
          disabled={loading}
        >
          {loading ? (
            <div className="spinner" style={{ width: 12, height: 12 }} />
          ) : isActive ? (
            <><Square size={12} /> Stop</>
          ) : (
            <><Play size={12} /> Start</>
          )}
        </button>
      </div>
    </motion.div>
  );
}
