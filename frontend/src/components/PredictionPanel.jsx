import React from "react";
import { TrendingUp, Cpu, Info, AlertTriangle } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export default function PredictionPanel({ forecast, currentCongestion = null }) {
  const horizons = [
    { key: "5min", label: "5 Min Ahead" },
    { key: "10min", label: "10 Min Ahead" },
    { key: "15min", label: "15 Min Ahead" },
    { key: "30min", label: "30 Min Ahead" },
  ];

  const hasValidForecast = forecast && forecast["5min"] && forecast["5min"].q50 != null;
  const isCollecting = !hasValidForecast;

  // Build chart dataset
  const currentVal = currentCongestion != null ? currentCongestion : 0.0;
  const chartData = hasValidForecast
    ? [
        {
          time: "Current",
          q10: Math.max(0, currentVal - 0.05),
          q50: currentVal,
          q90: Math.min(1.0, currentVal + 0.05),
        },
        ...horizons.map((h) => {
          const data = forecast?.[h.key];
          return {
            time: h.label.replace(" Ahead", ""),
            q10: data?.q10 ?? 0,
            q50: data?.q50 ?? 0,
            q90: data?.q90 ?? 0,
          };
        }),
      ]
    : [];

  const getBadgeStyle = (level) => {
    switch (level) {
      case "SEVERE":
      case "CRITICAL":
        return { bg: "rgba(244, 94, 112, 0.15)", text: "var(--status-critical, #F45E70)" };
      case "HIGH":
      case "HEAVY":
        return { bg: "rgba(245, 158, 11, 0.15)", text: "var(--status-high, #F59E0B)" };
      case "MODERATE":
        return { bg: "rgba(194, 187, 145, 0.15)", text: "var(--status-moderate, #C2BB91)" };
      default:
        return { bg: "rgba(34, 197, 94, 0.15)", text: "var(--status-normal, #22C55E)" };
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">
            <TrendingUp size={16} color="var(--accent-soft-blue, #7B8BC8)" />
            Traffic Forecast
          </h2>
          <p className="card-subtitle">
            Expected congestion trend and quantile distribution
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.2rem 0.5rem",
              borderRadius: "2px",
              fontSize: "0.6875rem",
              fontWeight: 700,
              background: "rgba(123, 139, 200, 0.15)",
              color: "var(--accent-soft-blue, #7B8BC8)",
              border: "1px solid rgba(123, 139, 200, 0.35)",
            }}
          >
            <Cpu size={12} />
            {hasValidForecast ? "Forecast Active" : "Awaiting Telemetry"}
          </span>
        </div>
      </div>

      {isCollecting ? (
        <div
          style={{
            padding: "1.25rem 1rem",
            background: "var(--bg-card-subtle)",
            border: "1px dashed var(--border-default)",
            borderRadius: "var(--radius-sm)",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <Info size={20} color="#64748b" />
          <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)" }}>
            Collecting telemetry — forecast will be available after sufficient history.
          </div>
          <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", maxWidth: "340px", margin: 0 }}>
            TFT requires rolling multi-minute telemetry observations (vehicle count, speed, density, flow, occupancy) to compute quantile forecasts.
          </p>
        </div>
      ) : (
        <>
          {/* 4 Horizon Metric Cards */}
          <div className="horizon-grid mb-3">
            {horizons.map((h) => {
              const item = forecast?.[h.key];
              const hasData = item && item.q50 != null;
              const q50 = hasData ? (item.q50 * 100).toFixed(0) : "--";
              const q10 = hasData && item.q10 != null ? (item.q10 * 100).toFixed(0) : "--";
              const q90 = hasData && item.q90 != null ? (item.q90 * 100).toFixed(0) : "--";
              const level = hasData ? item.level_q50 : null;
              const bStyle = getBadgeStyle(level);

              return (
                <div key={h.key} className="horizon-card">
                  <div className="horizon-time">{h.label}</div>
                  <div className="horizon-q50">
                    {q50}
                    {hasData && <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", marginLeft: "2px" }}>%</span>}
                  </div>
                  <div className="mt-1">
                    {level && (
                      <span
                        style={{
                          fontSize: "0.625rem",
                          padding: "0.1rem 0.35rem",
                          borderRadius: "2px",
                          fontWeight: 700,
                          background: bStyle.bg,
                          color: bStyle.text,
                        }}
                      >
                        {level}
                      </span>
                    )}
                  </div>
                  <div className="horizon-quantiles">
                    q10: {q10}% | q90: {q90}%
                  </div>
                </div>
              );
            })}
          </div>

          {/* Prediction Horizon Chart */}
          <div style={{ height: "130px", width: "100%", marginTop: "0.25rem" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorQ50" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-soft-blue, #7B8BC8)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--accent-soft-blue, #7B8BC8)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light, #2C303C)" vertical={false} />
                <XAxis dataKey="time" stroke="var(--text-muted, #737987)" fontSize={10} tickLine={false} />
                <YAxis
                  stroke="var(--text-muted, #737987)"
                  fontSize={10}
                  domain={[0, 1]}
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--bg-surface-elevated, #252936)",
                    border: "1px solid var(--border-default, #3D3F4E)",
                    borderRadius: "4px",
                    color: "var(--text-primary, #F4F5F7)",
                    fontSize: "11px",
                  }}
                  formatter={(val, name) => [
                    `${(val * 100).toFixed(1)}%`,
                    name === "q50" ? "Median Forecast (q50)" : name.toUpperCase(),
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="q90"
                  stroke="var(--text-muted, #737987)"
                  fill="transparent"
                  strokeDasharray="2 2"
                  name="q90"
                />
                <Area
                  type="monotone"
                  dataKey="q50"
                  stroke="var(--accent-soft-blue, #7B8BC8)"
                  strokeWidth={2}
                  fill="url(#colorQ50)"
                  name="q50"
                />
                <Area
                  type="monotone"
                  dataKey="q10"
                  stroke="var(--text-muted, #737987)"
                  fill="transparent"
                  strokeDasharray="2 2"
                  name="q10"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
