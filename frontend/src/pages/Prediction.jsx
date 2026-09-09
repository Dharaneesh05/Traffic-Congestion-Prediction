/**
 * Prediction.jsx — TFT Congestion Prediction Page
 * ==================================================
 * Shows multi-horizon forecasts from the existing Temporal Fusion Transformer.
 * Horizons: 5min, 10min, 15min, 30min + 1hr & 2hr extrapolations.
 */

import { useState, useEffect } from "react";
import { getPrediction } from "../api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, AreaChart, Area
} from "recharts";
import { motion } from "framer-motion";
import { TrendingUp, AlertTriangle, CheckCircle, Clock, Brain } from "lucide-react";
import CongestionBadge from "../components/CongestionBadge";

const HORIZONS = [
  { key: "5min",  label: "+5 min",  extrapolated: false },
  { key: "10min", label: "+10 min", extrapolated: false },
  { key: "15min", label: "+15 min", extrapolated: false },
  { key: "30min", label: "+30 min", extrapolated: false },
  { key: "1hr",   label: "+1 hr",   extrapolated: true  },
  { key: "2hr",   label: "+2 hrs",  extrapolated: true  },
];

const getColor = (level) => {
  switch (level) {
    case "FREE_FLOW": return "var(--accent-success)";
    case "LIGHT":     return "#34d399";
    case "MODERATE":  return "var(--accent-warning)";
    case "HEAVY":     return "var(--accent-orange)";
    case "CONGESTED": return "var(--accent-danger)";
    default:          return "var(--accent-primary)";
  }
};

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="glass-card" style={{ padding: "0.875rem 1rem", border: "1px solid rgba(255,255,255,0.1)", minWidth: 180 }}>
      <p className="font-bold mb-2">{label} Forecast</p>
      <div className="flex flex-col gap-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-muted">Worst Case (q90):</span>
          <span className="font-mono font-bold text-danger">{d?.q90?.toFixed(2)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted">Expected (q50):</span>
          <span className="font-mono font-bold" style={{ color: getColor(d?.level) }}>{d?.q50?.toFixed(2)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted">Best Case (q10):</span>
          <span className="font-mono font-bold text-success">{d?.q10?.toFixed(2)}</span>
        </div>
      </div>
      <div className="mt-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <CongestionBadge level={d?.level} />
      </div>
    </div>
  );
};

