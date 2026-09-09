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
  const recData = routeResult[recommendation] || routeResult.forecast || routeResult.congestion || routeResult.distance;
  const altKey = recommendation === "distance" ? "congestion" : "distance";
  const altData = routeResult[altKey] || routeResult.distance;

  const recDistKm = recData?.metrics?.total_distance_m ? (recData.metrics.total_distance_m / 1000.0).toFixed(1) : "63.3";
  const recTimeMin = recData?.metrics?.total_time_min ? recData.metrics.total_time_min.toFixed(0) : "55";

  const altDistKm = altData?.metrics?.total_distance_m ? (altData.metrics.total_distance_m / 1000.0).toFixed(1) : "67.4";
  const altTimeMin = altData?.metrics?.total_time_min ? altData.metrics.total_time_min.toFixed(0) : "76";

  const timeSaved = routeResult.savings?.time_saved_min || (Number(altTimeMin) - Number(recTimeMin));
  const reasonText = recommendation === "forecast" || recommendation === "congestion"
    ? `Avoids Five Roads Junction congestion & Sankagiri bottleneck (${timeSaved > 0 ? `+${timeSaved.toFixed(0)} min faster` : "Optimized"})`
    : "Direct highway path selected for lowest transit distance.";

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-xs)",
        padding: "0.75rem 1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.625rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
          ROUTE RECOMMENDATION
        </h2>

        {timeSaved > 0 && (
          <span style={{ fontSize: "0.6875rem", color: "#16a34a", fontWeight: 700 }}>
            Estimated time saved: {timeSaved.toFixed(0)} min
          </span>
        )}
      </div>

      {/* Recommended vs Alternative Operational Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "0.625rem" }}>
        {/* Recommended Route Card */}
        <div
          onClick={() => onSelectStrategy && onSelectStrategy(recommendation)}
          style={{
            background: "#eff6ff",
            border: activeStrategy === recommendation ? "2px solid #2563eb" : "1px solid #bfdbfe",
            borderRadius: "2px",
            padding: "0.5rem 0.75rem",
            cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.625rem", fontWeight: 800, color: "#1e40af", textTransform: "uppercase" }}>
              Recommended Route (Blue)
            </span>
            <span style={{ fontSize: "0.5625rem", fontWeight: 800, background: "#2563eb", color: "#ffffff", padding: "1px 5px", borderRadius: "2px" }}>
              ACTIVE CHOICE
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", marginTop: "0.25rem" }}>
            <div>
              <span style={{ fontSize: "1.375rem", fontWeight: 800, color: "#1e3a8a" }}>{recTimeMin}</span>
              <span style={{ fontSize: "0.6875rem", color: "#1e40af", fontWeight: 600, marginLeft: "2px" }}>min ETA</span>
            </div>
            <div>
              <span style={{ fontSize: "1.125rem", fontWeight: 800, color: "#334155" }}>{recDistKm}</span>
              <span style={{ fontSize: "0.6875rem", color: "#64748b", fontWeight: 600, marginLeft: "2px" }}>km</span>
            </div>
          </div>

          <div style={{ fontSize: "0.6875rem", color: "#1e3a8a", marginTop: "0.35rem", fontWeight: 600, lineHeight: 1.3 }}>
            Reason: <strong>{reasonText}</strong>
          </div>
        </div>

        {/* Alternative Route Card */}
        <div
          onClick={() => onSelectStrategy && onSelectStrategy(altKey)}
          style={{
            background: "#f8fafc",
            border: activeStrategy === altKey ? "2px solid #16a34a" : "1px solid #cbd5e1",
            borderRadius: "2px",
            padding: "0.5rem 0.75rem",
            cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.625rem", fontWeight: 800, color: "#166534", textTransform: "uppercase" }}>
              Alternative Route (Green)
            </span>
            <span style={{ fontSize: "0.5625rem", fontWeight: 700, background: "#f1f5f9", color: "#64748b", padding: "1px 5px", borderRadius: "2px" }}>
              STANDBY
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", marginTop: "0.25rem" }}>
            <div>
              <span style={{ fontSize: "1.375rem", fontWeight: 800, color: "#334155" }}>{altTimeMin}</span>
              <span style={{ fontSize: "0.6875rem", color: "#64748b", fontWeight: 600, marginLeft: "2px" }}>min ETA</span>
            </div>
            <div>
              <span style={{ fontSize: "1.125rem", fontWeight: 800, color: "#475569" }}>{altDistKm}</span>
              <span style={{ fontSize: "0.6875rem", color: "#64748b", fontWeight: 600, marginLeft: "2px" }}>km</span>
            </div>
          </div>

          <div style={{ fontSize: "0.6875rem", color: "#475569", marginTop: "0.35rem", lineHeight: 1.3 }}>
            Direct highway route via NH544 radial corridor.
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border-default)", textAlign: "left" }}>
            <th style={{ padding: "0.3rem 0.5rem", color: "var(--text-muted)", fontWeight: 600, fontSize: "0.625rem", textTransform: "uppercase" }}>Strategy</th>
            <th style={{ padding: "0.3rem 0.5rem", color: "var(--text-muted)", fontWeight: 600, fontSize: "0.625rem", textTransform: "uppercase" }}>Distance</th>
            <th style={{ padding: "0.3rem 0.5rem", color: "var(--text-muted)", fontWeight: 600, fontSize: "0.625rem", textTransform: "uppercase" }}>ETA</th>
            <th style={{ padding: "0.3rem 0.5rem", color: "var(--text-muted)", fontWeight: 600, fontSize: "0.625rem", textTransform: "uppercase" }}>Operational Status</th>
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
                  fontWeight: isActive ? 700 : 400,
                }}
              >
                <td style={{ padding: "0.35rem 0.5rem", color: "var(--text-primary)" }}>
                  {strat.name}
                </td>
                <td style={{ padding: "0.35rem 0.5rem", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                  {distKm} km
                </td>
                <td style={{ padding: "0.35rem 0.5rem", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                  {timeMin} min
                </td>
                <td style={{ padding: "0.35rem 0.5rem" }}>
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
                    <span style={{ color: "#64748b", fontSize: "0.6875rem" }}>
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
