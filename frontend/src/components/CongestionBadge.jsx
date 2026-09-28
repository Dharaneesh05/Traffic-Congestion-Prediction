/**
 * CongestionBadge.jsx
 * Reusable color-coded badge showing congestion level.
 */

const LEVEL_CONFIG = {
  FREE_FLOW: { label: "Free Flow", className: "badge-success", dot: "var(--status-normal, #22C55E)" },
  LIGHT:     { label: "Light",     className: "badge-success", dot: "var(--status-normal, #22C55E)" },
  MODERATE:  { label: "Moderate",  className: "badge-warning", dot: "var(--status-moderate, #C2BB91)" },
  HEAVY:     { label: "Heavy",     className: "badge-orange",  dot: "var(--status-high, #F59E0B)" },
  CONGESTED: { label: "Congested", className: "badge-danger",  dot: "var(--status-critical, #F45E70)" },
};

export default function CongestionBadge({ level, score, showScore = false }) {
  const cfg = LEVEL_CONFIG[level] || { label: level || "Unknown", className: "badge-ghost", dot: "#6b7280" };
  return (
    <span className={`badge ${cfg.className}`}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.dot, display: "inline-block" }} />
      {cfg.label}
      {showScore && score != null && (
        <span style={{ opacity: 0.7, marginLeft: 2 }}>({(score * 100).toFixed(0)}%)</span>
      )}
    </span>
  );
}
