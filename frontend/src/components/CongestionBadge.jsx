/**
 * CongestionBadge.jsx
 * Reusable color-coded badge showing congestion level.
 */

const LEVEL_CONFIG = {
  FREE_FLOW: { label: "Free Flow", className: "badge-success", dot: "#10b981" },
  LIGHT:     { label: "Light",     className: "badge-success", dot: "#34d399" },
  MODERATE:  { label: "Moderate",  className: "badge-warning", dot: "#f59e0b" },
  HEAVY:     { label: "Heavy",     className: "badge-orange",  dot: "#f97316" },
  CONGESTED: { label: "Congested", className: "badge-danger",  dot: "#ef4444" },
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
