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
            <Video size={16} className="text-blue-500" />
            <span className="text-xs text-muted uppercase tracking-wider font-bold">Multi-Approach CCTV Matrix</span>
          </div>
          <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800, color: "#f3f4f6" }}>
            Junction Surveillance Network (5 Approaches)
          </h2>
          <div className="text-xs text-muted mt-1">
            2 Mobile Phone IP Streams • 3 Laptop / Webcam Sources • YOLO11 + ByteTrack AI Pipeline
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadCameras}
            className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-xs font-semibold border border-gray-700"
          >
            <RefreshCw size={12} /> Refresh Feeds
          </button>
          <div className="flex items-center gap-2 glass-card-flat" style={{ padding: "0.4rem 0.8rem", borderRadius: 999 }}>
            <span className="status-dot active" />
            <span className="text-xs font-bold text-success">MATRIX READY</span>
          </div>
        </div>
      </div>

      {/* Demonstration Banner & Setup Guidance */}
      <div className="p-3 bg-blue-950/40 border border-blue-500/20 rounded-xl text-xs text-gray-300 flex items-start gap-3">
        <Info size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
        <div>
          <b className="text-blue-300 block mb-0.5">DEMONSTRATION CAMERA SETUP (TAMIL NADU AUTHORITY PROTOTYPE):</b>
          <span>
            Simulates 5 junction approaches using student devices: Click the ⚙️ gear icon on any card to input your Mobile Phone IP camera stream URL (e.g. from IP Webcam app) or switch to a Laptop webcam index. All detection, tracking, and traffic analytics execute in real-time.
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
