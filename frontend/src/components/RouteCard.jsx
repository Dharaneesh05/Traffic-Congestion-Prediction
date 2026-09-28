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
        background: active ? "var(--bg-surface-elevated, #252936)" : "var(--bg-surface, #1B2028)",
        border: `1px solid ${active ? "var(--accent-soft-blue, #7B8BC8)" : "var(--border-default, #3D3F4E)"}`,
        borderLeft: active ? "3px solid var(--accent-soft-blue, #7B8BC8)" : "1px solid var(--border-default, #3D3F4E)",
        borderRadius: "4px",
        padding: "0.75rem 0.875rem",
        cursor: "pointer",
        transition: "all 0.15s ease",
        color: "var(--text-primary, #F4F5F7)",
        fontFamily: "var(--font-sans)",
        position: "relative",
      }}
    >
      {isRecommended && (
        <div style={{
          position: "absolute", top: -8, right: 10,
          background: "var(--accent-soft-blue, #7B8BC8)",
          color: "#111315", fontSize: "0.5625rem", fontWeight: 800,
          padding: "2px 6px", borderRadius: "2px",
          letterSpacing: "0.05em",
        }}>
          RECOMMENDED
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
        <div style={{
          width: 28, height: 28, borderRadius: "4px",
          background: active ? "rgba(123, 139, 200, 0.15)" : "var(--bg-surface-secondary, #2C303C)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
        }}>
          <Icon size={14} color={active ? "var(--accent-soft-blue, #7B8BC8)" : "var(--text-secondary, #A7ACB8)"} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.8125rem", color: "var(--text-primary, #F4F5F7)" }}>{cfg.label}</div>
          <div style={{ fontSize: "0.6875rem", color: "var(--text-muted, #737987)" }}>{cfg.subtitle}</div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <CongestionBadge level={level} />
        </div>
      </div>

      <div style={{ display: "flex", gap: "1rem", marginTop: "0.375rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.6875rem", color: "var(--text-secondary, #A7ACB8)" }}>
          <Navigation2 size={11} />
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text-primary, #F4F5F7)" }}>{dist} km</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.6875rem", color: "var(--text-secondary, #A7ACB8)" }}>
          <Clock size={11} />
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text-primary, #F4F5F7)" }}>{time} min</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.6875rem", color: "var(--text-secondary, #A7ACB8)" }}>
          <AlertTriangle size={11} />
          <span style={{
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            color: score > 0.5 ? "var(--status-critical, #F45E70)" : score > 0.3 ? "var(--status-high, #F59E0B)" : "var(--status-normal, #22C55E)"
          }}>
            {(score * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    </button>
  );
}
