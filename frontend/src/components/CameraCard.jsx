/**
 * CameraCard.jsx
 * Individual CCTV camera card with real YOLO11 + ByteTrack stats.
 *
 * IMPORTANT — No fake data:
 *   - Vehicle counts come from backend /api/camera/{id}/stats
 *   - Per-class breakdown (car/truck/bus/motorcycle) from real class_counts
 *   - Status (LIVE/OFFLINE) reflects actual is_processing state
 *   - When no data: displays "WAITING FOR DATA" or "NO DATA"
 */

import { useState, useEffect, useRef } from "react";
import { startCamera, stopCamera, getCameraStats } from "../api";
import { Play, Square } from "lucide-react";
import { motion } from "framer-motion";
import CongestionBadge from "./CongestionBadge";

// Class display config — matches backend CLASS_NAMES in detect.py
const CLASS_CONFIG = [
  { key: "car",        label: "Cars",  color: "var(--accent-success)" },
  { key: "truck",      label: "Truck", color: "var(--accent-warning)" },
  { key: "bus",        label: "Bus",   color: "var(--accent-orange)"  },
  { key: "motorcycle", label: "Bike",  color: "var(--accent-purple)"  },
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
      } catch { /* keep last known state */ }
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

  // Extract REAL metrics from backend
  const metrics     = stats?.metrics || {};
  const hasData     = isActive && Object.keys(metrics).length > 0;
  const level       = metrics.congestion_level || "FREE_FLOW";
  const score       = metrics.congestion_score ?? 0;
  const count       = metrics.vehicle_count ?? 0;
  const speed       = metrics.average_speed_kmh ?? 0;
  // Real per-class counts from YOLO11 (detect.py CLASS_NAMES: car, truck, bus, motorcycle)
  const classCounts = metrics.class_counts || {};

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
            <span className="status-dot" style={{
              background: isActive ? "var(--accent-success)" : "var(--text-muted)",
              boxShadow: isActive ? "0 0 6px var(--accent-success)" : "none"
            }} />
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
          {hasData && <CongestionBadge level={level} />}
        </div>
      </div>

      {/* Camera Viewport */}
      <div className="camera-viewport" style={{ background: "#060809" }}>
        {/* Dark gradient background (cosmetic) */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(180deg, #0a0e14 0%, #111820 40%, #0d1218 100%)",
        }} />

        {/* Grid lines — road markings (cosmetic) */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />

        {/* Scan line (cosmetic animation) */}
        {isActive && <div className="scan-line" />}

        {/* OFFLINE state */}
        {!isActive && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: "0.5rem",
          }}>
            <div style={{ fontSize: "0.65rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)", letterSpacing: "0.08em" }}>
              OFFLINE — PRESS START TO ANALYSE
            </div>
          </div>
        )}

        {/* Active but waiting for first data */}
        {isActive && !hasData && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: "0.5rem",
          }}>
            <div className="spinner" style={{ width: 20, height: 20, borderTopColor: "var(--accent-primary)" }} />
            <div style={{ fontSize: "0.6rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)", letterSpacing: "0.08em" }}>
              WAITING FOR DATA
            </div>
          </div>
        )}

        {/* CCTV overlay (cosmetic — ID, name, timestamp) */}
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
            <span style={{
              fontSize: "0.55rem", fontFamily: "var(--font-mono)",
              background: "rgba(59,130,246,0.85)", color: "#fff",
              padding: "1px 6px", borderRadius: "2px"
            }}>
              YOLO11 + ByteTrack
            </span>
          </div>
        )}

        {/* Real-time vehicle count overlay when data available */}
        {hasData && (
          <div style={{
            position: "absolute", bottom: 28, right: 8, zIndex: 10,
            background: "rgba(0,0,0,0.6)", borderRadius: 4, padding: "2px 6px",
          }}>
            <span style={{ fontSize: "0.6rem", fontFamily: "var(--font-mono)", color: "var(--accent-success)" }}>
              {count} vehicles detected
            </span>
          </div>
        )}
      </div>

      {/* Real per-class vehicle counts from YOLO11 */}
      {hasData ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-4 gap-2">
          {CLASS_CONFIG.map((item) => (
            <div key={item.key} className="text-center p-2 rounded-md" style={{ background: "rgba(255,255,255,0.03)" }}>
              <div className="font-bold font-mono text-base" style={{ color: item.color }}>
                {classCounts[item.key] ?? 0}
              </div>
              <div className="text-xs text-muted">{item.label}</div>
            </div>
          ))}
        </motion.div>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {CLASS_CONFIG.map((item) => (
            <div key={item.key} className="text-center p-2 rounded-md" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="font-bold font-mono text-base text-muted">—</div>
              <div className="text-xs text-muted">{item.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Metrics bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-secondary">
          <span>
            <span className="text-muted">Speed: </span>
            {hasData
              ? <span className="font-mono font-bold text-primary">{speed.toFixed(0)} km/h</span>
              : <span className="text-muted font-mono">NO DATA</span>
            }
          </span>
          <span>
            <span className="text-muted">Vehicles: </span>
            {hasData
              ? <span className="font-mono font-bold text-primary">{count}</span>
              : <span className="text-muted font-mono">NO DATA</span>
            }
          </span>
          <span>
            <span className="text-muted">Score: </span>
            {hasData
              ? <span className="font-mono font-bold" style={{ color: scoreColor }}>{(score * 100).toFixed(0)}%</span>
              : <span className="text-muted font-mono">NO DATA</span>
            }
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
