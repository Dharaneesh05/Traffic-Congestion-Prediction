import React, { useState, useEffect } from "react";
import { Navigation2, ArrowRightLeft, Loader2, AlertTriangle, ShieldCheck, CornerDownRight } from "lucide-react";
import { TAMIL_NADU_LOCATIONS } from "../locations";

const STANDARD_CORRIDORS = [
  { from: "Salem Bus Stand", to: "Erode Bus Stand", label: "Salem → Erode" },
  { from: "Karur Bus Stand", to: "Namakkal Bus Stand", label: "Karur → Namakkal" },
  { from: "Salem Junction", to: "Coimbatore", label: "Salem → Coimbatore" },
  { from: "Chennai", to: "Trichy", label: "Chennai → Trichy" },
  { from: "Madurai", to: "Kanyakumari", label: "Madurai → Kanyakumari" },
];

export default function RoutePlanner({
  locations = [],
  onPlanRoute,
  isLoading = false,
  selectedFrom = "Salem Bus Stand",
  selectedTo = "Erode Bus Stand",
  selectedJunction = null,
  onEvaluateDiversion,
  diversionData = null,
  onClearDiversion,
}) {
  const [fromName, setFromName] = useState(selectedFrom);
  const [toName, setToName] = useState(selectedTo);

  // Combine backend locations with master catalog
  const combinedLocations = Array.from(
    new Map([...locations, ...TAMIL_NADU_LOCATIONS].map((item) => [item.name, item])).values()
  );

  useEffect(() => {
    if (selectedFrom) setFromName(selectedFrom);
  }, [selectedFrom]);

  useEffect(() => {
    if (selectedTo) setToName(selectedTo);
  }, [selectedTo]);

  const handleSwap = () => {
    const temp = fromName;
    setFromName(toName);
    setToName(temp);
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (fromName && toName && onPlanRoute) {
      onPlanRoute(fromName, toName);
    }
  };

  const handleQuickRoute = (r) => {
    setFromName(r.from);
    setToName(r.to);
    if (onPlanRoute) {
      onPlanRoute(r.from, r.to);
    }
  };

  const hasDiversion = selectedJunction?.diversion != null;
  const divInfo = selectedJunction?.diversion;

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-xs)",
        padding: "0.75rem 1rem",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: "0.625rem",
      }}
    >
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <h2 style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            ROUTE PLANNER & DIVERSION
          </h2>
        </div>

        {/* Junction Diversion Advisory Box if selected junction has active congestion */}
        {hasDiversion && (
          <div
            style={{
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: "2px",
              padding: "0.5rem 0.625rem",
              marginBottom: "0.625rem",
              fontSize: "0.6875rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
              <strong style={{ color: "#1e40af" }}>{selectedJunction.name} Diversion</strong>
              <span style={{ color: "#16a34a", fontWeight: 700 }}>
                Est. Save: {divInfo.timeSavedMin || 14} min
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "2px", color: "#334155" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#dc2626" }} />
                <span>Congested: <strong>{divInfo.congestedSegmentName}</strong></span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2563eb" }} />
                <span>Recommended: <strong>{divInfo.recommendedName}</strong></span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a" }} />
                <span>Alternative: <strong>{divInfo.alternativeName}</strong></span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "4px", marginTop: "6px" }}>
              <button
                onClick={() => onEvaluateDiversion && onEvaluateDiversion(selectedJunction)}
                style={{
                  flex: 1,
                  padding: "3px 6px",
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  background: "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "2px",
                  cursor: "pointer",
                }}
              >
                Render Diversion on Map
              </button>

              {diversionData && onClearDiversion && (
                <button
                  onClick={onClearDiversion}
                  style={{
                    padding: "3px 6px",
                    fontSize: "0.625rem",
                    fontWeight: 600,
                    background: "#f1f5f9",
                    color: "#64748b",
                    border: "1px solid #cbd5e1",
                    borderRadius: "2px",
                    cursor: "pointer",
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {/* Standard Corridor Route Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {/* Origin */}
          <div>
            <label style={{ fontSize: "0.625rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: "2px" }}>
              Origin Location
            </label>
            <select
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              style={{
                width: "100%",
                padding: "0.35rem 0.5rem",
                fontSize: "0.75rem",
                background: "#ffffff",
                border: "1px solid var(--border-default)",
                borderRadius: "2px",
                color: "var(--text-primary)",
              }}
            >
              {combinedLocations.map((loc) => (
                <option key={`from-${loc.name}`} value={loc.name}>
                  {loc.name} {loc.district ? `(${loc.district})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Swap Button */}
          <div style={{ display: "flex", justifyContent: "center", margin: "-2px 0" }}>
            <button
              type="button"
              onClick={handleSwap}
              style={{
                border: "1px solid var(--border-default)",
                background: "#ffffff",
                borderRadius: "2px",
                padding: "2px 6px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "2px",
                fontSize: "0.625rem",
                color: "var(--text-muted)",
              }}
            >
              <ArrowRightLeft size={10} />
              <span>Swap</span>
            </button>
          </div>

          {/* Destination */}
          <div>
            <label style={{ fontSize: "0.625rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: "2px" }}>
              Destination Location
            </label>
            <select
              value={toName}
              onChange={(e) => setToName(e.target.value)}
              style={{
                width: "100%",
                padding: "0.35rem 0.5rem",
                fontSize: "0.75rem",
                background: "#ffffff",
                border: "1px solid var(--border-default)",
                borderRadius: "2px",
                color: "var(--text-primary)",
              }}
            >
              {combinedLocations.map((loc) => (
                <option key={`to-${loc.name}`} value={loc.name}>
                  {loc.name} {loc.district ? `(${loc.district})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Calculate Route Button */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              marginTop: "0.3rem",
              background: "#0f172a",
              color: "#ffffff",
              border: "none",
              borderRadius: "2px",
              padding: "0.45rem",
              fontSize: "0.75rem",
              fontWeight: 700,
              cursor: isLoading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.375rem",
            }}
          >
            {isLoading ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                <span>Computing Highway Routes...</span>
              </>
            ) : (
              <>
                <Navigation2 size={12} />
                <span>Compute Routes</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Quick Corridor Buttons */}
      <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: "0.5rem" }}>
        <span style={{ fontSize: "0.625rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
          Standard Highway Corridors
        </span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
          {STANDARD_CORRIDORS.map((c, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleQuickRoute(c)}
              style={{
                background: "#f8fafc",
                border: "1px solid var(--border-default)",
                borderRadius: "2px",
                padding: "2px 5px",
                fontSize: "0.625rem",
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
