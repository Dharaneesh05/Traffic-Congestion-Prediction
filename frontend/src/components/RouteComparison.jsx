import React from "react";

export default function RouteComparison({
  routeResult,
  activeStrategy = "forecast",
  onSelectStrategy,
  telemetry = null,
}) {
  if (!routeResult) return null;

  const strategies = [
    {
      key: "distance",
      name: "Shortest Distance",
    },
    {
      key: "congestion",
      name: "Live Congestion",
    },
    {
      key: "forecast",
      name: "TFT Forecast",
    },
  ];

  const recommendation = routeResult.recommendation || "forecast";

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-xs)",
        padding: "0.75rem 1rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <h2 style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
          ROUTE RECOMMENDATION
        </h2>

        {routeResult.savings?.time_saved_min > 0 && (
          <span style={{ fontSize: "0.6875rem", color: "#16a34a", fontWeight: 600 }}>
            Estimated savings: {routeResult.savings.time_saved_min.toFixed(1)} min
          </span>
        )}
      </div>

      {/* Compact Comparison Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border-default)", textAlign: "left" }}>
            <th style={{ padding: "0.35rem 0.5rem", color: "var(--text-muted)", fontWeight: 600, fontSize: "0.6875rem", textTransform: "uppercase" }}>Strategy</th>
            <th style={{ padding: "0.35rem 0.5rem", color: "var(--text-muted)", fontWeight: 600, fontSize: "0.6875rem", textTransform: "uppercase" }}>Distance</th>
            <th style={{ padding: "0.35rem 0.5rem", color: "var(--text-muted)", fontWeight: 600, fontSize: "0.6875rem", textTransform: "uppercase" }}>ETA</th>
            <th style={{ padding: "0.35rem 0.5rem", color: "var(--text-muted)", fontWeight: 600, fontSize: "0.6875rem", textTransform: "uppercase" }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {strategies.map((strat) => {
            const stratData = routeResult[strat.key];
            if (!stratData || !stratData.found) return null;

            const metrics = stratData.metrics;
            const distKm = (metrics.total_distance_m / 1000.0).toFixed(1);
            const timeMin = metrics.total_time_min.toFixed(0);
            const isRecommended = recommendation === strat.key;
            const isActive = activeStrategy === strat.key;

            return (
              <tr
                key={strat.key}
                onClick={() => onSelectStrategy && onSelectStrategy(strat.key)}
                style={{
                  cursor: "pointer",
                  background: isActive ? "#eff6ff" : "transparent",
                  borderBottom: "1px solid var(--border-light)",
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                <td style={{ padding: "0.45rem 0.5rem", color: "var(--text-primary)" }}>
                  {strat.name}
                </td>
                <td style={{ padding: "0.45rem 0.5rem", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                  {distKm} km
                </td>
                <td style={{ padding: "0.45rem 0.5rem", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                  {timeMin} min
                </td>
                <td style={{ padding: "0.45rem 0.5rem" }}>
                  {isRecommended ? (
                    <span
                      style={{
                        background: "#dcfce7",
                        color: "#15803d",
                        fontSize: "0.625rem",
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: "2px",
                      }}
                    >
                      Recommended
                    </span>
                  ) : (
                    <span style={{ color: "#94a3b8", fontSize: "0.6875rem" }}>
                      Alternative
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
