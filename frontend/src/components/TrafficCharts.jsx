import React from "react";
import { Car, Gauge } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

export default function TrafficCharts({ telemetryHistory = [] }) {
  const hasHistory = telemetryHistory && telemetryHistory.length >= 2;

  const avgVehicles = hasHistory
    ? Math.round(telemetryHistory.reduce((acc, curr) => acc + (curr.vehicles || 0), 0) / telemetryHistory.length)
    : 0;

  const avgSpeed = hasHistory
    ? (telemetryHistory.reduce((acc, curr) => acc + (curr.speed || 0), 0) / telemetryHistory.length).toFixed(1)
    : "0.0";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
      {/* 1. Vehicle Count Insights */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">
              <Car size={14} color="var(--status-normal, #22C55E)" />
              Detected Vehicles Inflow Curve
            </h3>
            <p className="card-subtitle">YOLO11 real-time vehicle accumulation</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--text-primary)" }}>
              {hasHistory ? telemetryHistory[telemetryHistory.length - 1]?.vehicles : "--"}
            </span>
            {hasHistory && (
              <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginLeft: "2px" }}>
                VEH
              </span>
            )}
          </div>
        </div>

        <div style={{ height: "140px", width: "100%" }}>
          {hasHistory ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={telemetryHistory} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light, #2C303C)" vertical={false} />
                <XAxis dataKey="time" stroke="var(--text-muted, #737987)" fontSize={9} tickLine={false} />
                <YAxis stroke="var(--text-muted, #737987)" fontSize={9} tickLine={false} domain={[0, 'auto']} />
                <Tooltip
                  contentStyle={{
                    background: "var(--bg-surface-elevated, #252936)",
                    border: "1px solid var(--border-default, #3D3F4E)",
                    borderRadius: "4px",
                    color: "var(--text-primary, #F4F5F7)",
                    fontSize: "11px",
                  }}
                />
                <ReferenceLine y={avgVehicles} stroke="var(--text-muted, #737987)" strokeDasharray="3 3" label={{ value: `Avg ${avgVehicles}`, fill: 'var(--text-muted, #737987)', fontSize: 9 }} />
                <Line
                  type="monotone"
                  dataKey="vehicles"
                  stroke="var(--status-normal, #22C55E)"
                  strokeWidth={2}
                  dot={{ r: 2, fill: "var(--status-normal, #22C55E)" }}
                  name="Vehicles"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--bg-card-subtle)",
                borderRadius: "var(--radius-sm)",
                border: "1px dashed var(--border-default)",
                color: "var(--text-muted)",
                fontSize: "0.75rem",
                textAlign: "center",
                padding: "1rem",
              }}
            >
              Awaiting live CCTV stream to record telemetry time-series curve.
            </div>
          )}
        </div>
      </div>

      {/* 2. Speed Insights */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">
              <Gauge size={14} color="var(--status-high, #F59E0B)" />
              Calibrated Velocity Curve
            </h3>
            <p className="card-subtitle">Pixel-calibrated corridor speed (km/h)</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--text-primary)" }}>
              {hasHistory ? telemetryHistory[telemetryHistory.length - 1]?.speed?.toFixed(1) : "--"}
            </span>
            {hasHistory && (
              <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginLeft: "2px" }}>
                km/h
              </span>
            )}
          </div>
        </div>

        <div style={{ height: "140px", width: "100%" }}>
          {hasHistory ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={telemetryHistory} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light, #2C303C)" vertical={false} />
                <XAxis dataKey="time" stroke="var(--text-muted, #737987)" fontSize={9} tickLine={false} />
                <YAxis stroke="var(--text-muted, #737987)" fontSize={9} tickLine={false} domain={[0, 'auto']} />
                <Tooltip
                  contentStyle={{
                    background: "var(--bg-surface-elevated, #252936)",
                    border: "1px solid var(--border-default, #3D3F4E)",
                    borderRadius: "4px",
                    color: "var(--text-primary, #F4F5F7)",
                    fontSize: "11px",
                  }}
                />
                <ReferenceLine y={Number(avgSpeed)} stroke="var(--text-muted, #737987)" strokeDasharray="3 3" label={{ value: `Avg ${avgSpeed}`, fill: 'var(--text-muted, #737987)', fontSize: 9 }} />
                <Line
                  type="monotone"
                  dataKey="speed"
                  stroke="var(--status-high, #F59E0B)"
                  strokeWidth={2}
                  dot={{ r: 2, fill: "var(--status-high, #F59E0B)" }}
                  name="Speed (km/h)"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--bg-card-subtle)",
                borderRadius: "var(--radius-sm)",
                border: "1px dashed var(--border-default)",
                color: "var(--text-muted)",
                fontSize: "0.75rem",
                textAlign: "center",
                padding: "1rem",
              }}
            >
              Awaiting live velocity telemetry stream to record speed variations.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
