import React, { useState, useRef, useEffect, useMemo } from "react";
import { MapPin, Navigation, Search, ChevronDown, X } from "lucide-react";

export default function SearchableLocationCombobox({
  label = "ORIGIN",
  value = "",
  onChange,
  onSelect,
  placeholder = "Search location...",
  locations = [],
  isOrigin = false,
  currentLocationName = "Kumarapalayam",
  onUseCurrentLocation,
  isLocating = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Filter locations by search query
  const searchResults = useMemo(() => {
    const query = (value || "").trim().toLowerCase();

    // Default curated suggestions when search query is empty
    if (!query) {
      const topJunctions = locations
        .filter((l) => l.category === "Junctions" || l.category === "Junction")
        .slice(0, 3);
      const topRoads = locations
        .filter((l) => l.category === "Roads" || l.category === "Highway / Road")
        .slice(0, 2);
      const topLocations = locations
        .filter((l) => l.category === "Locations" || l.category === "District" || l.category === "Town / City")
        .slice(0, 3);

      return {
        isCurated: true,
        junctions: topJunctions,
        roads: topRoads,
        locations: topLocations,
      };
    }

    // Filtered search results grouped by category
    const junctions = [];
    const roads = [];
    const generalLocations = [];

    for (const item of locations) {
      const name = (item.name || "").toLowerCase();
      const district = (item.district || "").toLowerCase();
      const type = (item.type || "").toLowerCase();

      if (name.includes(query) || district.includes(query) || type.includes(query)) {
        const cat = item.category;
        if (cat === "Junctions" || cat === "Junction") {
          if (junctions.length < 5) junctions.push(item);
        } else if (cat === "Roads" || cat === "Highway / Road") {
          if (roads.length < 5) roads.push(item);
        } else {
          if (generalLocations.length < 5) generalLocations.push(item);
        }
      }
    }

    return {
      isCurated: false,
      junctions,
      roads,
      locations: generalLocations,
    };
  }, [value, locations]);

  const handleItemSelect = (item) => {
    if (onChange) onChange(item.name);
    if (onSelect) onSelect(item);
    setIsOpen(false);
  };

  const handleCurrentLocationClick = () => {
    if (onUseCurrentLocation) {
      onUseCurrentLocation();
    } else {
      if (onChange) onChange(currentLocationName || "Current Location");
    }
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (onChange) onChange("");
    if (inputRef.current) inputRef.current.focus();
  };

  const hasResults =
    isOrigin ||
    searchResults.junctions.length > 0 ||
    searchResults.roads.length > 0 ||
    searchResults.locations.length > 0;

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        fontFamily: "var(--font-sans)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          background: "var(--bg-surface-elevated, #252936)",
          border: isOpen
            ? "1px solid var(--accent-soft-blue, #7B8BC8)"
            : "1px solid var(--border-default, #3D3F4E)",
          borderRadius: "4px",
          padding: "0 0.45rem",
          height: "30px",
          transition: "border-color 0.15s ease",
          boxSizing: "border-box",
        }}
      >
        <span
          style={{
            fontSize: "0.625rem",
            fontWeight: 800,
            color: "var(--text-muted, #737987)",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            marginRight: "0.45rem",
            userSelect: "none",
          }}
        >
          {label}
        </span>

        <input
          ref={inputRef}
          type="text"
          value={value}
          placeholder={placeholder}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            if (onChange) onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setIsOpen(false);
          }}
          style={{
            background: "transparent",
            border: "none",
            outline: "none",
            color: "var(--text-primary, #F4F5F7)",
            fontSize: "0.75rem",
            fontWeight: 600,
            minWidth: isOrigin ? "200px" : "180px",
            fontFamily: "var(--font-sans)",
          }}
        />

        {value ? (
          <button
            type="button"
            onClick={handleClear}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted, #737987)",
              cursor: "pointer",
              padding: "0 2px",
              display: "flex",
              alignItems: "center",
            }}
            title="Clear"
          >
            <X size={12} />
          </button>
        ) : (
          <ChevronDown
            size={12}
            style={{
              color: "var(--text-muted, #737987)",
              pointerEvents: "none",
              transition: "transform 0.15s ease",
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        )}
      </div>

      {/* DROPDOWN RESULTS */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            width: "320px",
            maxHeight: "360px",
            overflowY: "auto",
            background: "var(--bg-surface, #1B2028)",
            border: "1px solid var(--border-default, #3D3F4E)",
            borderRadius: "4px",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.6)",
            zIndex: 100,
            padding: "0.35rem 0",
          }}
        >
          {/* Header indicator */}
          <div
            style={{
              padding: "0.35rem 0.65rem 0.25rem",
              fontSize: "0.625rem",
              fontWeight: 800,
              color: "var(--text-muted, #737987)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              borderBottom: "1px solid var(--border-light, #2C303C)",
              marginBottom: "0.25rem",
            }}
          >
            Search {label.toLowerCase()}
          </div>

          {/* 1. CURRENT LOCATION (For Origin) */}
          {isOrigin && (
            <div style={{ marginBottom: "0.35rem" }}>
              <div
                style={{
                  fontSize: "0.5625rem",
                  fontWeight: 800,
                  color: "var(--text-muted, #737987)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  padding: "0.2rem 0.65rem",
                }}
              >
                Current Location
              </div>
              <button
                type="button"
                onClick={handleCurrentLocationClick}
                disabled={isLocating}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.35rem 0.65rem",
                  background: "transparent",
                  border: "none",
                  textAlign: "left",
                  cursor: "pointer",
                  color: "var(--status-normal, #22C55E)",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  transition: "background 0.12s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface-elevated, #252936)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <Navigation size={12} />
                <span>{isLocating ? "Detecting location..." : (currentLocationName || "Kumarapalayam")}</span>
              </button>
            </div>
          )}

          {/* 2. JUNCTIONS */}
          {searchResults.junctions.length > 0 && (
            <div style={{ marginBottom: "0.35rem" }}>
              <div
                style={{
                  fontSize: "0.5625rem",
                  fontWeight: 800,
                  color: "var(--text-muted, #737987)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  padding: "0.2rem 0.65rem",
                }}
              >
                Junctions
              </div>
              {searchResults.junctions.map((jnc) => (
                <button
                  key={jnc.name}
                  type="button"
                  onClick={() => handleItemSelect(jnc)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.32rem 0.65rem",
                    background: "transparent",
                    border: "none",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "background 0.12s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface-elevated, #252936)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary, #F4F5F7)" }}>
                    {jnc.name}
                  </span>
                  {jnc.district && (
                    <span style={{ fontSize: "0.625rem", color: "var(--text-muted, #737987)" }}>
                      {jnc.district}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* 3. ROADS / HIGHWAYS */}
          {searchResults.roads.length > 0 && (
            <div style={{ marginBottom: "0.35rem" }}>
              <div
                style={{
                  fontSize: "0.5625rem",
                  fontWeight: 800,
                  color: "var(--text-muted, #737987)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  padding: "0.2rem 0.65rem",
                }}
              >
                Roads
              </div>
              {searchResults.roads.map((road) => (
                <button
                  key={road.name}
                  type="button"
                  onClick={() => handleItemSelect(road)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.32rem 0.65rem",
                    background: "transparent",
                    border: "none",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "background 0.12s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface-elevated, #252936)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary, #F4F5F7)" }}>
                    {road.name}
                  </span>
                  <span style={{ fontSize: "0.625rem", color: "var(--text-muted, #737987)" }}>
                    {road.district || "Highway Corridor"}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* 4. LOCATIONS / DISTRICTS */}
          {searchResults.locations.length > 0 && (
            <div style={{ marginBottom: "0.25rem" }}>
              <div
                style={{
                  fontSize: "0.5625rem",
                  fontWeight: 800,
                  color: "var(--text-muted, #737987)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  padding: "0.2rem 0.65rem",
                }}
              >
                Locations
              </div>
              {searchResults.locations.map((loc) => (
                <button
                  key={loc.name}
                  type="button"
                  onClick={() => handleItemSelect(loc)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.32rem 0.65rem",
                    background: "transparent",
                    border: "none",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "background 0.12s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface-elevated, #252936)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary, #F4F5F7)" }}>
                    {loc.name}
                  </span>
                  <span style={{ fontSize: "0.625rem", color: "var(--text-muted, #737987)" }}>
                    {loc.district || loc.type || "District"}
                  </span>
                </button>
              ))}
            </div>
          )}

          {!hasResults && (
            <div
              style={{
                padding: "0.75rem 0.65rem",
                fontSize: "0.6875rem",
                color: "var(--text-muted, #737987)",
                textAlign: "center",
              }}
            >
              No matching locations found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
