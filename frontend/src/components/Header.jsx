import React, { useState, useEffect, useRef } from "react";
import { Search, Smartphone, Clock } from "lucide-react";
import { getBackendHost } from "../api";
import { searchTamilNaduLocations } from "../locations";

export default function Header({
  systemHealth,
  onSearchSelect,
  locations = [],
  activePageTitle = "DASHBOARD",
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [timeStr, setTimeStr] = useState(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  const [showMobileModal, setShowMobileModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const searchTimeoutRef = useRef(null);

  const lanIp = systemHealth?.lan_ip || getBackendHost();

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeStr(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!val.trim()) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchTamilNaduLocations(val);
        setSearchResults(results);
      } catch (err) {
        console.error("Location search failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 150);
  };

  const handleSelectLocation = (loc) => {
    setSearchQuery(loc.name);
    setSearchResults([]);
    if (onSearchSelect) {
      onSearchSelect(loc);
    }
  };

  // Determine subtle operational status
  const isHealthy = systemHealth?.status === "ok";

  return (
    <header
      style={{
        background: "var(--bg-header)",
        borderBottom: "1px solid var(--border-default)",
        padding: "0.625rem 1.25rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1.25rem",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      {/* 1. Header Identity */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <h1
          style={{
            fontSize: "0.9375rem",
            fontWeight: 700,
            color: "var(--text-primary)",
            letterSpacing: "-0.01em",
            lineHeight: 1.2,
          }}
        >
          Tamil Nadu Highway Traffic Operations
        </h1>
        <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", fontWeight: 500 }}>
          TFT Prediction Engine
        </p>
      </div>

      {/* 2. Clean Location / Corridor Search Field */}
      <div style={{ position: "relative", width: "100%", maxWidth: "380px" }}>
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
            placeholder="Search location, junction, corridor..."
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

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
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
              maxHeight: "280px",
              overflowY: "auto",
            }}
          >
            {searchResults.map((loc, idx) => (
              <div
                key={idx}
                onClick={() => handleSelectLocation(loc)}
                style={{
                  padding: "0.45rem 0.75rem",
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
                <div>
                  <strong>{loc.name}</strong>
                  {loc.district && (
                    <span style={{ color: "#64748b", fontSize: "0.6875rem", marginLeft: "6px" }}>
                      • {loc.district}
                    </span>
                  )}
                </div>
                <span style={{ color: "#94a3b8", fontSize: "0.625rem", fontFamily: "var(--font-mono)" }}>
                  {loc.type || "Location"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Subtle Status, Clock & Operator Info */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
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
            {isHealthy ? "Operational" : "System Offline"}
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
            <span>Mobile Access</span>
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
