/**
 * RouteCard.jsx
 * Displays a single route option (A/B/C) with congestion and timing info.
 */

import { Navigation2, Clock, AlertTriangle, TrendingUp } from "lucide-react";
import CongestionBadge from "./CongestionBadge";

const STRATEGY_LABELS = {
  distance:   { label: "Route A — Shortest",   subtitle: "Minimum distance path",   icon: Navigation2 },
  congestion: { label: "Route B — Less Traffic", subtitle: "Avoids current congestion", icon: AlertTriangle },
  forecast:   { label: "Route C — AI Optimised", subtitle: "TFT forecast-aware path",   icon: TrendingUp },
};

export default function RouteCard({ strategy, data, isRecommended, onClick, active }) {
  const cfg = STRATEGY_LABELS[strategy] || { label: strategy, subtitle: "", icon: Navigation2 };
  const Icon = cfg.icon;

  if (!data) return null;

  const dist   = ((data.metrics?.total_distance_m || 0) / 1000).toFixed(1);
  const time   = (data.metrics?.total_time_min || 0).toFixed(0);
  const score  = data.metrics?.avg_congestion || 0;
  const level  = score > 0.7 ? "CONGESTED" : score > 0.5 ? "HEAVY" : score > 0.3 ? "MODERATE" : score > 0.1 ? "LIGHT" : "FREE_FLOW";

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        background: active ? "rgba(59,130,246,0.08)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${active ? "rgba(59,130,246,0.35)" : "rgba(255,255,255,0.06)"}`,
        borderRadius: "12px",
        padding: "0.875rem 1rem",
        cursor: "pointer",
        transition: "all 0.2s ease",
        color: "var(--text-primary)",
        fontFamily: "var(--font-family)",
        position: "relative",
      }}
    >
      {isRecommended && (
        <div style={{
          position: "absolute", top: -10, right: 12,
          background: "var(--accent-primary)",
          color: "white", fontSize: "0.6rem", fontWeight: 800,
          padding: "2px 8px", borderRadius: "999px",
          letterSpacing: "0.08em",
        }}>
          ★ RECOMMENDED
        </div>
      )}

      <div className="flex items-center gap-3 mb-2">
        <div style={{
          width: 32, height: 32, borderRadius: "8px",
          background: active ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.04)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
        }}>
          <Icon size={15} color={active ? "var(--accent-primary)" : "var(--text-secondary)"} />
        </div>
        <div>
          <div className="font-bold text-sm">{cfg.label}</div>
          <div className="text-xs text-muted">{cfg.subtitle}</div>
        </div>
        <div className="ml-auto">
          <CongestionBadge level={level} />
        </div>
      </div>

      <div className="flex gap-4 mt-2">
        <div className="flex items-center gap-1 text-xs text-secondary">
          <Navigation2 size={11} />
          <span className="font-mono font-bold text-primary">{dist} km</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-secondary">
          <Clock size={11} />
          <span className="font-mono font-bold text-primary">{time} min</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-secondary">
          <AlertTriangle size={11} />
          <span className="font-mono font-bold" style={{
            color: score > 0.5 ? "var(--accent-danger)" : score > 0.3 ? "var(--accent-warning)" : "var(--accent-success)"
          }}>
            {(score * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    </button>
  );
}
