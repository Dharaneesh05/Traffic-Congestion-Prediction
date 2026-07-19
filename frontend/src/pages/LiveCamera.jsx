/**
 * LiveCamera.jsx — 4-Camera CCTV Grid
 * =====================================
 * Displays 4 simulated CCTV feeds with real YOLO11 + ByteTrack stats.
 * Never exposes internal "prerecorded" terminology in the UI.
 */

import { useState, useEffect } from "react";
import { getCameras } from "../api";
import CameraCard from "../components/CameraCard";
import AIPanel from "../components/AIPanel";
import { Video, Play, Square, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

export default function LiveCamera() {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getCameras();
        setCameras(data.cameras || []);
      } catch {
        // Fallback static cameras if backend offline
        setCameras([
          { id: 1, name: "Salem Junction",   location: "Salem, Tamil Nadu",    address: "NH544, Salem - 636001",       lat: 11.6686, lon: 78.1440 },
          { id: 2, name: "Erode Toll",        location: "Erode, Tamil Nadu",    address: "NH544 Toll, Erode - 638001",  lat: 11.3400, lon: 77.7100 },
          { id: 3, name: "Namakkal Signal",   location: "Namakkal, TN",         address: "Main Road, Namakkal - 637001",lat: 11.2200, lon: 78.1680 },
          { id: 4, name: "Karur Bypass",      location: "Karur, Tamil Nadu",    address: "Bypass Road, Karur - 639001", lat: 10.9550, lon: 78.0800 },
        ]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="flex flex-col gap-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Video size={16} color="var(--accent-primary)" />
            <span className="text-xs text-muted uppercase tracking-wider font-bold">Traffic Surveillance</span>
          </div>
          <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800 }}>Live Camera Network</h2>
          <div className="text-sm text-muted mt-1">
            {cameras.length} cameras · YOLO11 + ByteTrack · Real-time analysis
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 glass-card-flat" style={{ padding: "0.5rem 1rem", borderRadius: 999 }}>
            <span className="status-dot active" />
            <span className="text-xs font-bold text-success">NETWORK ONLINE</span>
          </div>
        </div>
      </div>

      {/* 2×2 camera grid */}
      <div className="grid grid-cols-2 gap-4">
        {loading
          ? [1, 2, 3, 4].map((i) => (
              <div key={i} className="glass-card skeleton" style={{ height: 360 }} />
            ))
          : cameras.map((cam, i) => (
              <CameraCard key={cam.id} camera={cam} />
            ))
        }
      </div>

      {/* AI Panel below cameras */}
      <AIPanel />
    </div>
  );
}
