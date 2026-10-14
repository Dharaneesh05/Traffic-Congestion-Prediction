import React, { useState, useEffect, useRef, useMemo } from "react";
import { ArrowRightLeft, Loader2, RotateCcw, AlertTriangle } from "lucide-react";
import { TAMIL_NADU_LOCATIONS, reverseGeocodeLocation } from "../locations";
import { trafficService } from "../services/trafficService";
import { TAMIL_NADU_DISTRICTS } from "../services/tamilNaduTrafficData";
import { useSettings } from "../context/SettingsContext";

// Helper to determine accurate location type classification
function resolveCategory(loc) {
  if (loc.category) return loc.category;
  const t = (loc.type || "").toLowerCase();
  const n = (loc.name || "").toLowerCase();
  if (t.includes("junction") || n.includes("junction") || n.includes("roundana") || n.includes("signal") || n.includes("cross")) {
    return "Junction";
  }
  if (
    t.includes("highway") ||
    t.includes("corridor") ||
    t.includes("expressway") ||
    t.includes("bypass") ||
    t.includes("road") ||
    n.startsWith("nh") ||
    n.startsWith("sh") ||
    n.includes("road")
  ) {
    return "Highway / Road";
  }
  if (
    t.includes("bus stand") ||
    t.includes("terminal") ||
    t.includes("railway") ||
    t.includes("station") ||
    t.includes("toll") ||
    t.includes("temple") ||
    t.includes("airport") ||
    t.includes("landmark")
  ) {
    return "Landmark";
  }
  if (t.includes("district") || t.includes("state capital")) {
    return "District";
  }
  return "Town / City";
}