export default function Prediction() {
  const [forecast, setForecast] = useState(null);
  const [history, setHistory]   = useState([]);

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await getPrediction();
        if (data.forecast) {
          const f = data.forecast;
          setForecast(f);
          // Build history for trend chart
          if (f["15min"]) {
            setHistory((prev) => {
              const point = {
                time: new Date().toLocaleTimeString([], { hour12: false }),
                q50: +(f["15min"].q50 || 0).toFixed(3),
              };
              return [...prev, point].slice(-30);
            });
          }
        }
      } catch {}
    };
    fetch();
    const id = setInterval(fetch, 2000);
    return () => clearInterval(id);
  }, []);

  // Build chart data for all horizons
  const chartData = HORIZONS.map(({ key, label, extrapolated }) => {
    const d = forecast?.[key];
    if (!d) return { name: label, q10: null, q50: null, q90: null, level: null, extrapolated };
    return { name: label, q10: d.q10, q50: d.q50, q90: d.q90, level: d.level_q50, extrapolated };
  }).filter((d) => d.q50 != null);

  const modelInfo = forecast?.model_info;

  return (
    <div className="flex flex-col gap-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Brain size={16} color="var(--accent-purple)" />
            <span className="text-xs text-muted uppercase tracking-wider font-bold">Traffic Forecasting</span>
          </div>
          <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800 }}>Congestion Forecast & Trends</h2>
          <div className="text-sm text-muted mt-1">Multi-horizon congestion forecasts and confidence intervals</div>
        </div>
        {modelInfo && (
          <div className="glass-card-flat" style={{ padding: "0.625rem 1rem" }}>
            <div className="text-xs text-muted mb-1">Model Status</div>
            <div className={`font-bold text-sm ${modelInfo.is_trained ? "text-success" : "text-warning"}`}>
              {modelInfo.is_trained ? "✓ Trained Model" : "⚡ Heuristic Fallback"}
            </div>
          </div>
        )}
      </div>

      {/* Horizon cards */}
      <div className="grid grid-cols-4 gap-4">
        {HORIZONS.slice(0, 4).map(({ key, label }) => {
          const d = forecast?.[key];
          if (!d) return (
            <div key={key} className="kpi-card">
              <div className="text-xs text-muted">{label}</div>
              <div className="skeleton" style={{ height: 32, marginTop: 8, borderRadius: 6 }} />
            </div>
          );
          return (
            <motion.div
              key={key}
              className="kpi-card"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: HORIZONS.findIndex(h => h.key === key) * 0.07 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs text-muted">
                  <Clock size={11} />
                  {label}
                </div>
                <CongestionBadge level={d.level_q50} />
              </div>
              <div>
                <div className="text-3xl font-extrabold" style={{ color: getColor(d.level_q50) }}>
                  {(d.q50 * 100).toFixed(0)}%
                </div>
                <div className="text-xs text-muted mt-1">
                  Range: {(d.q10 * 100).toFixed(0)}% – {(d.q90 * 100).toFixed(0)}%
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Main chart + sidebar */}
      <div className="grid grid-cols-3 gap-6">
        <motion.div className="glass-card col-span-2 flex flex-col" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h3 style={{ margin: 0, color: "var(--text-primary)", fontWeight: 700, marginBottom: "0.375rem" }}>
            Multi-Horizon Congestion Prediction
          </h3>
          <div className="text-xs text-muted mb-5">
            Bars show expected congestion score (q50). Tooltips reveal uncertainty interval [q10–q90].
          </div>
          <div style={{ flex: 1, minHeight: 300 }}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tick={{ fill: "var(--text-muted)" }} tickLine={false} />
                <YAxis domain={[0, 1]} stroke="var(--text-muted)" fontSize={10} tick={{ fill: "var(--text-muted)" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.02)" }} />
                <ReferenceLine y={0.8} stroke="var(--accent-danger)" strokeDasharray="4 4"
                  label={{ position: "insideTopLeft", value: "Congested Threshold", fill: "var(--accent-danger)", fontSize: 9 }} />
                <ReferenceLine y={0.5} stroke="var(--accent-warning)" strokeDasharray="4 4"
                  label={{ position: "insideTopLeft", value: "Heavy Threshold", fill: "var(--accent-warning)", fontSize: 9 }} />
                <Bar dataKey="q50" name="Expected Score" radius={[5, 5, 0, 0]} isAnimationActive={false}>
                  {chartData.map((e, i) => (
                    <Cell key={i} fill={getColor(e.level)} opacity={e.extrapolated ? 0.55 : 0.9} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <div className="flex flex-col gap-4">
          {/* Risk Assessment */}
          <motion.div className="glass-card" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}>
            <h3 style={{ margin: 0, color: "var(--text-primary)", fontWeight: 700, marginBottom: "1rem" }}>
              Risk Assessment
            </h3>
            <div className="flex flex-col gap-2">
              {chartData.map((d, i) => {
                const isHigh = d.q90 > 0.8;
                const isMed  = d.q90 > 0.5 && !isHigh;
                return (
                  <div key={i} className="flex justify-between items-center p-2 rounded-md"
                    style={{ background: "rgba(255,255,255,0.025)" }}>
                    <div className="flex items-center gap-2 text-xs">
                      <Clock size={11} color="var(--text-muted)" />
                      {d.name}
                    </div>
                    {isHigh ? (
                      <span className="badge badge-danger"><AlertTriangle size={9} /> High Risk</span>
                    ) : isMed ? (
                      <span className="badge badge-warning">Medium Risk</span>
                    ) : (
                      <span className="badge badge-success"><CheckCircle size={9} /> Low Risk</span>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Congestion probability gauge cards */}
          <motion.div className="glass-card" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <h3 style={{ margin: 0, color: "var(--text-primary)", fontWeight: 700, marginBottom: "1rem" }}>
              Congestion Probability
            </h3>
            <div className="flex flex-col gap-3">
              {chartData.slice(0, 4).map((d, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-secondary">{d.name}</span>
                    <span className="font-mono font-bold" style={{ color: getColor(d.level) }}>
                      {(d.q50 * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="congestion-bar">
                    <motion.div
                      className="congestion-fill"
                      style={{ background: getColor(d.level) }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(d.q50 || 0) * 100}%` }}
                      transition={{ duration: 0.8, delay: i * 0.1 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Model info */}
          {modelInfo && (
            <motion.div className="glass-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
              <h3 style={{ margin: 0, color: "var(--text-primary)", fontWeight: 700, marginBottom: "0.875rem" }}>
                Model Info
              </h3>
              <div className="flex flex-col gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted">Lookback Window</span>
                  <span className="font-mono font-bold">{modelInfo.lookback_min} min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Quantiles</span>
                  <span className="font-mono font-bold">q10, q50, q90</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Architecture</span>
                  <span className="font-mono font-bold">TFT (Lim et al.)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Horizons</span>
                  <span className="font-mono font-bold">5·10·15·30 min</span>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
