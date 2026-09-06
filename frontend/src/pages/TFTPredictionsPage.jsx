import React from "react";
import PredictionPanel from "../components/PredictionPanel";
import { TrendingUp, Cpu, ShieldCheck, Layers, Info, Activity } from "lucide-react";

export default function TFTPredictionsPage({ forecast, telemetry }) {
  const horizons = [
    { key: "5min", label: "5-Minute Horizon", desc: "Short-range junction queue prediction" },
    { key: "10min", label: "10-Minute Horizon", desc: "Corridor bottleneck propagation estimate" },
    { key: "15min", label: "15-Minute Horizon", desc: "Medium-range highway flow forecast" },
    { key: "30min", label: "30-Minute Horizon", desc: "Strategic arterial diversion window" },
  ];

  const hasData = forecast && forecast["5min"] && forecast["5min"].q50 != null;

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Header Overview Banner */}
      <div className="card" style={{ padding: "0.875rem 1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "var(--radius-xs)",
                background: "var(--state-purple-subtle)",
                border: "1px solid rgba(124, 58, 237, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--state-purple)",
              }}
            >
              <TrendingUp size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: "1rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                Temporal Fusion Transformer (TFT) Forecasting Console
              </h2>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>
                Multi-horizon quantile traffic congestion forecasting with 60-minute historical lookback
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span className="status-pill purple">
              <Cpu size={12} />
              {forecast?.telemetry_status === "trained_tft" ? "Trained TFT Active" : "TFT Standby"}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Main Forecast Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "1.25rem" }}>
        {/* Left: Prediction Panel & Quantile Table */}
        <div className="flex flex-col gap-4">
          <PredictionPanel
            forecast={forecast}
            currentCongestion={telemetry?.congestion_score}
          />

          {/* Quantile Details Table */}
          <div className="card">
            <h3 className="card-title mb-2">
              <Layers size={14} color="var(--state-purple)" />
              Quantile Probability Distribution Matrix
            </h3>

            <table className="route-table">
              <thead>
                <tr>
                  <th>Horizon</th>
                  <th>q10 (Optimistic)</th>
                  <th>q50 (Expected)</th>
                  <th>q90 (Pessimistic)</th>
                  <th>Risk Classification</th>
                </tr>
              </thead>
              <tbody>
                {horizons.map((h) => {
                  const data = forecast?.[h.key];
                  const q10 = data?.q10 != null ? `${(data.q10 * 100).toFixed(1)}%` : "--";
                  const q50 = data?.q50 != null ? `${(data.q50 * 100).toFixed(1)}%` : "--";
                  const q90 = data?.q90 != null ? `${(data.q90 * 100).toFixed(1)}%` : "--";
                  const level = data?.level_q50 || "STANDBY";

                  return (
                    <tr key={h.key}>
                      <td style={{ fontWeight: 700 }}>{h.label}</td>
                      <td style={{ fontFamily: "var(--font-mono)" }}>{q10}</td>
                      <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text-primary)" }}>{q50}</td>
                      <td style={{ fontFamily: "var(--font-mono)" }}>{q90}</td>
                      <td>
                        <span
                          className="status-pill"
                          style={{
                            fontSize: "0.625rem",
                            padding: "0.1rem 0.35rem",
                            background:
                              level === "SEVERE"
                                ? "var(--state-red-subtle)"
                                : level === "HEAVY" || level === "MODERATE"
                                ? "var(--state-amber-subtle)"
                                : "var(--state-green-subtle)",
                            color:
                              level === "SEVERE"
                                ? "var(--state-red)"
                                : level === "HEAVY" || level === "MODERATE"
                                ? "#92400e"
                                : "#065f46",
                          }}
                        >
                          {level}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Model Architecture & Parameter Specs */}
        <div className="flex flex-col gap-4">
          <div className="card">
            <h3 className="card-title mb-2">
              <Cpu size={14} color="var(--state-purple)" />
              TFT Neural Architecture Metadata
            </h3>

            <div className="flex flex-col gap-2" style={{ fontSize: "0.75rem" }}>
              <div style={{ background: "var(--bg-card-subtle)", padding: "0.625rem", borderRadius: "var(--radius-xs)" }}>
                <span style={{ color: "var(--text-muted)", fontSize: "0.6875rem", display: "block" }}>Model Weights File</span>
                <strong style={{ fontFamily: "var(--font-mono)" }}>models/tft.keras</strong>
              </div>

              <div style={{ background: "var(--bg-card-subtle)", padding: "0.625rem", borderRadius: "var(--radius-xs)" }}>
                <span style={{ color: "var(--text-muted)", fontSize: "0.6875rem", display: "block" }}>Trainable Parameters</span>
                <strong>296,981 Parameters</strong>
              </div>

              <div style={{ background: "var(--bg-card-subtle)", padding: "0.625rem", borderRadius: "var(--radius-xs)" }}>
                <span style={{ color: "var(--text-muted)", fontSize: "0.6875rem", display: "block" }}>Lookback Temporal Context</span>
                <strong>60 Minutes Continuous History</strong>
              </div>

              <div style={{ background: "var(--bg-card-subtle)", padding: "0.625rem", borderRadius: "var(--radius-xs)" }}>
                <span style={{ color: "var(--text-muted)", fontSize: "0.6875rem", display: "block" }}>Input Telemetry Dimensions</span>
                <strong>6 Features (Vehicles, Density, Speed, Flow, Occupancy, Congestion)</strong>
              </div>

              <div style={{ background: "var(--bg-card-subtle)", padding: "0.625rem", borderRadius: "var(--radius-xs)" }}>
                <span style={{ color: "var(--text-muted)", fontSize: "0.6875rem", display: "block" }}>Attention Heads</span>
                <strong>4 Multi-Head Temporal Self-Attention Heads</strong>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title mb-2">
              <Activity size={14} color="var(--state-purple)" />
              Route Engine Injection Status
            </h3>
            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              The 5-minute median predicted congestion score ($q_{50}$) is dynamically injected into the A* routing engine, applying a proportional spatial delay penalty to road segments around Sankagiri Junction.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
