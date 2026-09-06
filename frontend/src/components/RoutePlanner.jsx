import React, { useState, useEffect } from "react";
import { Navigation2, ArrowRightLeft, Loader2 } from "lucide-react";
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
      }}
    >
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <h2 style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            ROUTE PLANNER
          </h2>
          <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>A* Heuristic Engine</span>
        </div>

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

          {/* Swap */}
          <div style={{ display: "flex", justifyContent: "center", margin: "-2px 0" }}>
            <button
              type="button"
              onClick={handleSwap}
              style={{
                background: "var(--bg-card-subtle)",
                border: "1px solid var(--border-default)",
                borderRadius: "2px",
                width: "22px",
                height: "22px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--text-secondary)",
              }}
              title="Swap"
            >
              <ArrowRightLeft size={10} />
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

          {/* Calculate Button */}
          <button
            type="submit"
            disabled={isLoading || !fromName || !toName}
            style={{
              background: "#2563eb",
              color: "#ffffff",
              border: "none",
              borderRadius: "2px",
              padding: "0.4rem 0.6rem",
              fontSize: "0.75rem",
              fontWeight: 600,
              cursor: "pointer",
              marginTop: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.35rem",
            }}
          >
            {isLoading ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                <span>Evaluating...</span>
              </>
            ) : (
              <span>Evaluate Route</span>
            )}
          </button>
        </form>
      </div>

      {/* Standard Highway Corridors */}
      <div style={{ marginTop: "0.625rem", paddingTop: "0.5rem", borderTop: "1px solid var(--border-light)" }}>
        <div style={{ fontSize: "0.625rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "0.25rem" }}>
          Standard Corridors
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
          {STANDARD_CORRIDORS.map((r, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleQuickRoute(r)}
              style={{
                background: "var(--bg-card-subtle)",
                border: "1px solid var(--border-default)",
                borderRadius: "2px",
                padding: "0.15rem 0.35rem",
                fontSize: "0.625rem",
                color: "var(--text-secondary)",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