export default function RoutePlanner({
  locations = [],
  onPlanRoute,
  isLoading = false,
  selectedFrom = "",
  selectedTo = "",
  selectedJunction = null,
  routeResult = null,
  onClearRoute = null,
  onLocationChange = null,
}) {
  const { t, tJunction } = useSettings();
  const [fromName, setFromName] = useState(selectedFrom || selectedJunction?.name || "");
  const [toName, setToName] = useState(selectedTo || "");
  const [focusedField, setFocusedField] = useState("from");
  const [isLocating, setIsLocating] = useState(false);
  const [recentLocations, setRecentLocations] = useState([
    "Sankagiri",
    "Five Roads",
    "Salem",
    "Madurai",
    "Coimbatore",
  ]);

  const [showFromSuggestions, setShowFromSuggestions] = useState(false);
  const [showToSuggestions, setShowToSuggestions] = useState(false);
  const fromRef = useRef(null);
  const toRef = useRef(null);

  // Synchronize initial value from selectedJunction or selectedFrom when changed externally
  useEffect(() => {
    if (selectedFrom) {
      setFromName(selectedFrom);
    } else if (selectedJunction?.name) {
      setFromName(selectedJunction.name);
    }
  }, [selectedFrom, selectedJunction]);

  useEffect(() => {
    if (selectedTo) {
      setToName(selectedTo);
    }
  }, [selectedTo]);

  // Aggregate all Tamil Nadu locations across Junctions, Roads, Districts, Towns, Landmarks, Highways
  const combinedLocations = useMemo(() => {
    const locMap = new Map();

    // 1. Comprehensive catalog (junctions, highways, districts, towns, landmarks)
    (TAMIL_NADU_LOCATIONS || []).forEach((loc) => {
      if (loc?.name) {
        locMap.set(loc.name.toLowerCase(), {
          ...loc,
          category: resolveCategory(loc),
        });
      }
    });

    // 2. Statewide junctions across all districts
    const allJunctions = trafficService.allJunctions || [];
    allJunctions.forEach((j) => {
      if (j?.name && !locMap.has(j.name.toLowerCase())) {
        locMap.set(j.name.toLowerCase(), {
          name: j.name,
          lat: j.coords ? j.coords[1] : undefined,
          lon: j.coords ? j.coords[0] : undefined,
          district: j.district || "Tamil Nadu",
          type: "Traffic Junction",
          category: "Junction",
        });
      }
    });

    // 3. District centers
    Object.values(TAMIL_NADU_DISTRICTS || {}).forEach((d) => {
      if (d?.name && !locMap.has(d.name.toLowerCase())) {
        locMap.set(d.name.toLowerCase(), {
          name: d.name,
          lat: d.center ? d.center[1] : undefined,
          lon: d.center ? d.center[0] : undefined,
          district: d.name,
          type: "District",
          category: "District",
        });
      }
    });

    // 4. Backend live locations
    (locations || []).forEach((l) => {
      if (l?.name && !locMap.has(l.name.toLowerCase())) {
        locMap.set(l.name.toLowerCase(), {
          ...l,
          category: resolveCategory(l),
        });
      }
    });

    return Array.from(locMap.values());
  }, [locations]);

  // Close suggestion dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (fromRef.current && !fromRef.current.contains(e.target)) {
        setShowFromSuggestions(false);
      }
      if (toRef.current && !toRef.current.contains(e.target)) {
        setShowToSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSwap = () => {
    const temp = fromName;
    setFromName(toName);
    setToName(temp);
    if (onLocationChange) onLocationChange();
    if (routeResult && onClearRoute) onClearRoute();
  };

  const handleUseCurrentLocation = () => {
    if (isLocating) return;
    setIsLocating(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const resolved = await trafficService.resolveLocationName(pos.coords.latitude, pos.coords.longitude);
            const resolvedName = resolved || selectedJunction?.name || "Current Location";
            setFromName(resolvedName);
            if (onLocationChange) onLocationChange();
            if (routeResult && onClearRoute) onClearRoute();
          } catch {
            setFromName(selectedJunction?.name || "Current Location");
            if (onLocationChange) onLocationChange();
            if (routeResult && onClearRoute) onClearRoute();
          } finally {
            setIsLocating(false);
          }
        },
        () => {
          setFromName("Current location unavailable");
          if (onLocationChange) onLocationChange();
          if (routeResult && onClearRoute) onClearRoute();
          setIsLocating(false);
        },
        { timeout: 5000 }
      );
    } else {
      setFromName("Current location unavailable");
      if (onLocationChange) onLocationChange();
      if (routeResult && onClearRoute) onClearRoute();
      setIsLocating(false);
    }
  };


  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (fromName.trim() && toName.trim() && onPlanRoute) {
      setShowFromSuggestions(false);
      setShowToSuggestions(false);

      // Update recent locations list cleanly
      setRecentLocations((prev) => {
        const next = [fromName.trim(), toName.trim(), ...prev.filter((x) => x !== fromName.trim() && x !== toName.trim())];
        return next.slice(0, 5);
      });

      onPlanRoute(fromName.trim(), toName.trim());
    }
  };

  const filterMatches = (query) => {
    const q = (query || "").trim().toLowerCase();
    if (!q) {
      return combinedLocations.slice(0, 8);
    }
    return combinedLocations
      .filter((loc) => {
        const nameMatch = loc.name.toLowerCase().includes(q);
        const distMatch = loc.district && loc.district.toLowerCase().includes(q);
        const catMatch = loc.category && loc.category.toLowerCase().includes(q);
        const typeMatch = loc.type && loc.type.toLowerCase().includes(q);
        return nameMatch || distMatch || catMatch || typeMatch;
      })
      .slice(0, 8);
  };

  const fromMatches = filterMatches(fromName);
  const toMatches = filterMatches(toName);

  const isRouteUnavailable = routeResult?.error || (routeResult && !routeResult.recommended && !routeResult.forecast && !routeResult.distance);

  return (
    <div
      style={{
        background: "var(--bg-card, #FFFFFF)",
        border: "1px solid var(--border-default, #D8E0E8)",
        borderRadius: "4px",
        padding: "0.75rem 1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.625rem",
      }}
    >
      {/* Title */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2
          style={{
            fontSize: "0.8125rem",
            fontWeight: 800,
            color: "var(--text-primary, #162334)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            margin: 0,
          }}
        >
          {t("routes.routeTitle", "ROUTE")}
        </h2>
      </div>

      {/* Inline Route Error */}
      {isRouteUnavailable && (
        <div
          style={{
            fontSize: "0.6875rem",
            color: "var(--state-red, #EF4444)",
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
          }}
        >
          <AlertTriangle size={12} color="var(--state-red, #EF4444)" style={{ flexShrink: 0 }} />
          <span>{t("routes.routeUnavailable", "Route not available · Check the starting point and destination.")}</span>
        </div>
      )}

      {/* Location Input Form */}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
        {/* FROM Field with compact Use Current Location option */}
        <div ref={fromRef} style={{ position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
            <label
              style={{
                fontSize: "0.625rem",
                fontWeight: 700,
                color: "var(--text-muted, #8A97A5)",
                textTransform: "uppercase",
                letterSpacing: "0.03em",
              }}
            >
              {t("routes.from", "FROM")}
            </label>
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={isLocating}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                fontSize: "0.625rem",
                fontWeight: 600,
                color: isLocating ? "var(--text-muted, #8A97A5)" : "var(--accent, #245B86)",
                cursor: isLocating ? "wait" : "pointer",
                textDecoration: "underline",
              }}
              title="Set origin to current location or active junction"
            >
              {isLocating ? t("common.detectingLocation", "Locating...") : t("routes.useCurrentLocation", "Use Current Location")}
            </button>
          </div>

          <input
            type="text"
            placeholder={t("routes.searchOriginPlaceholder", "Search or select origin")}
            value={fromName}
            onFocus={() => {
              setFocusedField("from");
              setShowFromSuggestions(true);
            }}
            onChange={(e) => {
              setFromName(e.target.value);
              setShowFromSuggestions(true);
              if (onLocationChange) onLocationChange();
              if (routeResult && onClearRoute) onClearRoute();
            }}
            style={{
              width: "100%",
              padding: "0.4rem 0.55rem",
              fontSize: "0.75rem",
              background: "var(--bg-input, #FFFFFF)",
              border: "1px solid var(--border-default, #D8E0E8)",
              borderRadius: "4px",
              color: "var(--text-primary, #162334)",
              boxSizing: "border-box",
            }}
          />

          {showFromSuggestions && (fromName.trim() ? fromMatches.length > 0 : true) && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                background: "var(--bg-card, #FFFFFF)",
                border: "1px solid var(--border-default, #D8E0E8)",
                borderRadius: "4px",
                boxShadow: "var(--shadow-md, 0 4px 12px rgba(0,0,0,0.15))",
                zIndex: 50,
                maxHeight: "200px",
                overflowY: "auto",
              }}
            >
              {/* Show RECENT section when nothing typed */}
              {!fromName.trim() && recentLocations.length > 0 && (
                <>
                  <div style={{ padding: "0.3rem 0.5rem 0.15rem", fontSize: "0.5625rem", fontWeight: 700, color: "var(--text-muted, #8A97A5)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border-light, #E7ECF1)" }}>
                    {t("common.recent", "Recent")}
                  </div>
                  {recentLocations.map((locName) => (
                    <div
                      key={`from-rec-${locName}`}
                      onClick={() => {
                        setFromName(locName);
                        setShowFromSuggestions(false);
                        if (onLocationChange) onLocationChange();
                      }}
                      style={{ padding: "0.4rem 0.5rem", cursor: "pointer", fontSize: "0.75rem", color: "var(--text-primary, #162334)", fontWeight: 600, borderBottom: "1px solid var(--border-light, #E7ECF1)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover, #EEF2F6)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {tJunction(locName)}
                    </div>
                  ))}
                </>
              )}
              {/* Show filtered results when typing */}
              {fromName.trim() && fromMatches.map((loc) => (
                <div
                  key={`from-${loc.name}`}
                  onClick={() => {
                    setFromName(loc.name);
                    setShowFromSuggestions(false);
                    if (onLocationChange) onLocationChange();
                  }}
                  style={{
                    padding: "0.4rem 0.5rem",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "1px solid var(--border-light, #E7ECF1)",
                    gap: "0.5rem",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover, #EEF2F6)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.75rem", color: "var(--text-primary, #162334)" }}>
                      {tJunction(loc.name)}
                    </span>
                    <span style={{ fontSize: "0.625rem", color: "var(--text-muted, #8A97A5)", marginLeft: "6px" }}>
                      {tJunction(loc.district || "Tamil Nadu")}
                    </span>
                  </div>
                  <span style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--text-muted, #8A97A5)", flexShrink: 0 }}>
                    {t(`category.${(loc.category || "location").toLowerCase()}`, loc.category || "Location")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Swap Button */}
        <div style={{ display: "flex", justifyContent: "center", margin: "-2px 0" }}>
          <button
            type="button"
            onClick={handleSwap}
            style={{
              border: "1px solid var(--border-default, #D8E0E8)",
              background: "var(--bg-surface-secondary, #26333E)",
              borderRadius: "4px",
              padding: "2px 8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "0.625rem",
              color: "var(--text-secondary, #344256)",
              fontWeight: 600,
            }}
            title="Swap Origin and Destination"
          >
            <ArrowRightLeft size={10} />
            <span>{t("routes.swap", "Swap")}</span>
          </button>
        </div>

        {/* TO Field */}
        <div ref={toRef} style={{ position: "relative" }}>
          <label
            style={{
              fontSize: "0.625rem",
              fontWeight: 700,
              color: "var(--text-muted, #8A97A5)",
              textTransform: "uppercase",
              display: "block",
              marginBottom: "3px",
              letterSpacing: "0.03em",
            }}
          >
            {t("routes.to", "TO")}
          </label>
          <input
            type="text"
            placeholder={t("routes.searchDestinationPlaceholder", "Search or select destination")}
            value={toName}
            onFocus={() => {
              setFocusedField("to");
              setShowToSuggestions(true);
            }}
            onChange={(e) => {
              setToName(e.target.value);
              setShowToSuggestions(true);
              if (onLocationChange) onLocationChange();
              if (routeResult && onClearRoute) onClearRoute();
            }}
            style={{
              width: "100%",
              padding: "0.4rem 0.55rem",
              fontSize: "0.75rem",
              background: "var(--bg-input, #FFFFFF)",
              border: "1px solid var(--border-default, #D8E0E8)",
              borderRadius: "4px",
              color: "var(--text-primary, #162334)",
              boxSizing: "border-box",
            }}
          />

          {showToSuggestions && (toName.trim() ? toMatches.length > 0 : true) && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                background: "var(--bg-card, #FFFFFF)",
                border: "1px solid var(--border-default, #D8E0E8)",
                borderRadius: "4px",
                boxShadow: "var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.15))",
                zIndex: 50,
                maxHeight: "200px",
                overflowY: "auto",
              }}
            >
              {/* Show RECENT section when nothing typed */}
              {!toName.trim() && recentLocations.length > 0 && (
                <>
                  <div style={{ padding: "0.3rem 0.5rem 0.15rem", fontSize: "0.5625rem", fontWeight: 700, color: "var(--text-muted, #8A97A5)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border-light, #E7ECF1)" }}>
                    {t("common.recent", "Recent")}
                  </div>
                  {recentLocations.map((locName) => (
                    <div
                      key={`to-rec-${locName}`}
                      onClick={() => {
                        setToName(locName);
                        setShowToSuggestions(false);
                        if (onLocationChange) onLocationChange();
                      }}
                      style={{ padding: "0.4rem 0.5rem", cursor: "pointer", fontSize: "0.75rem", color: "var(--text-primary, #162334)", fontWeight: 600, borderBottom: "1px solid var(--border-light, #E7ECF1)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover, #EEF2F6)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {tJunction(locName)}
                    </div>
                  ))}
                </>
              )}
              {/* Show filtered results when typing */}
              {toName.trim() && toMatches.map((loc) => (
                <div
                  key={`to-${loc.name}`}
                  onClick={() => {
                    setToName(loc.name);
                    setShowToSuggestions(false);
                    if (onLocationChange) onLocationChange();
                  }}
                  style={{
                    padding: "0.4rem 0.5rem",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "1px solid var(--border-light, #E7ECF1)",
                    gap: "0.5rem",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover, #EEF2F6)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.75rem", color: "var(--text-primary, #162334)" }}>
                      {tJunction(loc.name)}
                    </span>
                    <span style={{ fontSize: "0.625rem", color: "var(--text-muted, #8A97A5)", marginLeft: "6px" }}>
                      {tJunction(loc.district || "Tamil Nadu")}
                    </span>
                  </div>
                  <span style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--text-muted, #8A97A5)", flexShrink: 0 }}>
                    {t(`category.${(loc.category || "location").toLowerCase()}`, loc.category || "Location")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Controls: CALCULATE ROUTE & Clear */}
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.35rem" }}>
          <button
            type="submit"
            disabled={isLoading || !fromName.trim() || !toName.trim()}
            style={{
              flex: 1,
              background: "var(--accent, #245B86)",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "4px",
              padding: "0.5rem",
              fontSize: "0.75rem",
              fontWeight: 700,
              letterSpacing: "0.03em",
              cursor: isLoading || !fromName.trim() || !toName.trim() ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.375rem",
              opacity: !fromName.trim() || !toName.trim() ? 0.6 : 1,
              transition: "opacity 0.15s ease",
            }}
          >
            {isLoading ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                <span>{t("actions.calculatingRoute", "CALCULATING ROUTE...")}</span>
              </>
            ) : (
              <span>{t("actions.calculateRoute", "CALCULATE ROUTE")}</span>
            )}
          </button>

          {(routeResult || fromName || toName) && (
            <button
              type="button"
              onClick={() => {
                if (onClearRoute) onClearRoute();
                setFromName("");
                setToName("");
                if (onLocationChange) onLocationChange();
              }}
              style={{
                background: "var(--bg-surface-secondary, #26333E)",
                color: "var(--text-secondary, #344256)",
                border: "1px solid var(--border-default, #D8E0E8)",
                borderRadius: "4px",
                padding: "0.5rem 0.75rem",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
                transition: "all 0.15s ease",
              }}
              title="Clear route and locations"
            >
              <RotateCcw size={11} />
              <span>{t("actions.clear", "Clear")}</span>
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
