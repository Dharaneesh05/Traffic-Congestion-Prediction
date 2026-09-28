/**
 * AIPanel.jsx
 * AI Recommendation panel with typing animation and severity indicators.
 */

import { useState, useEffect } from "react";
import { getAgentReport } from "../api";
import { Brain, AlertTriangle, Eye, CheckCircle, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const SEVERITY_CONFIG = {
  HIGH:   { icon: AlertTriangle, color: "var(--status-critical, #F45E70)", label: "Critical Action" },
  MEDIUM: { icon: Eye,           color: "var(--status-high, #F59E0B)",     label: "Monitor" },
  LOW:    { icon: CheckCircle,   color: "var(--status-normal, #22C55E)",   label: "Normal" },
};

const STATUS_COLOR = {
  CRITICAL:  "var(--status-critical, #F45E70)",
  ELEVATED:  "var(--status-high, #F59E0B)",
  NORMAL:    "var(--accent-soft-blue, #7B8BC8)",
  FREE_FLOW: "var(--status-normal, #22C55E)",
  idle:      "var(--text-muted, #737987)",
};

export default function AIPanel({ autoRefresh = true }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetch = async () => {
    setLoading(true);
    try {
      const data = await getAgentReport();
      setReport(data);
      setLastUpdated(new Date());
    } catch {
      // silently fail — backend may be idle
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
    if (!autoRefresh) return;
    const id = setInterval(fetch, 5000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  const statusColor = STATUS_COLOR[report?.status] || "var(--text-muted)";

  return (
    <div className="ai-panel">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div style={{ padding: "6px", borderRadius: "4px", background: "rgba(123, 139, 200, 0.15)" }}>
            <Brain size={18} color="var(--accent-soft-blue, #7B8BC8)" />
          </div>
          <div>
            <div className="font-bold text-sm" style={{ color: "var(--text-primary, #F4F5F7)" }}>Agentic AI Recommendations</div>
            <div className="text-xs text-muted">LangGraph Multi-Agent Analysis</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {loading && <div className="spinner" style={{ width: 14, height: 14, borderTopColor: "var(--accent-soft-blue, #7B8BC8)" }} />}
          <button
            onClick={fetch}
            className="btn btn-ghost"
            style={{ padding: "4px 8px", fontSize: "0.75rem" }}
            title="Refresh"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Network Status */}
      {report && (
        <div className="flex items-center justify-between mb-4 p-3 rounded-md"
          style={{ background: "var(--bg-surface-elevated, #252936)", border: "1px solid var(--border-default, #3D3F4E)" }}>
          <div>
            <div className="text-xs text-muted uppercase tracking-wider mb-1">Network Status</div>
            <div className="font-bold" style={{ color: statusColor }}>
              {report.status?.replace("_", " ") || "Idle"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted uppercase tracking-wider mb-1">Active Cameras</div>
            <div className="font-bold text-primary">{report.active_cameras ?? 0} / 4</div>
          </div>
          {report.avg_congestion_score != null && (
            <div className="text-right">
              <div className="text-xs text-muted uppercase tracking-wider mb-1">Avg Score</div>
              <div className="font-bold font-mono" style={{ color: statusColor }}>
                {(report.avg_congestion_score * 100).toFixed(0)}%
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      {report?.summary && (
        <p className="text-sm text-secondary mb-4" style={{ lineHeight: 1.6 }}>
          {report.summary}
        </p>
      )}

      {/* Recommendations */}
      {!report && !loading && (
        <div className="text-center text-muted text-sm py-4">
          Start cameras to receive AI recommendations.
        </div>
      )}

      {report?.recommendations?.length === 0 && report?.active_cameras > 0 && (
        <div className="flex items-center gap-2 text-sm text-success py-2">
          <CheckCircle size={16} />
          All monitored locations are operating normally.
        </div>
      )}

      <AnimatePresence>
        {report?.recommendations?.map((rec, i) => {
          const cfg = SEVERITY_CONFIG[rec.severity] || SEVERITY_CONFIG.LOW;
          const Icon = cfg.icon;
          return (
            <motion.div
              key={`${rec.camera}-${i}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: i * 0.1 }}
              className="mb-3 p-3 rounded-md"
              style={{
                background: `${cfg.color}08`,
                border: `1px solid ${cfg.color}30`,
              }}
            >
              <div className="flex items-start gap-3">
                <div style={{ padding: "5px", borderRadius: "6px", background: `${cfg.color}15`, flexShrink: 0 }}>
                  <Icon size={14} color={cfg.color} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm">{rec.camera}</span>
                    <span className="badge" style={{
                      fontSize: "0.6rem",
                      background: `${cfg.color}15`,
                      color: cfg.color,
                      border: `1px solid ${cfg.color}30`,
                    }}>
                      {rec.action}
                    </span>
                  </div>
                  <p className="text-xs text-secondary" style={{ lineHeight: 1.5 }}>
                    {rec.message}
                  </p>
                  <div className="flex items-center gap-1 mt-2">
                    <div className="text-xs text-muted">Confidence:</div>
                    <div className="text-xs font-bold" style={{ color: cfg.color }}>
                      {rec.confidence}%
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {lastUpdated && (
        <div className="text-xs text-muted mt-3">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
