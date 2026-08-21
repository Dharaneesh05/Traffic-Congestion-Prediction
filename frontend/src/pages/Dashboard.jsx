/**
 * Dashboard.jsx — Mode 2: Traffic Control Room
 * =============================================
 * Southern Tamil Nadu Traffic Monitoring Dashboard
 * Shows real-time congestion at 4 monitored locations,
 * live camera status, and AI recommendations.
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Activity, Car, Gauge, Wifi, TrendingUp,
  MapPin, AlertTriangle, Clock, Shield
} from "lucide-react";
import { getCamerasAggregate, getPrediction, getCameraStats, getAgentReport } from "../api";
import CongestionBadge from "../components/CongestionBadge";
import AIPanel from "../components/AIPanel";

// ── Static camera location cards (mirrored from backend config) ──
const LOCATION_CARDS = [
  { id: 1, name: "Salem Junction",  area: "Salem, Tamil Nadu",  icon: "🚦" },
  { id: 2, name: "Erode Toll",      area: "Erode, Tamil Nadu",  icon: "🛣️" },
  { id: 3, name: "Namakkal Signal", area: "Namakkal, TN",       icon: "🚦" },
  { id: 4, name: "Karur Bypass",    area: "Karur, Tamil Nadu",  icon: "🛤️" },
];

const KpiCard = ({ title, value, subtitle, icon: Icon, color }) => (
  <motion.div
    className="kpi-card"
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
  >
    <div className="flex items-center justify-between">
      <div className="text-xs text-muted uppercase tracking-wider font-bold">{title}</div>
      <div className="kpi-icon-bg" style={{ background: `${color}15` }}>
        <Icon size={16} color={color} />
      </div>
    </div>
    <div>
      <div className="text-3xl font-extrabold" style={{ color }}>{value}</div>
      <div className="text-xs text-muted mt-1">{subtitle}</div>
    </div>
  </motion.div>
);

const LocationStatusCard = ({ loc, index }) => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await getCameraStats(loc.id);
        setStats(data);
      } catch {}
    };
    fetch();
    const id = setInterval(fetch, 3000);
    return () => clearInterval(id);
  }, [loc.id]);

  const m     = stats?.metrics || {};
  const level = m.congestion_level || "FREE_FLOW";
  const score = m.congestion_score ?? 0;
  const isActive = stats?.is_processing ?? false;

  const barColor = score > 0.7 ? "var(--accent-danger)"
    : score > 0.45 ? "var(--accent-warning)"
    : "var(--accent-success)";

  return (
    <motion.div
      className="glass-card"
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.07 }}
      style={{ padding: "1rem 1.25rem" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: "1.25rem" }}>{loc.icon}</span>
          <div>
            <div className="font-bold text-sm">{loc.name}</div>
            <div className="text-xs text-muted">{loc.area}</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <CongestionBadge level={level} />
          <div className="flex items-center gap-1">
            <span className="status-dot" style={{
              background: isActive ? "var(--accent-success)" : "var(--text-muted)",
              boxShadow: isActive ? "0 0 5px var(--accent-success)" : "none"
            }} />
            <span className="text-xs text-muted">{isActive ? "LIVE" : "Standby"}</span>
          </div>
        </div>
      </div>

      <div className="congestion-bar mb-2">
        <motion.div
          className="congestion-fill"
          style={{ background: barColor }}
          initial={{ width: 0 }}
          animate={{ width: `${score * 100}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>

      <div className="flex justify-between text-xs text-muted">
        <span>
          Vehicles: <span className="font-mono font-bold text-primary">{m.vehicle_count ?? "—"}</span>
        </span>
        <span>
          Speed: <span className="font-mono font-bold text-warning">{m.average_speed_kmh?.toFixed(0) ?? "—"} km/h</span>
        </span>
        <span>
          Score: <span className="font-mono font-bold" style={{ color: barColor }}>{(score * 100).toFixed(0)}%</span>
        </span>
      </div>
    </motion.div>
  );
};

export default function Dashboard() {
  const [aggregate, setAggregate] = useState(null);
  const [forecast, setForecast]   = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [agg, p] = await Promise.all([getCamerasAggregate(), getPrediction()]);
        setAggregate(agg);
        if (p.forecast) setForecast(p.forecast);
      } catch {}
    };
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, []);

  // Network-wide totals from real aggregated camera data
  const hasActiveCamera = (aggregate?.active_camera_count ?? 0) > 0;
  const totalVehicles   = aggregate?.total_vehicles ?? null;
  const avgSpeed        = aggregate?.avg_speed_kmh ?? null;
  const avgScore        = aggregate?.avg_congestion_score ?? null;

  return (
    <div className="flex flex-col gap-6 fade-in">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Shield size={16} color="var(--accent-primary)" />
          <span className="text-xs text-muted uppercase tracking-wider font-bold">Traffic Control Room</span>
        </div>
        <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800 }}>
          Southern Tamil Nadu Traffic Monitoring
        </h2>
        <div className="text-sm text-muted mt-1">Real-time analysis powered by Agentic AI</div>
      </div>

      {/* KPI Cards — real aggregated data from all running cameras */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          title="Congestion Score"
          value={hasActiveCamera ? `${((avgScore ?? 0) * 100).toFixed(0)}%` : "NO DATA"}
          subtitle={hasActiveCamera ? `${aggregate.active_camera_count} camera${aggregate.active_camera_count > 1 ? 's' : ''} active` : "Start cameras to analyse"}
          icon={Activity}
          color="var(--accent-primary)"
        />
        <KpiCard
          title="Total Vehicles"
          value={hasActiveCamera ? (totalVehicles ?? "—") : "NO DATA"}
          subtitle="Counted across all cameras"
          icon={Car}
          color="var(--accent-success)"
        />
        <KpiCard
          title="Average Speed"
          value={hasActiveCamera ? `${avgSpeed?.toFixed(0) ?? 0} km/h` : "NO DATA"}
          subtitle="Mean velocity network-wide"
          icon={Gauge}
          color="var(--accent-warning)"
        />
        <KpiCard
          title="15-Min Forecast"
          value={forecast?.["15min"]?.level_q50?.replace("_", " ") || "—"}
          subtitle={forecast?.["15min"]?.q50 != null ? `Confidence: ${(forecast["15min"].q50 * 100).toFixed(0)}%` : "Waiting for data"}
          icon={TrendingUp}
          color="var(--accent-purple)"
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-3 gap-6" style={{ alignItems: "start" }}>
        {/* Location Status — 2/3 width */}
        <div className="col-span-2 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 style={{ margin: 0, color: "var(--text-primary)", fontWeight: 700 }}>
              Monitored Locations
            </h3>
            <div className="flex items-center gap-2">
              <span className="status-dot active" />
              <span className="text-xs text-muted">Live updating every 3s</span>
            </div>
          </div>

          {LOCATION_CARDS.map((loc, i) => (
            <LocationStatusCard key={loc.id} loc={loc} index={i} />
          ))}

          {/* Camera Status Summary — real is_processing state from backend */}
          <div className="glass-card" style={{ padding: "1rem 1.25rem" }}>
            <div className="font-bold text-sm mb-4">Live Camera Status</div>
            <div className="grid grid-cols-4 gap-3">
              {(aggregate?.per_camera ?? LOCATION_CARDS.map(l => ({ id: l.id, name: l.name, is_processing: false }))).map((cam) => (
                <div key={cam.id} className="text-center p-3 rounded-md" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <div className="flex items-center justify-center gap-1 mb-2">
                    <Wifi size={12} color={cam.is_processing ? "var(--accent-success)" : "var(--text-muted)"} />
                    <span className="text-xs font-bold" style={{ color: cam.is_processing ? "var(--accent-success)" : "var(--text-muted)" }}>
                      {cam.is_processing ? "LIVE" : "Standby"}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-sm" style={{ color: "var(--text-primary)" }}>Cam {cam.id}</div>
                  <div className="text-xs text-muted mt-1" style={{ fontSize: "0.65rem" }}>{cam.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI Panel — 1/3 width */}
        <div className="flex flex-col gap-4">
          <AIPanel />

          {/* TFT Quick Forecast */}
          {forecast && (
            <div className="glass-card" style={{ padding: "1rem 1.25rem" }}>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={14} color="var(--accent-purple)" />
                <div className="font-bold text-sm">TFT Congestion Forecast</div>
              </div>
              {["5min", "15min", "30min"].map((horizon) => {
                const d = forecast[horizon];
                if (!d) return null;
                return (
                  <div key={horizon} className="flex items-center justify-between py-2"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <div className="flex items-center gap-2">
                      <Clock size={11} color="var(--text-muted)" />
                      <span className="text-xs text-secondary">+{horizon.replace("min", "")} min</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-purple">
                        {(d.q50 * 100).toFixed(0)}%
                      </span>
                      <CongestionBadge level={d.level_q50} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
