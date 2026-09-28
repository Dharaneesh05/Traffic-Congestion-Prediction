/**
 * LiveCamera.jsx — 5-Camera CCTV / IP Camera Matrix
 * ==================================================
 * Smart Traffic Control & Decision Support System (Tamil Nadu Authority)
 *
 * Implements Master Specification Section 4, 5, 12, 14 & Modules 1, 14:
 *   - 5 Configured Camera Feeds (2 Mobile IP + 3 Laptop/Video Sources)
 *   - Source labeling: DEMO / SIMULATED CCTV, IP CAMERA, LOCAL WEBCAM, DEMO VIDEO
 *   - Live YOLO11 + ByteTrack vehicle detections & track IDs
 *   - Speed estimation disclosure
 */

import { useState, useEffect } from "react";
import { getCameras } from "../api";
import CameraCard from "../components/CameraCard";
import AIPanel from "../components/AIPanel";
import { Video, Shield, Info, Smartphone, Laptop, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

export default function LiveCamera() {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadCameras = async () => {
    try {
      const data = await getCameras();
      setCameras(data.cameras || []);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCameras();
  }, []);

  return (
    <div className="flex flex-col gap-5 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Video size={16} style={{ color: "var(--accent-soft-blue, #7B8BC8)" }} />
            <span className="text-xs text-muted uppercase tracking-wider font-bold">Multi-Approach CCTV Matrix</span>
          </div>
          <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800, color: "var(--text-primary, #F4F5F7)" }}>
            Junction Surveillance Network (5 Approaches)
          </h2>
          <div className="text-xs text-muted mt-1">
            2 Mobile Phone IP Streams • 3 Laptop / Webcam Sources • YOLO11 + ByteTrack AI Pipeline
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadCameras}
            className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold"
            style={{
              background: "var(--bg-surface-elevated, #252936)",
              color: "var(--text-primary, #F4F5F7)",
              border: "1px solid var(--border-default, #3D3F4E)",
              cursor: "pointer",
            }}
          >
            <RefreshCw size={12} /> Refresh Feeds
          </button>
          <div className="flex items-center gap-2 glass-card-flat" style={{ padding: "0.4rem 0.8rem", borderRadius: 4 }}>
            <span className="status-dot active" />
            <span className="text-xs font-bold" style={{ color: "var(--status-normal, #22C55E)" }}>MATRIX READY</span>
          </div>
        </div>
      </div>

      {/* Demonstration Banner & Setup Guidance */}
      <div
        className="text-xs flex items-start gap-3"
        style={{
          background: "rgba(123, 139, 200, 0.08)",
          border: "1px solid rgba(123, 139, 200, 0.25)",
          borderRadius: "4px",
          padding: "0.75rem",
          color: "var(--text-secondary, #A7ACB8)",
        }}
      >
        <Info size={16} style={{ color: "var(--accent-soft-blue, #7B8BC8)", marginTop: 2, flexShrink: 0 }} />
        <div>
          <b style={{ color: "var(--accent-soft-blue, #7B8BC8)", display: "block", marginBottom: 2 }}>DEMONSTRATION CAMERA SETUP (TAMIL NADU AUTHORITY PROTOTYPE):</b>
          <span>
            Simulates 5 junction approaches using student devices: Click the Settings icon on any card to input your Mobile Phone IP camera stream URL (e.g. from IP Webcam app) or switch to a Laptop webcam index. All detection, tracking, and traffic analytics execute in real-time.
          </span>
        </div>
      </div>

      {/* 5-Camera Grid (3 on top row, 2 on bottom row) */}
      <div className="grid grid-cols-3 gap-4">
        {loading
          ? [1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="glass-card skeleton" style={{ height: 380 }} />
            ))
          : cameras.map((cam) => (
              <CameraCard key={cam.camera_id || cam.id} camera={cam} onRefresh={loadCameras} />
            ))
        }
      </div>

      {/* AI Decision Grounding Panel below Matrix */}
      <AIPanel />
    </div>
  );
}
