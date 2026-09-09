import React, { useState, useEffect, useRef } from "react";
import { Search, Smartphone, Clock, Shield, SlidersHorizontal, MapPin, Video, Navigation, ShieldCheck } from "lucide-react";
import { getBackendHost } from "../api";
import { searchTamilNaduLocations } from "../locations";
import { trafficService } from "../services/trafficService";

export default function Header({
  systemHealth,
  onSearchSelect,
  locations = [],
  activePageTitle = "DASHBOARD",
  operatingMode = "control", // "control" | "field"
  onToggleOperatingMode,
  dataMode = "DEMO", // "DEMO" | "LIVE"
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categorizedResults, setCategorizedResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [timeStr, setTimeStr] = useState(
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  );
  const [showMobileModal, setShowMobileModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const searchTimeoutRef = useRef(null);

  const lanIp = systemHealth?.lan_ip || getBackendHost();

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeStr(
        new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!val.trim()) {
      setCategorizedResults(null);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        // 1. Search categorized traffic service (Junctions, Roads, Cameras, Local Districts)
        const catRes = trafficService.search(val);

        // 2. Fallback / supplement with general TN geocoder
        if (catRes.locations.length === 0 && catRes.junctions.length === 0) {
          const geoRes = await searchTamilNaduLocations(val);
          catRes.locations = geoRes.slice(0, 4);
        }

        setCategorizedResults(catRes);
      } catch (err) {
        console.error("Location search failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 120);
  };

  const handleSelect = (item, category) => {
    setSearchQuery(item.name || item.id);
    setCategorizedResults(null);
    if (onSearchSelect) {
      onSearchSelect({
        ...item,
        searchCategory: category,
      });
    }
  };

  const isHealthy = systemHealth?.status === "ok";

  const hasResults =
    categorizedResults &&
    (categorizedResults.locations.length > 0 ||
      categorizedResults.junctions.length > 0 ||
      categorizedResults.roads.length > 0 ||
      categorizedResults.cameras.length > 0);

  return (
    <header
      style={{
        background: "var(--bg-header)",
        borderBottom: "1px solid var(--border-default)",
        padding: "0.5rem 1.25rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      {/* 1. Header Identity */}
      <div style={{ display: "flex", alignItems: "center" }}>
        <h1
          style={{
            fontSize: "0.9375rem",
            fontWeight: 800,
            color: "var(--text-primary)",
            letterSpacing: "-0.01em",
            margin: 0,
            whiteSpace: "nowrap",
          }}
        >
          Tamil Nadu Highway Traffic Operations
        </h1>
      </div>

      {/* 2. Categorized Location / Corridor Search Field */}
      <div style={{ position: "relative", width: "100%", maxWidth: "390px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "var(--bg-card-subtle)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-xs)",
            padding: "0.35rem 0.625rem",
            gap: "0.5rem",
          }}
        >
          <Search size={13} color="#94a3b8" />
          <input
            type="text"
            placeholder="Search district, junction, road, or CCTV..."
            value={searchQuery}
            onChange={handleSearchChange}
            style={{
              border: "none",
              background: "transparent",
              outline: "none",
              fontSize: "0.75rem",
              fontFamily: "var(--font-sans)",
              width: "100%",
              color: "var(--text-primary)",
            }}
          />
          {isSearching && (
            <span style={{ fontSize: "0.625rem", color: "#94a3b8" }}>...</span>
          )}
        </div>

        {/* Categorized Dropdown Results */}
        {hasResults && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              marginTop: "0.25rem",
              background: "#ffffff",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-xs)",
              boxShadow: "var(--shadow-md)",
              zIndex: 100,
              maxHeight: "360px",
              overflowY: "auto",
            }}
          >
            {/* 2a. LOCATIONS */}
            {categorizedResults.locations.length > 0 && (
              <div>
                <div
                  style={{
                    padding: "0.3rem 0.625rem",
                    fontSize: "0.625rem",
                    fontWeight: 800,
                    color: "var(--text-muted)",
                    background: "#f8fafc",
                    borderBottom: "1px solid var(--border-light)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Locations & Districts
                </div>
                {categorizedResults.locations.map((loc, idx) => (
                  <div
                    key={`loc-${idx}`}
                    onClick={() => handleSelect(loc, "location")}
                    style={{
                      padding: "0.4rem 0.625rem",
                      fontSize: "0.75rem",
                      color: "var(--text-primary)",
                      cursor: "pointer",
                      borderBottom: "1px solid var(--border-light)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                      <MapPin size={12} color="#64748b" />
                      <span>{loc.name}</span>
                      {loc.district && (
                        <span style={{ color: "#64748b", fontSize: "0.6875rem" }}>
                          ({loc.district})
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: "0.625rem", fontWeight: 700, color: "#475569", background: "#f1f5f9", padding: "1px 6px", borderRadius: "2px" }}>
                      {loc.type && loc.type.toLowerCase().includes("town") ? "Area" : "District"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* 2b. TRAFFIC JUNCTIONS */}
            {categorizedResults.junctions.length > 0 && (
              <div>
                <div
                  style={{
                    padding: "0.3rem 0.625rem",
                    fontSize: "0.625rem",
                    fontWeight: 800,
                    color: "var(--text-muted)",
                    background: "#f8fafc",
                    borderBottom: "1px solid var(--border-light)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Traffic Junctions
                </div>
                {categorizedResults.junctions.map((jnc, idx) => (
                  <div
                    key={`jnc-${idx}`}
                    onClick={() => handleSelect(jnc, "junction")}
                    style={{
                      padding: "0.4rem 0.625rem",
                      fontSize: "0.75rem",
                      color: "var(--text-primary)",
                      cursor: "pointer",
                      borderBottom: "1px solid var(--border-light)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                      <strong>{jnc.name}</strong>
                      <span style={{ color: "#64748b", fontSize: "0.6875rem" }}>
                        • {jnc.district}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: "0.625rem",
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: "2px",
                        background: "#eff6ff",
                        color: "#1d4ed8",
                      }}
                    >
                      Junction
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* 2c. ROADS */}
            {categorizedResults.roads.length > 0 && (
              <div>
                <div
                  style={{
                    padding: "0.3rem 0.625rem",
                    fontSize: "0.625rem",
                    fontWeight: 800,
                    color: "var(--text-muted)",
                    background: "#f8fafc",
                    borderBottom: "1px solid var(--border-light)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Highways & Major Roads
                </div>
                {categorizedResults.roads.map((road, idx) => (
                  <div
                    key={`road-${idx}`}
                    onClick={() => handleSelect(road, "road")}
                    style={{
                      padding: "0.4rem 0.625rem",
                      fontSize: "0.75rem",
                      color: "var(--text-primary)",
                      cursor: "pointer",
                      borderBottom: "1px solid var(--border-light)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                  >
                    <span>{road.name}</span>
                    <span
                      style={{
                        fontSize: "0.625rem",
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: "2px",
                        background: "#f0fdfa",
                        color: "#0f766e",
                      }}
                    >
                      Highway
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* 2d. CAMERAS */}
            {categorizedResults.cameras.length > 0 && (
              <div>
                <div
                  style={{
                    padding: "0.3rem 0.625rem",
                    fontSize: "0.625rem",
                    fontWeight: 800,
                    color: "var(--text-muted)",
                    background: "#f8fafc",
                    borderBottom: "1px solid var(--border-light)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  CCTV Feeds
                </div>
                {categorizedResults.cameras.map((cam, idx) => (
                  <div
                    key={`cam-${idx}`}
                    onClick={() => handleSelect(cam, "camera")}
                    style={{
                      padding: "0.4rem 0.625rem",
                      fontSize: "0.75rem",
                      color: "var(--text-primary)",
                      cursor: "pointer",
                      borderBottom: "1px solid var(--border-light)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                      <strong>{cam.name}</strong>
                      <span style={{ color: "#64748b", fontSize: "0.6875rem" }}>
                        ({cam.approach})
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: "0.625rem",
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: "2px",
                        background: "#f5f3ff",
                        color: "#6d28d9",
                      }}
                    >
                      Camera
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Mode Toggle, Subtle Status, Clock & Operator Info */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {/* Operating Mode Selector: Control Room vs Field Officer */}
        {onToggleOperatingMode && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "var(--bg-card-subtle)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-xs)",
              padding: "2px",
              gap: "2px",
            }}
          >
            <button
              onClick={() => onToggleOperatingMode("control")}
              style={{
                border: "none",
                background: operatingMode === "control" ? "#0f172a" : "transparent",
                color: operatingMode === "control" ? "#ffffff" : "var(--text-secondary)",
                fontSize: "0.625rem",
                fontWeight: 700,
                padding: "0.2rem 0.45rem",
                borderRadius: "2px",
                cursor: "pointer",
              }}
            >
              Control Room
            </button>
            <button
              onClick={() => onToggleOperatingMode("field")}
              style={{
                border: "none",
                background: operatingMode === "field" ? "#0f172a" : "transparent",
                color: operatingMode === "field" ? "#ffffff" : "var(--text-secondary)",
                fontSize: "0.625rem",
                fontWeight: 700,
                padding: "0.2rem 0.45rem",
                borderRadius: "2px",
                cursor: "pointer",
              }}
            >
              Field Officer
            </button>
          </div>
        )}

        {/* Subtle Operational Indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", fontWeight: 600 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: isHealthy ? "#16a34a" : "#dc2626",
              display: "inline-block",
            }}
          />
          <span style={{ color: isHealthy ? "#16a34a" : "#dc2626" }}>
            {isHealthy ? "Operational" : "Offline"}
          </span>
        </div>

        {/* Mobile Access Link */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowMobileModal(!showMobileModal)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
              fontSize: "0.6875rem",
              fontWeight: 600,
              color: "var(--text-secondary)",
              background: "transparent",
              border: "1px solid var(--border-default)",
              padding: "0.25rem 0.5rem",
              borderRadius: "var(--radius-xs)",
              cursor: "pointer",
            }}
            title="Mobile device access"
          >
            <Smartphone size={12} color="#64748b" />
            <span>Mobile</span>
          </button>

          {showMobileModal && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: "0.375rem",
                width: "260px",
                background: "#ffffff",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-xs)",
                boxShadow: "var(--shadow-lg)",
                padding: "0.75rem",
                zIndex: 200,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.375rem" }}>
                <strong style={{ fontSize: "0.75rem", color: "var(--text-primary)" }}>Mobile Access</strong>
                <button
                  onClick={() => setShowMobileModal(false)}
                  style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "12px", color: "#94a3b8" }}
                >
                  ✕
                </button>
              </div>
              <p style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
                Open on local Wi-Fi:
              </p>
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid var(--border-default)",
                  borderRadius: "2px",
                  padding: "0.35rem 0.5rem",
                  fontSize: "0.6875rem",
                  fontFamily: "var(--font-mono)",
                  color: "#0284c7",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>http://{lanIp}:5173</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`http://${lanIp}:5173`);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  style={{
                    border: "none",
                    background: "#0284c7",
                    color: "#ffffff",
                    borderRadius: "2px",
                    padding: "2px 5px",
                    fontSize: "0.625rem",
                    cursor: "pointer",
                  }}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Subtle Clock */}
        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
          }}
        >
          <Clock size={11} />
          <span>{timeStr}</span>
        </div>

        {/* Subtle Operator Identifier */}
        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 500 }}>
          Control Center
        </div>
      </div>
    </header>
  );
}
