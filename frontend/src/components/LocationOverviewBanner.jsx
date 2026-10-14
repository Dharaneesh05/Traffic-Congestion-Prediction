import React from "react";
import { X } from "lucide-react";
import { useSettings } from "../context/SettingsContext";

export default function LocationOverviewBanner({
  overview,
  districtName = "Tamil Nadu",
  junctions = [],
  onClose,
}) {
  const { t, tJunction } = useSettings();
  if (!overview && !districtName && (!junctions || junctions.length === 0)) return null;

  let titlePrefix = t("common.locationUnavailable", "Current location unavailable").toUpperCase();
  if (districtName && districtName.toLowerCase() !== "tamil nadu") {
    titlePrefix = (tJunction ? tJunction(districtName) : districtName).toUpperCase();
  } else if (overview?.districtName) {
    titlePrefix = (tJunction ? tJunction(overview.districtName) : overview.districtName).toUpperCase();
  } else if (districtName) {
    titlePrefix = (tJunction ? tJunction(districtName) : districtName).toUpperCase();
  }

  const majorCount = overview?.majorJunctionsCount ?? junctions.length ?? 0;
  const highRiskCount = overview?.highRiskJunctionsCount ?? junctions.filter((j) => (j.congestionScore || 0) >= 0.61).length ?? 0;
  const onlineCams = overview?.availableCamerasCount ?? junctions.reduce((acc, j) => acc + (j.cameras?.filter((c) => c.status === "ONLINE").length || 0), 0);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.25rem 0.25rem 0.45rem 0.25rem",
        borderBottom: "1px solid var(--border-default, #3D3F4E)",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        flexWrap: "wrap",
        gap: "0.5rem 1rem",
      }}
    >
      {/* Location Typographic Heading & Inline Operational Stats (Big Bold Values & Clear Wording) */}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.6rem 0.85rem", padding: "0.25rem 0" }}>
        <span
          style={{
            fontSize: "1.375rem",
            fontWeight: 900,
            color: "var(--text-primary, #F4F5F7)",
            letterSpacing: "0.02em",
            lineHeight: 1.1,
          }}
        >
          {titlePrefix}
        </span>

        <span style={{ color: "var(--text-muted, #737987)", fontWeight: 900, fontSize: "1.25rem", lineHeight: 1 }}>·</span>

        <div style={{ display: "inline-flex", alignItems: "baseline", gap: "0.35rem" }}>
          <span
            style={{
              fontSize: "1.375rem",
              fontWeight: 900,
              color: "var(--text-primary, #F4F5F7)",
              lineHeight: 1,
              fontFamily: "var(--font-mono)",
            }}
          >
            {majorCount}
          </span>
          <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-secondary, #C5CBD6)", letterSpacing: "0.01em" }}>
            {t("kpi.junctions", "Junctions")}
          </span>
        </div>

        <span style={{ color: "var(--text-muted, #737987)", fontWeight: 900, fontSize: "1.25rem", lineHeight: 1 }}>·</span>

        <div style={{ display: "inline-flex", alignItems: "baseline", gap: "0.35rem" }}>
          <span
            style={{
              fontSize: "1.375rem",
              fontWeight: 900,
              color: "var(--status-normal, #22C55E)",
              lineHeight: 1,
              fontFamily: "var(--font-mono)",
            }}
          >
            {onlineCams}
          </span>
          <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-secondary, #C5CBD6)", letterSpacing: "0.01em" }}>
            {t("kpi.camerasOnline", "Cameras Online")}
          </span>
        </div>

        <span style={{ color: "var(--text-muted, #737987)", fontWeight: 900, fontSize: "1.25rem", lineHeight: 1 }}>·</span>

        <div style={{ display: "inline-flex", alignItems: "baseline", gap: "0.35rem" }}>
          <span
            style={{
              fontSize: "1.375rem",
              fontWeight: 900,
              color: highRiskCount > 0 ? "var(--status-critical, #F45E70)" : "var(--text-primary, #F4F5F7)",
              lineHeight: 1,
              fontFamily: "var(--font-mono)",
            }}
          >
            {highRiskCount}
          </span>
          <span
            style={{
              fontSize: "0.875rem",
              fontWeight: 700,
              color: highRiskCount > 0 ? "var(--status-critical, #F45E70)" : "var(--text-secondary, #C5CBD6)",
              letterSpacing: "0.01em",
            }}
          >
            {t("kpi.attentionRequired", "Attention Required")}
          </span>
        </div>
      </div>

      {onClose && (
        <button
          onClick={onClose}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: "var(--text-muted, #737987)",
            padding: "2px 4px",
            display: "flex",
            alignItems: "center",
            borderRadius: "3px",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary, #F4F5F7)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted, #737987)")}
          title={t("common.close", "Dismiss Overview")}
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}
