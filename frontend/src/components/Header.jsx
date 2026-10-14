import React, { useState, useEffect, useRef, useMemo } from "react";
import { Search, MapPin, X, ChevronDown, Globe, Sun, Moon, Filter, Check } from "lucide-react";
import { searchTamilNaduLocations } from "../locations";
import { trafficService } from "../services/trafficService";
import { useSettings } from "../context/SettingsContext";

const FILTER_LABELS = {
  all: "All",
  locations: "Locations",
  junctions: "Junctions",
  roads: "Roads",
  cameras: "Cameras",
};

export default function Header({
  systemHealth,
  onSearchSelect,
  locations = [],
  selectedLocation = null,
  selectedJunction = null,
  districtName = "Tamil Nadu",
  onRequestCurrentLocation = null,
  isLocating = false,
  dataMode = "DEMO",
}) {
  const { settings, updateSetting, t, tJunction } = useSettings();
  const [searchQuery, setSearchQuery] = useState("");
  const [categorizedResults, setCategorizedResults] = useState(null);
  const [searchFilter, setSearchFilter] = useState("all"); // "all" | "locations" | "junctions" | "roads" | "cameras"
  const [isSearching, setIsSearching] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isLangHovered, setIsLangHovered] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);

  const searchContainerRef = useRef(null);
  const filterRef = useRef(null);
  const langRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  const formatClock = () =>
    new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });

  const [timeStr, setTimeStr] = useState(formatClock);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeStr(formatClock());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Close search suggestions, filter, and language popover on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setCategorizedResults(null);
        setHighlightedIndex(-1);
      }
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setIsFilterOpen(false);
      }
      if (langRef.current && !langRef.current.contains(e.target)) {
        setIsLangOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    setHighlightedIndex(-1);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!val.trim()) {
      setCategorizedResults(null);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const catRes = trafficService.search(val);

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
    setHighlightedIndex(-1);
    if (onSearchSelect) {
      onSearchSelect({
        ...item,
        searchCategory: category,
      });
    }
  };

  // Flatten visible results based on selected search filter
  const visibleItems = useMemo(() => {
    if (!categorizedResults) return [];
    const items = [];

    const showLocations = searchFilter === "all" || searchFilter === "locations";
    const showJunctions = searchFilter === "all" || searchFilter === "junctions";
    const showRoads = searchFilter === "all" || searchFilter === "roads";
    const showCameras = searchFilter === "all" || searchFilter === "cameras";

    if (showLocations && categorizedResults.locations?.length > 0) {
      categorizedResults.locations.forEach((loc) => {
        items.push({ item: loc, category: "location", typeLabel: t("header.locations", "District"), group: t("header.groupLocations", "LOCATIONS & DISTRICTS") });
      });
    }

    if (showJunctions && categorizedResults.junctions?.length > 0) {
      categorizedResults.junctions.forEach((jnc) => {
        items.push({ item: jnc, category: "junction", typeLabel: t("header.junctions", "Junction"), group: t("header.groupJunctions", "JUNCTIONS") });
      });
    }

    if (showRoads && categorizedResults.roads?.length > 0) {
      categorizedResults.roads.forEach((road) => {
        items.push({ item: road, category: "road", typeLabel: t("header.roads", "Road"), group: t("header.groupRoads", "ROADS & HIGHWAYS") });
      });
    }

    if (showCameras && categorizedResults.cameras?.length > 0) {
      categorizedResults.cameras.forEach((cam) => {
        items.push({ item: cam, category: "camera", typeLabel: t("header.cameras", "Camera"), group: t("header.groupCameras", "CAMERAS") });
      });
    }

    return items;
  }, [categorizedResults, searchFilter, t]);

  const executeImmediateSearch = async (rawQuery) => {
    if (!rawQuery || !rawQuery.trim()) return;
    const q = rawQuery.trim();
    setIsSearching(true);
    try {
      const catRes = trafficService.search(q);
      if (catRes.junctions && catRes.junctions.length > 0) {
        handleSelect(catRes.junctions[0], "junction");
        return;
      }
      if (catRes.roads && catRes.roads.length > 0) {
        handleSelect(catRes.roads[0], "road");
        return;
      }
      if (catRes.locations && catRes.locations.length > 0) {
        handleSelect(catRes.locations[0], "location");
        return;
      }
      if (catRes.cameras && catRes.cameras.length > 0) {
        handleSelect(catRes.cameras[0], "camera");
        return;
      }
      const geoMatches = await searchTamilNaduLocations(q);
      if (geoMatches && geoMatches.length > 0) {
        handleSelect(geoMatches[0], "location");
        return;
      }
      if (onSearchSelect) {
        onSearchSelect({ name: q, searchCategory: "location" });
      }
      setCategorizedResults(null);
      setHighlightedIndex(-1);
    } catch (err) {
      console.error("Immediate search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  // Keyboard navigation for fast control-room use (Up, Down, Enter, Escape)
  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      if (!categorizedResults || visibleItems.length === 0) return;
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1 < visibleItems.length ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      if (!categorizedResults || visibleItems.length === 0) return;
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : visibleItems.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && visibleItems[highlightedIndex]) {
        const target = visibleItems[highlightedIndex];
        handleSelect(target.item, target.category);
      } else if (visibleItems.length > 0) {
        const target = visibleItems[0];
        handleSelect(target.item, target.category);
      } else if (searchQuery.trim()) {
        executeImmediateSearch(searchQuery.trim());
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setCategorizedResults(null);
      setHighlightedIndex(-1);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setCategorizedResults(null);
    setHighlightedIndex(-1);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
  };

  const isHealthy = systemHealth?.status === "ok";

  // Compute clean current location indicator string
  let locationDisplay = t("common.currentLocation", "Current Location");
  if (isLocating) {
    locationDisplay = t("common.detectingLocation", "Detecting location...");
  } else if (selectedLocation?.isUnavailable) {
    locationDisplay = t("common.locationUnavailable", "Current location unavailable");
  } else if (selectedJunction) {
    locationDisplay = selectedJunction.district
      ? `${selectedJunction.district} • ${selectedJunction.name}`
      : selectedJunction.name;
  } else if (districtName && districtName.toLowerCase() !== "tamil nadu") {
    locationDisplay = selectedLocation?.name && !selectedLocation.name.toLowerCase().includes("current location")
      ? `${districtName} • ${selectedLocation.name.split(',')[0].trim()}`
      : districtName;
  } else if (selectedLocation?.name) {
    locationDisplay = selectedLocation.name;
  }

  return (
    <header
      style={{
        background: "var(--bg-header, #FFFFFF)",
        borderBottom: "1px solid var(--border-default, #D7DEE8)",
        height: "56px",
        boxSizing: "border-box",
        padding: "0 1.25rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.875rem",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      {/* 1. Official Identity */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", flexShrink: 0 }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontSize: "0.875rem",
              fontWeight: 800,
              color: "var(--text-primary, #0F1B33)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              lineHeight: 1.15,
            }}
          >
            {t("nav.trafficControl", "TRAFFIC CONTROL")}
          </span>
        </div>
      </div>

      {/* 2. Primary Search Box with Beside Filter Control (Sections 6 & 44) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.35rem",
          flex: 1,
          maxWidth: "500px",
          minWidth: "220px",
        }}
      >
        <div
          ref={searchContainerRef}
          style={{
            position: "relative",
            flex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "var(--bg-input, #FFFFFF)",
              border: "1px solid var(--border-default, #D8E0E8)",
              borderRadius: "9999px",
              padding: "0 0.95rem",
              height: "38px",
              gap: "0.5rem",
              transition: "border-color 0.15s ease",
            }}
          >
            <Search size={15} color="var(--text-muted, #8A97A5)" style={{ flexShrink: 0 }} />
            <input
              type="text"
              placeholder={t("header.searchPlaceholder", "Search junction, road, camera, or district...")}
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleKeyDown}
              style={{
                border: "none",
                background: "transparent",
                outline: "none",
                fontSize: "0.8125rem",
                fontFamily: "var(--font-sans)",
                width: "100%",
                color: "var(--text-primary, #162334)",
                fontWeight: 500,
              }}
            />
            {isSearching && (
              <span style={{ fontSize: "0.6875rem", color: "var(--text-muted, #8A97A5)", flexShrink: 0 }}>...</span>
            )}

            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "2px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-muted, #8A97A5)",
                  borderRadius: "50%",
                  flexShrink: 0,
                  lineHeight: 1,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary, #162334)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted, #8A97A5)")}
                aria-label={t("header.clearSearch", "Clear search")}
                title={t("header.clearSearch", "Clear search")}
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            )}
          </div>

          {/* Dynamic Search Autocomplete Suggestions */}
          {categorizedResults && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                marginTop: "0.25rem",
                background: "var(--bg-card, #FFFFFF)",
                border: "1px solid var(--border-default, #D8E0E8)",
                borderRadius: "4px",
                boxShadow: "var(--shadow-lg, 0 8px 24px rgba(0, 0, 0, 0.25))",
                zIndex: 100,
                maxHeight: "340px",
                overflowY: "auto",
              }}
            >
              {visibleItems.length > 0 ? (
                visibleItems.map((entry, idx) => {
                  const isFirstInGroup = idx === 0 || visibleItems[idx - 1].group !== entry.group;
                  const isHighlighted = highlightedIndex === idx;

                  return (
                    <React.Fragment key={`${entry.category}-${idx}`}>
                      {isFirstInGroup && (
                        <div
                          style={{
                            padding: "0.3rem 0.625rem",
                            fontSize: "0.5625rem",
                            fontWeight: 800,
                            color: "var(--text-muted, #8A97A5)",
                            background: "var(--bg-card-subtle, #F8FAFC)",
                            borderBottom: "1px solid var(--border-default, #D8E0E8)",
                            borderTop: idx > 0 ? "1px solid var(--border-default, #D8E0E8)" : "none",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          {entry.group}
                        </div>
                      )}
                      <div
                        onClick={() => handleSelect(entry.item, entry.category)}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        style={{
                          padding: "0.45rem 0.75rem",
                          fontSize: "0.75rem",
                          color: "var(--text-primary, #162334)",
                          cursor: "pointer",
                          background: isHighlighted ? "var(--bg-card-hover, #EEF2F6)" : "transparent",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          borderBottom: "1px solid var(--border-light, #E7ECF1)",
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontWeight: 700 }}>
                            {tJunction(entry.item.name || entry.item.id)}
                          </span>
                          <span style={{ fontSize: "0.625rem", color: "var(--text-muted, #8A97A5)" }}>
                            {tJunction(entry.item.district || entry.item.area || entry.item.approach) || entry.typeLabel}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: "0.625rem",
                            fontWeight: 700,
                            color: "var(--accent, #245B86)",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          {entry.typeLabel}
                        </span>
                      </div>
                    </React.Fragment>
                  );
                })
              ) : (
                <div style={{ padding: "1rem", textAlign: "center", color: "var(--text-muted, #8A97A5)", fontSize: "0.75rem" }}>
                  {t("header.noResults", "No matching results in {category}", {
                    category: searchFilter === "all" ? t("header.allCategories", "All Categories") : (t(`header.${searchFilter}`, FILTER_LABELS[searchFilter] || searchFilter))
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Compact Funnel / Filter Control Beside Search Bar (Section 6 & 44) */}
        <div ref={filterRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            style={{
              height: "38px",
              width: "38px",
              background: isFilterOpen || searchFilter !== "all" ? "var(--bg-surface-secondary, #26333E)" : "transparent",
              border: "none",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            title={t("header.filterCategory", "Filter search")}
            aria-label={t("header.filterCategory", "Filter search categories")}
          >
            <Filter size={16} color={searchFilter !== "all" ? "var(--accent, #245B86)" : "var(--text-muted, #8A97A5)"} />
          </button>

          {/* Compact Popover Dropdown for Categories */}
          {isFilterOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 5px)",
                right: 0,
                background: "var(--bg-card, #FFFFFF)",
                border: "1px solid var(--border-default, #D8E0E8)",
                borderRadius: "4px",
                boxShadow: "var(--shadow-md, 0 6px 18px rgba(0, 0, 0, 0.2))",
                padding: "4px 0",
                minWidth: "150px",
                zIndex: 110,
              }}
            >
              <div
                style={{
                  padding: "4px 10px",
                  fontSize: "0.5625rem",
                  fontWeight: 800,
                  color: "var(--text-muted, #8A97A5)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  borderBottom: "1px solid var(--border-light, #E7ECF1)",
                }}
              >
                {t("header.filterCategory", "Filter Category")}
              </div>
              {[
                { id: "all", label: t("header.allCategories", "All Categories") },
                { id: "locations", label: t("header.locations", "Locations") },
                { id: "junctions", label: t("header.junctions", "Junctions") },
                { id: "roads", label: t("header.roads", "Roads") },
                { id: "cameras", label: t("header.cameras", "Cameras") },
              ].map((cat) => {
                const isSelected = searchFilter === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSearchFilter(cat.id);
                      setHighlightedIndex(-1);
                      setIsFilterOpen(false);
                    }}
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      background: isSelected ? "var(--bg-card-subtle, #F8FAFC)" : "transparent",
                      border: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: "0.75rem",
                      fontWeight: isSelected ? 800 : 500,
                      color: isSelected ? "var(--text-primary, #162334)" : "var(--text-secondary, #344256)",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover, #EEF2F6)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = isSelected ? "var(--bg-card-subtle, #F8FAFC)" : "transparent")}
                  >
                    <span>{cat.label}</span>
                    {isSelected && <Check size={13} color="var(--accent, #245B86)" strokeWidth={2.5} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 3. Location Indicator, Operational Status, Language, Theme & Clock */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexShrink: 0 }}>
        {/* Sleek Clickable Location Indicator */}
        <button
          type="button"
          onClick={onRequestCurrentLocation}
          disabled={isLocating}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
            fontSize: "0.8125rem",
            whiteSpace: "nowrap",
            padding: "0.2rem 0.4rem",
            background: "transparent",
            border: "1px solid transparent",
            borderRadius: "4px",
            cursor: onRequestCurrentLocation ? "pointer" : "default",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            if (onRequestCurrentLocation) e.currentTarget.style.background = "var(--bg-card-hover, #EEF2F6)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
          title={onRequestCurrentLocation ? t("header.detectLocation", "Click to detect / refresh current location") : t("header.activeLocation", "Active Location")}
        >
          <MapPin
            size={14}
            color={selectedLocation?.isUnavailable ? "var(--text-muted, #8A97A5)" : "var(--accent, #245B86)"}
            strokeWidth={2.4}
            style={{ flexShrink: 0 }}
          />
          <span
            style={{
              fontWeight: 700,
              color: selectedLocation?.isUnavailable ? "var(--text-muted, #8A97A5)" : "var(--text-primary, #162334)",
              letterSpacing: "-0.01em",
            }}
          >
            {tJunction ? tJunction(locationDisplay) : locationDisplay}
          </span>
        </button>

        {/* Minimal Operational Status */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
            fontSize: "0.75rem",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: isHealthy ? "var(--status-normal, #4FA878)" : "var(--state-red, #EF4444)",
              display: "inline-block",
            }}
          />
          <span style={{ color: isHealthy ? "var(--status-normal, #4FA878)" : "var(--state-red, #EF4444)" }}>
            {isHealthy ? t("common.operational", "Operational") : t("common.offline", "Offline")}
          </span>
        </div>

        {/* Language Control: Globe icon only, dropdown on hover or click */}
        <div
          ref={langRef}
          style={{ position: "relative" }}
          onMouseEnter={() => setIsLangHovered(true)}
          onMouseLeave={() => setIsLangHovered(false)}
        >
          <button
            type="button"
            onClick={() => setIsLangOpen((prev) => !prev)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: isLangOpen || isLangHovered ? "var(--bg-card-hover, #EEF2F6)" : "transparent",
              border: "none",
              borderRadius: "4px",
              padding: "0.25rem 0.4rem",
              color: "var(--text-primary, #162334)",
              cursor: "pointer",
              lineHeight: 1,
              transition: "all 0.15s ease",
            }}
            title="Select Language / மொழியைத் தேர்ந்தெடுக்கவும்"
            aria-label="Select Language"
          >
            <Globe size={15} color={isLangOpen || isLangHovered ? "var(--text-primary, #162334)" : "var(--text-muted, #8A97A5)"} />
          </button>

          {/* Interactive Language Dropdown */}
          {(isLangOpen || isLangHovered) && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                right: 0,
                background: "var(--bg-card, #FFFFFF)",
                border: "1px solid var(--border-default, #D8E0E8)",
                borderRadius: "4px",
                padding: "3px",
                display: "flex",
                flexDirection: "column",
                gap: "2px",
                boxShadow: "var(--shadow-md, 0 6px 18px rgba(0, 0, 0, 0.2))",
                zIndex: 150,
                minWidth: "105px",
              }}
            >
              {[
                { code: "en", label: "English" },
                { code: "ta", label: "தமிழ்" },
              ].map((lang) => {
                const active = settings.language === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      updateSetting("language", null, lang.code);
                      setIsLangOpen(false);
                      setIsLangHovered(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                      padding: "0.35rem 0.55rem",
                      background: active ? "var(--bg-card-subtle, #F8FAFC)" : "transparent",
                      color: active ? "var(--accent, #245B86)" : "var(--text-primary, #162334)",
                      border: "none",
                      borderRadius: "3px",
                      fontSize: "0.75rem",
                      fontWeight: active ? 700 : 500,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.12s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!active) e.currentTarget.style.background = "var(--bg-card-hover, #EEF2F6)";
                    }}
                    onMouseLeave={(e) => {
                      if (!active) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span>{lang.label}</span>
                    {active && <Check size={12} color="var(--accent, #245B86)" strokeWidth={2.5} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Theme Control: Borderless Sun / Moon icon */}
        <button
          type="button"
          onClick={() => updateSetting("theme", null, settings.theme === "dark" ? "light" : "dark")}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            borderRadius: "4px",
            padding: "0.2rem 0.4rem",
            color: "var(--text-primary, #162334)",
            cursor: "pointer",
            lineHeight: 1,
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover, #EEF2F6)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          title={`${t("header.switchTheme", "Switch theme")} (${settings.theme === "dark" ? t("header.lightMode", "Light Mode") : t("header.darkMode", "Dark Mode")})`}
        >
          {settings.theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {/* Prominent Digital Control Room Clock without icon */}
        <div
          style={{
            fontSize: "0.9375rem",
            fontWeight: 700,
            color: "var(--text-primary, #162334)",
            fontFamily: "var(--font-sans)",
            display: "flex",
            alignItems: "center",
            whiteSpace: "nowrap",
            letterSpacing: "0.02em",
          }}
        >
          <span>{timeStr}</span>
        </div>
      </div>
    </header>
  );
}
