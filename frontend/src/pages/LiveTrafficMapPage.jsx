import React, { useState, useEffect, useRef, useMemo } from "react";
import TrafficMap from "../components/TrafficMap";
import SearchableLocationCombobox from "../components/SearchableLocationCombobox";
import { getStreamUrl, getCameraTelemetry } from "../api";
import { TAMIL_NADU_LOCATIONS } from "../locations";
import { trafficService } from "../services/trafficService";
import { Layers, ChevronDown, Search, X } from "lucide-react";

export default function LiveTrafficMapPage({
  routeResult = null,
  activeStrategy = "recommended",
  setActiveStrategy,
  telemetry = null,
  cameraStatus = "online",
  onPlanRoute,
  locations = [],
  selectedLocation = null,
  onSelectLocation,
  fromLocation = null,
  toLocation = null,
  alerts = [],
  areaJunctions = [],
  selectedJunction = null,
  onSelectJunction,
  activeCameraId = "CCTV-SKG-01",
  onSelectCamera,
  onClearRoute,
  isCalculatingRoute = false,
  onOfficerAction,
  diversionData = null,
  onStartCamera,
  onStopCamera,
  districtName = "Tamil Nadu",
}) {
  const mapRef = useRef(null);
  const layerMenuRef = useRef(null);

  // Map Layer Controls (Junctions, Cameras, Incidents, Routes)
  const [layers, setLayers] = useState({
    trafficLevel: true,
    junctions: true,
    cameras: true,
    incidents: true,
    routes: true,
    congestion: true,
  });
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  const junctionDropdownRef = useRef(null);
  const [showJunctionDropdown, setShowJunctionDropdown] = useState(false);
  const [junctionSearchQuery, setJunctionSearchQuery] = useState("");

  // Close layer menu & junction dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (layerMenuRef.current && !layerMenuRef.current.contains(e.target)) {
        setShowLayerMenu(false);
      }
      if (junctionDropdownRef.current && !junctionDropdownRef.current.contains(e.target)) {
        setShowJunctionDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Quick Field Route Inputs
  const [originInput, setOriginInput] = useState(fromLocation || "");
  const [destInput, setDestInput] = useState(toLocation || "");
  const [detectedLocationName, setDetectedLocationName] = useState("Kumarapalayam");
  const [isLocating, setIsLocating] = useState(false);

  // Sync inputs if props change externally
  useEffect(() => {
    if (fromLocation) setOriginInput(fromLocation);
  }, [fromLocation]);
  useEffect(() => {
    if (toLocation) setDestInput(toLocation);
  }, [toLocation]);

  // Aggregate catalog locations across Junctions, Roads, and Locations
  const catalogLocations = useMemo(() => {
    const locMap = new Map();

    (TAMIL_NADU_LOCATIONS || []).forEach((loc) => {
      if (loc?.name) {
        let cat = "Locations";
        if (loc.category === "Junction" || loc.type?.toLowerCase().includes("junction")) cat = "Junctions";
        else if (loc.category === "Highway / Road" || loc.name.startsWith("NH") || loc.name.startsWith("SH") || loc.name.toLowerCase().includes("road")) cat = "Roads";
        locMap.set(loc.name.toLowerCase(), { ...loc, category: cat });
      }
    });

    (trafficService.allJunctions || []).forEach((j) => {
      if (j?.name && !locMap.has(j.name.toLowerCase())) {
        locMap.set(j.name.toLowerCase(), {
          name: j.name,
          lat: j.coords ? j.coords[1] : undefined,
          lon: j.coords ? j.coords[0] : undefined,
          district: j.district || "Tamil Nadu",
          type: "Traffic Junction",
          category: "Junctions",
        });
      }
    });

    (areaJunctions || []).forEach((j) => {
      if (j?.name) {
        locMap.set(j.name.toLowerCase(), {
          name: j.name,
          lat: j.coords ? j.coords[1] : j.lat,
          lon: j.coords ? j.coords[0] : j.lon,
          district: j.district || districtName || "Tamil Nadu",
          type: "Traffic Junction",
          category: "Junctions",
          cameras: j.cameras,
        });
      }
    });

    (locations || []).forEach((l) => {
      if (l?.name && !locMap.has(l.name.toLowerCase())) {
        let cat = "Locations";
        if (l.category === "Junction" || l.type?.toLowerCase().includes("junction")) cat = "Junctions";
        else if (l.category === "Highway / Road" || l.name.startsWith("NH") || l.name.startsWith("SH") || l.name.toLowerCase().includes("road")) cat = "Roads";
        locMap.set(l.name.toLowerCase(), { ...l, category: cat });
      }
    });

    return Array.from(locMap.values());
  }, [areaJunctions, locations, districtName]);

  // Combined statewide & local junctions list
  const allJunctionsList = useMemo(() => {
    const list = [...(trafficService.allJunctions || []), ...(areaJunctions || [])];
    const unique = new Map();
    list.forEach((j) => {
      if (!j || !j.name) return;
      const key = (j.name || j.id || "").trim().toLowerCase();
      if (!unique.has(key)) {
        unique.set(key, j);
      }
    });
    return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [areaJunctions]);

  // Filtered junctions by search query (name, id, district, camera)
  const filteredJunctions = useMemo(() => {
    if (!junctionSearchQuery.trim()) return allJunctionsList;
    const q = junctionSearchQuery.trim().toLowerCase();
    return allJunctionsList.filter((j) => {
      if (j.name.toLowerCase().includes(q)) return true;
      if (j.id?.toLowerCase().includes(q)) return true;
      if (j.district?.toLowerCase().includes(q)) return true;
      return (j.cameras || []).some(
        (c) => c.name?.toLowerCase().includes(q) || c.id?.toLowerCase().includes(q) || c.approach?.toLowerCase().includes(q)
      );
    });
  }, [allJunctionsList, junctionSearchQuery]);

  // Camera options for selected junction
  const availableCameras = useMemo(() => {
    if (selectedJunction?.cameras && selectedJunction.cameras.length > 0) {
      return selectedJunction.cameras;
    }
    return [
      {
        id: activeCameraId || "CCTV-SLM-02",
        name: selectedJunction ? `${selectedJunction.name} Approach` : "Corridor Approach",
        status: cameraStatus === "online" ? "LIVE" : "OFFLINE",
      },
    ];
  }, [selectedJunction, activeCameraId, cameraStatus]);

  const [sidePanelCamId, setSidePanelCamId] = useState(availableCameras[0]?.id || "CCTV-SLM-02");

  useEffect(() => {
    if (availableCameras.length > 0) {
      setSidePanelCamId(availableCameras[0].id);
    }
  }, [availableCameras]);

  // Camera stream state in operational side panel
  const [streamError, setStreamError] = useState(false);
  const [streamNonce] = useState(Date.now());
  const [liveCamTelemetry, setLiveCamTelemetry] = useState(telemetry);

  // Keep live camera telemetry updated when camera is active
  useEffect(() => {
    if (telemetry) setLiveCamTelemetry(telemetry);
  }, [telemetry]);

  // Periodic polling for active camera telemetry when a junction with camera is selected
  useEffect(() => {
    if (!selectedJunction) return;
    const camId = sidePanelCamId || selectedJunction.cameras?.[0]?.id || activeCameraId;
    if (!camId) return;

    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const res = await getCameraTelemetry(camId);
        if (isMounted && res?.telemetry) {
          setLiveCamTelemetry(res.telemetry);
        }
      } catch (e) {}
    }, 1500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedJunction, sidePanelCamId, activeCameraId]);

  // Layer toggle handler
  const toggleLayer = (layerKey) => {
    setLayers((prev) => {
      const nextVal = !prev[layerKey];
      const updated = { ...prev, [layerKey]: nextVal };
      if (layerKey === "trafficLevel") {
        updated.congestion = nextVal;
      }
      return updated;
    });
  };

  // Map navigation helpers
  const handleCurrentLocation = (shouldSelectJunction = true) => {
    if (isLocating) return;
    setIsLocating(true);
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          let locName = "Kumarapalayam";
          try {
            const resolved = await trafficService.resolveLocationName(latitude, longitude);
            if (resolved) locName = resolved;
          } catch (e) {
            console.error("Location name resolution failed:", e);
          }

          setDetectedLocationName(locName);
          setOriginInput(locName);

          const map = mapRef.current;
          if (map) {
            map.flyTo({ center: [longitude, latitude], zoom: 14, duration: 800 });
          }

          if (onSelectLocation) {
            onSelectLocation({
              lon: longitude,
              lat: latitude,
              name: locName,
              isGpsLocation: true,
              zoom: 14,
            });
          }

          if (shouldSelectJunction) {
            const junctionsList = areaJunctions && areaJunctions.length > 0
              ? areaJunctions
              : (trafficService.allJunctions || []);

            let nearest = null;
            let minDist = Infinity;
            junctionsList.forEach((jnc) => {
              const jLon = jnc.coords ? jnc.coords[0] : jnc.lon;
              const jLat = jnc.coords ? jnc.coords[1] : jnc.lat;
              if (jLon != null && jLat != null) {
                const dist = Math.hypot(longitude - jLon, latitude - jLat);
                if (dist < minDist) {
                  minDist = dist;
                  nearest = jnc;
                }
              }
            });

            if (nearest && minDist < 0.5) {
              if (onSelectJunction) onSelectJunction(nearest);
              if (onSelectCamera && nearest.cameras?.[0]?.id) {
                onSelectCamera(nearest.cameras[0].id);
              }
            }
          }

          setIsLocating(false);
        },
        (err) => {
          console.warn("Geolocation fallback:", err);
          setIsLocating(false);
          const defaultCenter = selectedJunction?.coords || (selectedLocation?.lon != null ? [selectedLocation.lon, selectedLocation.lat] : [78.1348, 11.6643]);
          setOriginInput("Kumarapalayam");
          if (mapRef.current) {
            mapRef.current.flyTo({ center: defaultCenter, zoom: 14, duration: 800 });
          }
        },
        { timeout: 6000, enableHighAccuracy: true }
      );
    } else {
      setIsLocating(false);
    }
  };

  const handleOriginSelect = (item) => {
    setOriginInput(item.name);
    const lon = item.lon ?? (item.coords ? item.coords[0] : null);
    const lat = item.lat ?? (item.coords ? item.coords[1] : null);
    if (lon != null && lat != null) {
      mapRef.current?.flyTo({ center: [lon, lat], zoom: 14, duration: 800 });
      if (onSelectLocation) {
        onSelectLocation({ lon, lat, name: item.name });
      }
      const isJnc =
        item.category === "Junctions" ||
        item.category === "Junction" ||
        item.name?.toLowerCase().includes("junction") ||
        item.name?.toLowerCase().includes("signal");
      if (isJnc) {
        const matching =
          (areaJunctions || []).find((j) => (j.name || "").toLowerCase() === item.name.toLowerCase()) ||
          (trafficService.allJunctions || []).find((j) => (j.name || "").toLowerCase() === item.name.toLowerCase());
        if (matching && onSelectJunction) onSelectJunction(matching);
      }
    }
  };

  const handleDestSelect = (item) => {
    setDestInput(item.name);
  };

  const handleSelectJunctionItem = (jnc) => {
    if (onSelectJunction) {
      onSelectJunction(jnc);
    }
    const lon = jnc.coords ? jnc.coords[0] : jnc.lon;
    const lat = jnc.coords ? jnc.coords[1] : jnc.lat;
    if (lon != null && lat != null && mapRef.current) {
      mapRef.current.flyTo({ center: [lon, lat], zoom: 14.5, duration: 800 });
    }
    if (onSelectLocation && lon != null && lat != null) {
      onSelectLocation({ lon, lat, name: jnc.name, searchCategory: "junction", zoom: 14.5 });
    }
    if (jnc.cameras && jnc.cameras.length > 0) {
      const firstOnline = jnc.cameras.find((c) => c.status === "ONLINE" || c.status === "LIVE") || jnc.cameras[0];
      if (onSelectCamera) onSelectCamera(firstOnline.id);
      if (onStartCamera) onStartCamera(firstOnline.id, { auto_analysis: true });
    }
    setShowJunctionDropdown(false);
  };

  const handleSelectCameraItem = (jnc, cam) => {
    if (onSelectJunction) {
      onSelectJunction(jnc);
    }
    const lon = jnc.coords ? jnc.coords[0] : jnc.lon;
    const lat = jnc.coords ? jnc.coords[1] : jnc.lat;
    if (lon != null && lat != null && mapRef.current) {
      mapRef.current.flyTo({ center: [lon, lat], zoom: 14.5, duration: 800 });
    }
    if (onSelectCamera) onSelectCamera(cam.id);
    if (onStartCamera) onStartCamera(cam.id, { auto_analysis: true });
    setShowJunctionDropdown(false);
  };

  const handleClearSelection = () => {
    if (onSelectJunction) {
      onSelectJunction(null);
    }
    if (onClearRoute) {
      onClearRoute();
    }
    setJunctionSearchQuery("");
    setShowJunctionDropdown(false);
    if (mapRef.current) {
      mapRef.current.flyTo({ center: [78.1348, 11.6643], zoom: 11, duration: 800 });
    }
  };

  const handleReset = () => {
    setOriginInput("");
    setDestInput("");
    handleClearSelection();
    handleCurrentLocation(false);
  };

  // Center map when selectedJunction or selectedLocation changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (routeResult) return;

    if (selectedJunction?.coords && selectedJunction.coords.length >= 2) {
      map.flyTo({ center: selectedJunction.coords, zoom: 14, duration: 800 });
    } else if (selectedLocation?.lon != null && selectedLocation?.lat != null) {
      map.flyTo({ center: [selectedLocation.lon, selectedLocation.lat], zoom: selectedLocation.zoom || 14, duration: 800 });
    }
  }, [selectedJunction, selectedLocation, routeResult]);

  // Route calculation execution
  const handleCalculateRoute = (e) => {
    e?.preventDefault();
    if (!originInput.trim() || !destInput.trim()) return;
    if (onPlanRoute) {
      onPlanRoute(originInput.trim(), destInput.trim());
    }
  };

  // Junction operational data derivation
  const getJunctionOperationalData = () => {
    if (!selectedJunction) return null;

    const jnc = selectedJunction;
    const name = (jnc.name || "Unknown Junction").toUpperCase();

    // Model readings / vehicle count from CCTV capture
    const vCount = liveCamTelemetry?.total_tracked ?? liveCamTelemetry?.vehicle_count ?? jnc.metrics?.vehicleCount ?? 0;
    const score = jnc.congestionScore ?? (vCount >= 20 ? 0.85 : vCount >= 10 ? 0.55 : 0.25);

    // Calculate condition label and badge pill as per model count reading
    let statusLabel = "NORMAL";
    let badgeLabel = "CLEAR";
    let sevColor = "var(--status-normal, #22C55E)";
    let badgeBg = "rgba(34, 197, 94, 0.15)";
    let badgeBorder = "1px solid rgba(34, 197, 94, 0.4)";

    if (vCount >= 20 || score >= 0.75 || jnc.status === "CRITICAL") {
      statusLabel = "CONGESTED";
      badgeLabel = "CRITICAL";
      sevColor = "var(--status-critical, #EF4444)";
      badgeBg = "rgba(239, 68, 68, 0.15)";
      badgeBorder = "1px solid rgba(239, 68, 68, 0.4)";
    } else if (vCount >= 10 || score >= 0.40 || jnc.status === "HIGH" || jnc.status === "MODERATE") {
      statusLabel = "WARNING";
      badgeLabel = "MODERATE";
      sevColor = "var(--status-warning, #F59E0B)";
      badgeBg = "rgba(245, 158, 11, 0.15)";
      badgeBorder = "1px solid rgba(245, 158, 11, 0.4)";
    }

    return {
      name,
      statusLabel,
      badgeLabel,
      sevColor,
      badgeBg,
      badgeBorder,
      vCount,
    };
  };

  const jncData = getJunctionOperationalData();

  // Active Route Summary
  const recRoute = routeResult?.recommended || routeResult?.forecast || routeResult?.distance;
  const altRoute = routeResult?.alternative || (routeResult?.congestion && routeResult?.congestion.found ? routeResult.congestion : null);
  const recDist = recRoute?.distance_km ?? routeResult?.distance_km;
  const recTime = recRoute?.duration_mins ? Math.round(recRoute.duration_mins) : routeResult?.duration_mins ? Math.round(routeResult.duration_mins) : null;
  const altDist = altRoute?.distance_km;
  const altTime = altRoute?.duration_mins ? Math.round(altRoute.duration_mins) : null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        position: "relative",
        background: "var(--bg-app, #111315)",
        overflow: "hidden",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* 1. TOP OPERATIONAL CONTROL BAR: [ Select Junction ▾ ] [ Current Location ] [ Clear ] */}
      <div
        style={{
          background: "var(--bg-surface, #1B2028)",
          borderBottom: "1px solid var(--border-default, #3D3F4E)",
          padding: "0.45rem 0.85rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          zIndex: 40,
          flexShrink: 0,
        }}
      >
        {/* 1a. Select Junction Dropdown */}
        <div ref={junctionDropdownRef} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setShowJunctionDropdown((prev) => !prev)}
            style={{
              height: "30px",
              padding: "0 0.75rem",
              fontSize: "0.75rem",
              fontWeight: 700,
              background: "var(--bg-surface-secondary, #252936)",
              color: selectedJunction ? "#F4F5F7" : "var(--text-muted, #737987)",
              border: "1px solid var(--border-default, #3D3F4E)",
              borderRadius: "4px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              transition: "all 0.15s ease",
            }}
          >
            <span>{selectedJunction ? selectedJunction.name : "Select Junction"}</span>
            <ChevronDown
              size={14}
              color="#9299A8"
              style={{
                transform: showJunctionDropdown ? "rotate(180deg)" : "none",
                transition: "transform 0.15s",
              }}
            />
          </button>

          {showJunctionDropdown && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                width: "320px",
                background: "var(--bg-surface, #1B2028)",
                border: "1px solid var(--border-default, #3D3F4E)",
                borderRadius: "4px",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.6)",
                zIndex: 100,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {/* Search Field */}
              <div style={{ padding: "0.5rem", borderBottom: "1px solid var(--border-light, #2C303C)" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    background: "#161920",
                    border: "1px solid #303746",
                    borderRadius: "3px",
                    padding: "0.25rem 0.5rem",
                  }}
                >
                  <Search size={13} color="#9299A8" />
                  <input
                    type="text"
                    value={junctionSearchQuery}
                    onChange={(e) => setJunctionSearchQuery(e.target.value)}
                    placeholder="Search junction or camera"
                    autoFocus
                    style={{
                      flex: 1,
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      color: "#F4F5F7",
                      fontSize: "0.75rem",
                      fontFamily: "var(--font-sans)",
                    }}
                  />
                  {junctionSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setJunctionSearchQuery("")}
                      style={{ background: "none", border: "none", color: "#9299A8", cursor: "pointer", padding: 0 }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Junction List */}
              <div style={{ maxHeight: "280px", overflowY: "auto" }}>
                {filteredJunctions.length > 0 ? (
                  filteredJunctions.map((j) => {
                    const isSelected = selectedJunction?.id === j.id || selectedJunction?.name === j.name;
                    const cams = j.cameras || [];
                    const camCount = cams.length;
                    const liveCount = cams.filter(
                      (c) => c.status === "ONLINE" || c.status === "LIVE" || (activeCameraId === c.id && cameraStatus === "online")
                    ).length;

                    return (
                      <div
                        key={j.id || j.name}
                        style={{
                          borderBottom: "1px solid var(--border-light, #2C303C)",
                          background: isSelected ? "var(--bg-surface-elevated, #252936)" : "transparent",
                        }}
                      >
                        <div
                          onClick={() => handleSelectJunctionItem(j)}
                          style={{
                            padding: "0.5rem 0.65rem",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "0.5rem",
                            transition: "background 0.1s",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface-secondary, #222733)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = isSelected ? "var(--bg-surface-elevated, #252936)" : "transparent")}
                        >
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
                            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: isSelected ? "var(--accent-soft-blue, #7B8BC8)" : "#F4F5F7", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {j.name}
                            </span>
                            <span style={{ fontSize: "0.6875rem", color: "var(--text-muted, #737987)" }}>
                              {camCount > 0 ? `${camCount} camera${camCount !== 1 ? "s" : ""} · ${liveCount} live` : "No cameras"}
                            </span>
                          </div>

                          {camCount > 0 && (
                            <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", flexShrink: 0 }}>
                              <span
                                style={{
                                  fontSize: "0.625rem",
                                  fontWeight: 800,
                                  color: liveCount > 0 ? "#22C55E" : "#737987",
                                  letterSpacing: "0.04em",
                                }}
                              >
                                {liveCount > 0 ? "LIVE" : "OFFLINE"}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Associated Cameras nested under junction */}
                        {cams.length > 0 && (
                          <div style={{ padding: "0.15rem 0.65rem 0.4rem 1.25rem", display: "flex", flexDirection: "column", gap: "3px", background: "rgba(0,0,0,0.15)" }}>
                            {cams.map((c) => {
                              const isCamActive = activeCameraId === c.id;
                              const isCamLive = c.status === "ONLINE" || c.status === "LIVE" || (isCamActive && cameraStatus === "online");

                              return (
                                <div
                                  key={c.id}
                                  onClick={() => handleSelectCameraItem(j, c)}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    cursor: "pointer",
                                    padding: "2px 4px",
                                    borderRadius: "2px",
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                                >
                                  <span style={{ fontSize: "0.6875rem", color: isCamActive ? "var(--accent-soft-blue, #7B8BC8)" : "#A0A5B5" }}>
                                    {c.approach || c.name || c.id}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: "0.5625rem",
                                      fontWeight: 800,
                                      color: isCamLive ? "#22C55E" : "#737987",
                                      padding: "1px 4px",
                                      borderRadius: "2px",
                                    }}
                                  >
                                    {isCamLive ? "LIVE" : "OFFLINE"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div style={{ padding: "1rem", textAlign: "center", color: "#737987", fontSize: "0.75rem" }}>
                    No junctions found
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 1b. Current Location Button */}
        <button
          type="button"
          onClick={() => handleCurrentLocation(true)}
          disabled={isLocating}
          style={{
            height: "30px",
            padding: "0 0.75rem",
            fontSize: "0.75rem",
            fontWeight: 700,
            background: "var(--bg-surface-secondary, #252936)",
            color: "var(--text-primary, #F4F5F7)",
            border: "1px solid var(--border-default, #3D3F4E)",
            borderRadius: "4px",
            cursor: "pointer",
            transition: "all 0.15s ease",
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
          }}
        >
          <span>{isLocating ? "Locating..." : "Current Location"}</span>
        </button>

        {/* 1c. Clear Button */}
        <button
          type="button"
          onClick={handleClearSelection}
          style={{
            height: "30px",
            padding: "0 0.75rem",
            fontSize: "0.75rem",
            fontWeight: 700,
            background: "var(--bg-surface-secondary, #252936)",
            color: "var(--text-muted, #737987)",
            border: "1px solid var(--border-default, #3D3F4E)",
            borderRadius: "4px",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          Clear
        </button>
      </div>

      {/* 2. DOMINANT INTERACTIVE MAP CONTAINER */}
      <div style={{ flex: 1, width: "100%", height: "100%", minHeight: 0, position: "relative" }}>
        <TrafficMap
          mapRef={mapRef}
          routeResult={routeResult}
          activeStrategy={activeStrategy}
          cameraTelemetry={liveCamTelemetry || telemetry}
          selectedLocation={selectedLocation}
          fromLocation={fromLocation || originInput}
          toLocation={toLocation || destInput}
          areaJunctions={areaJunctions}
          selectedJunction={selectedJunction}
          onSelectJunction={onSelectJunction}
          onSelectCamera={onSelectCamera}
          diversionData={diversionData}
          alerts={alerts}
          layers={layers}
          onSetLayers={setLayers}
          isLiveTrafficPage={true}
          hideOverlayControls={true}
          isFullPage={true}
          districtName={districtName}
        />

        {/* Floating Map Layers Control (Top Right of Map) */}
        <div
          ref={layerMenuRef}
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            zIndex: 20,
          }}
        >
          <button
            type="button"
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            style={{
              background: "var(--bg-surface, #1B2028)",
              border: "1px solid var(--border-default, #3D3F4E)",
              borderRadius: "4px",
              padding: "5px 9px",
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--text-primary, #F4F5F7)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.4)",
            }}
          >
            <Layers size={13} color="var(--accent-soft-blue, #7B8BC8)" />
            <span>Map Layers</span>
          </button>

          {showLayerMenu && (
            <div
              style={{
                marginTop: "4px",
                background: "var(--bg-surface, #1B2028)",
                border: "1px solid var(--border-default, #3D3F4E)",
                borderRadius: "4px",
                padding: "8px 10px",
                boxShadow: "0 6px 16px rgba(0, 0, 0, 0.5)",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                fontSize: "12px",
                width: "145px",
                zIndex: 30,
              }}
            >
              {[
                { key: "junctions", label: "Junctions" },
                { key: "cameras", label: "Cameras" },
                { key: "incidents", label: "Incidents" },
                { key: "routes", label: "Routes" },
              ].map(({ key, label }) => (
                <label
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "7px",
                    cursor: "pointer",
                    color: "var(--text-primary, #F4F5F7)",
                    fontWeight: 600,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!layers[key]}
                    onChange={() => toggleLayer(key)}
                    style={{ accentColor: "var(--accent-soft-blue, #7B8BC8)", cursor: "pointer" }}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* 3. COMPACT OPERATIONAL ROUTE SUMMARY (When Route Calculated) */}
        {routeResult && (
          <div
            style={{
              position: "absolute",
              top: "10px",
              left: "10px",
              background: "var(--bg-surface-elevated, #252936)",
              border: "1px solid var(--border-default, #3D3F4E)",
              borderRadius: "4px",
              padding: "0.45rem 0.7rem",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              zIndex: 15,
              fontSize: "0.6875rem",
              lineHeight: 1.4,
              maxWidth: "320px",
            }}
          >
            <div style={{ fontWeight: 800, color: "var(--text-primary, #F4F5F7)", textTransform: "uppercase", marginBottom: "3px" }}>
              ROUTE: {originInput || "ORIGIN"} → {destInput || "DESTINATION"}
            </div>
            {recDist != null && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ display: "inline-block", width: 14, height: 4, background: "var(--accent-soft-blue, #7B8BC8)", borderRadius: "1px" }}></span>
                <span style={{ fontWeight: 700, color: "var(--text-primary, #F4F5F7)" }}>
                  RECOMMENDED: {recDist} km {recTime ? `· ${recTime} min` : ""}
                </span>
              </div>
            )}
            {altDist != null && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                <span style={{ display: "inline-block", width: 14, height: 3, borderTop: "2px dashed var(--status-normal, #22C55E)" }}></span>
                <span style={{ fontWeight: 700, color: "var(--status-normal, #22C55E)" }}>
                  ALTERNATIVE: {altDist} km {altTime ? `· ${altTime} min` : ""}
                </span>
              </div>
            )}
          </div>
        )}

        {/* 4. SELECTED JUNCTION: COMPACT MAP-SIDE TELEMETRY PANEL (Bottom Right of Map) */}
        {jncData && (
          <div
            style={{
              position: "absolute",
              bottom: "12px",
              right: "12px",
              width: "300px",
              background: "var(--bg-surface, #1B2028)",
              border: "1px solid var(--border-default, #3D3F4E)",
              borderRadius: "4px",
              boxShadow: "0 4px 14px rgba(0, 0, 0, 0.5)",
              zIndex: 25,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Panel Header */}
            <div
              style={{
                padding: "0.55rem 0.75rem",
                background: "var(--bg-surface-elevated, #252936)",
                borderBottom: "1px solid var(--border-light, #2C303C)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.5rem",
              }}
            >
              <div style={{ fontSize: "0.875rem", fontWeight: 800, color: "var(--text-primary, #F4F5F7)", letterSpacing: "0.02em" }}>
                {jncData.name}
              </div>
              <button
                type="button"
                onClick={() => onSelectJunction && onSelectJunction(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted, #737987)",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  fontWeight: 800,
                  lineHeight: 1,
                  padding: "0 2px",
                }}
                title="Close Panel"
              >
                X
              </button>
            </div>

            {/* Junction Details Body */}
            <div style={{ padding: "0.6rem 0.75rem", display: "flex", flexDirection: "column", gap: "0.45rem" }}>
              {/* Traffic Condition & CCTV Model Reading Status Badge */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: "0.8125rem", fontWeight: 900, color: jncData.sevColor, letterSpacing: "0.04em" }}>
                  {jncData.statusLabel}
                </div>

                <div
                  style={{
                    padding: "0.2rem 0.55rem",
                    fontSize: "0.625rem",
                    fontWeight: 800,
                    background: jncData.badgeBg,
                    color: jncData.sevColor,
                    border: jncData.badgeBorder,
                    borderRadius: "3px",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  {jncData.badgeLabel}
                </div>
              </div>

              {/* Real Detector Counts (YOLO11 / ByteTrack) - 3x2 Clean Grid */}
              <div style={{ borderTop: "1px solid var(--border-light, #2C303C)", paddingTop: "0.5rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem 0.35rem" }}>
                  <div>
                    <div style={{ fontSize: "0.625rem", color: "var(--text-secondary, #A0A5B5)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                      Vehicles
                    </div>
                    <div style={{ fontSize: "1.125rem", fontWeight: 900, color: "var(--text-primary, #F4F5F7)", marginTop: "1px" }}>
                      {liveCamTelemetry?.total_tracked ?? liveCamTelemetry?.vehicle_count ?? selectedJunction?.metrics?.vehicleCount ?? 0}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: "0.625rem", color: "var(--text-secondary, #A0A5B5)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                      Cars
                    </div>
                    <div style={{ fontSize: "1.125rem", fontWeight: 900, color: "var(--text-primary, #F4F5F7)", marginTop: "1px" }}>
                      {liveCamTelemetry?.cars ?? liveCamTelemetry?.vehicles?.car ?? Math.round((liveCamTelemetry?.total_tracked ?? selectedJunction?.metrics?.vehicleCount ?? 0) * 0.75)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: "0.625rem", color: "var(--text-secondary, #A0A5B5)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                      Trucks
                    </div>
                    <div style={{ fontSize: "1.125rem", fontWeight: 900, color: "var(--text-primary, #F4F5F7)", marginTop: "1px" }}>
                      {liveCamTelemetry?.trucks ?? liveCamTelemetry?.vehicles?.truck ?? Math.round((liveCamTelemetry?.total_tracked ?? selectedJunction?.metrics?.vehicleCount ?? 0) * 0.15)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: "0.625rem", color: "var(--text-secondary, #A0A5B5)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                      Buses
                    </div>
                    <div style={{ fontSize: "1.125rem", fontWeight: 900, color: "var(--text-primary, #F4F5F7)", marginTop: "1px" }}>
                      {liveCamTelemetry?.buses ?? liveCamTelemetry?.vehicles?.bus ?? Math.round((liveCamTelemetry?.total_tracked ?? selectedJunction?.metrics?.vehicleCount ?? 0) * 0.05)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: "0.625rem", color: "var(--text-secondary, #A0A5B5)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                      Bikes
                    </div>
                    <div style={{ fontSize: "1.125rem", fontWeight: 900, color: "var(--text-primary, #F4F5F7)", marginTop: "1px" }}>
                      {liveCamTelemetry?.bikes ?? liveCamTelemetry?.vehicles?.bike ?? Math.round((liveCamTelemetry?.total_tracked ?? selectedJunction?.metrics?.vehicleCount ?? 0) * 0.05)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: "0.625rem", color: "var(--text-secondary, #A0A5B5)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                      Flow
                    </div>
                    <div style={{ fontSize: "1.125rem", fontWeight: 900, color: "var(--text-primary, #F4F5F7)", marginTop: "1px" }}>
                      {`${Math.round(liveCamTelemetry?.flow_per_minute ?? liveCamTelemetry?.traffic_flow_vpm ?? selectedJunction?.metrics?.trafficFlowVpm ?? 0)}/min`}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
