import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";

// Page Views
import Dashboard from "./pages/Dashboard";
import LiveTrafficMapPage from "./pages/LiveTrafficMapPage";
import RoutePlannerPage from "./pages/RoutePlannerPage";
import TFTPredictionsPage from "./pages/TFTPredictionsPage";
import CCTVCamerasPage from "./pages/CCTVCamerasPage";
import AlertsPage from "./pages/AlertsPage";
import SystemStatusPage from "./pages/SystemStatusPage";
import SettingsPage from "./pages/SettingsPage";
import MobileCameraPage from "./pages/MobileCameraPage";
import OfficerFieldApp from "./pages/OfficerFieldApp";
import { SettingsProvider, useSettings } from "./context/SettingsContext";

// Services & API
import {
  getHealth,
  getRoutingStatus,
  getLocations,
  getCameraTelemetry,
  getCameraForecast,
  startCamera,
  stopCamera,
  getRouteByName,
  computeOptimalRoute,
  getAlerts,
} from "./api";

import { TAMIL_NADU_LOCATIONS } from "./locations";
import { trafficService } from "./services/trafficService";

const PAGE_TITLES = {
  dashboard: "DASHBOARD",
  map: "LIVE TRAFFIC MAP",
  cctv: "CAMERAS",
  routing: "ROUTE PLANNER",
  predictions: "TRAFFIC FORECAST",
  alerts: "TRAFFIC INCIDENTS",
  settings: "SETTINGS",
  system: "SETTINGS",
  mobile: "MOBILE CAMERA",
  field: "FIELD OFFICER MODE",
};

function AppContent() {
  const getInitialTab = () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("page") === "mobile" || window.location.pathname === "/mobile" || window.location.hash === "#mobile") {
      return "mobile";
    }
    return "dashboard";
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [operatingMode, setOperatingMode] = useState("control"); // "control" | "field"
  const { settings, updateSetting, t } = useSettings();

  // Synchronize workingMode with operatingMode
  useEffect(() => {
    if (settings?.workingMode && settings.workingMode !== operatingMode) {
      setOperatingMode(settings.workingMode);
    }
  }, [settings?.workingMode]);

  // Background Auto-Refresh based on settings.autoRefresh
  useEffect(() => {
    if (!settings?.autoRefresh || settings.autoRefresh <= 0) return;

    const timer = setInterval(async () => {
      try {
        const [aData, hData] = await Promise.all([
          getAlerts().catch(() => null),
          getHealth().catch(() => null),
        ]);
        if (hData) setHealth(hData);
        if (aData?.alerts && Array.isArray(aData.alerts) && aData.alerts.length > 0) {
          setAlerts((prev) => {
            const existingMap = new Map(prev.map((a) => [a.alert_id, a]));
            aData.alerts.forEach((incoming) => {
              const existing = existingMap.get(incoming.alert_id);
              if (existing && existing.status !== "NEW" && existing.status !== "ACTIVE") {
                existingMap.set(incoming.alert_id, { ...incoming, status: existing.status, reason: existing.reason });
              } else if (!existing) {
                existingMap.set(incoming.alert_id, incoming);
              }
            });
            return Array.from(existingMap.values());
          });
        }
      } catch (e) {}
    }, settings.autoRefresh * 1000);

    return () => clearInterval(timer);
  }, [settings?.autoRefresh]);

  // Core System State
  const [health, setHealth] = useState(null);
  const [routingStatus, setRoutingStatus] = useState(null);
  const [locations, setLocations] = useState(TAMIL_NADU_LOCATIONS);
  const [telemetry, setTelemetry] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [cameraStatus, setCameraStatus] = useState("offline");
  const [activeCameraId, setActiveCameraId] = useState("CCTV-TPR-01");
  const [isLoadingCameraAction, setIsLoadingCameraAction] = useState(false);

  // Single Source of Truth: Area & Junction Hierarchy (Dynamic with browser geolocation fallback)
  const [selectedDistrict, setSelectedDistrict] = useState("tirupur");
  const [districtName, setDistrictName] = useState("Tirupur");
  const [areaOverview, setAreaOverview] = useState(() => trafficService.getAreaOverview("tirupur"));
  const [areaJunctions, setAreaJunctions] = useState(() => {
    return trafficService.getRelevantJunctions([77.3545, 11.1067], 45);
  });
  const [selectedJunction, setSelectedJunction] = useState(() => {
    const jncs = trafficService.getRelevantJunctions([77.3545, 11.1067], 45);
    return jncs[0] || null;
  });
  const [diversionData, setDiversionData] = useState(null);

  // Location Search State (for map centering) - initially officer's Current Location
  const [selectedLocation, setSelectedLocation] = useState({
    lon: 77.3545,
    lat: 11.1067,
    name: "Tirupur",
    isGpsLocation: true,
  });

  // Route Planning State
  const [routeResult, setRouteResult] = useState(null);
  const [activeStrategy, setActiveStrategy] = useState("forecast");
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [fromLocation, setFromLocation] = useState("");
  const [toLocation, setToLocation] = useState("");

  // Determine Data Mode: "LIVE" if active streaming or "DEMO"
  const isStreamingLive = cameraStatus === "online" && telemetry && telemetry.vehicle_count !== undefined;
  const dataMode = isStreamingLive ? "LIVE" : "DEMO";

  // Geolocation & Current Location State
  const [isLocating, setIsLocating] = useState(false);

  const detectCurrentLocation = useCallback(async () => {
    setIsLocating(true);
    try {
      const loc = await trafficService.detectCurrentLocation();
      const lat = loc.lat;
      const lon = loc.lon;
      const locationName = loc.name || "Current Location";

      setSelectedLocation({
        lon,
        lat,
        name: locationName,
        isGpsLocation: true,
        isUnavailable: false,
        zoom: 14,
        _ts: Date.now(),
      });

      // Only keep junctions relevant to current location (2-3 items), never all 17 statewide
      const relevant = trafficService.getRelevantJunctions([lon, lat], 45);
      setAreaJunctions(relevant);

      const closestDist = trafficService.getClosestDistrict([lon, lat]);
      const distId = closestDist?.id || loc.district?.toLowerCase() || "tirupur";
      const displayName = closestDist?.name || loc.city || locationName;

      setSelectedDistrict(distId);
      setDistrictName(displayName);
      setAreaOverview(trafficService.getAreaOverview(distId));

      if (relevant.length > 0) {
        setSelectedJunction(relevant[0]);
        if (relevant[0].cameras && relevant[0].cameras.length > 0) {
          const firstOnline = relevant[0].cameras.find((c) => c.status === "ONLINE") || relevant[0].cameras[0];
          setActiveCameraId(firstOnline.id);
        }
      } else {
        setSelectedJunction(null);
      }
    } catch (e) {
      console.warn("Location detection note:", e);
      // Safe operational fallback to Tirupur Control Station
      const fallback = {
        lat: 11.1067,
        lon: 77.3545,
        name: "Tirupur, Tamil Nadu",
        isGpsLocation: true,
        isUnavailable: false,
        zoom: 14,
        _ts: Date.now(),
      };
      setSelectedLocation(fallback);
      const relevant = trafficService.getRelevantJunctions([fallback.lon, fallback.lat], 45);
      setAreaJunctions(relevant);
      setSelectedDistrict("tirupur");
      setDistrictName("Tirupur");
      setAreaOverview(trafficService.getAreaOverview("tirupur"));
      if (relevant.length > 0) {
        setSelectedJunction(relevant[0]);
        if (relevant[0].cameras?.length > 0) {
          setActiveCameraId(relevant[0].cameras[0].id);
        }
      }
    } finally {
      setIsLocating(false);
    }
  }, []);

  // 1. Initial Load
  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const [hData, rData, lData, aData] = await Promise.all([
          getHealth().catch(() => null),
          getRoutingStatus().catch(() => null),
          getLocations().catch(() => ({ locations: [] })),
          getAlerts().catch(() => ({ alerts: [] })),
        ]);

        if (hData) setHealth(hData);
        if (rData) setRoutingStatus(rData);
        if (lData?.locations && lData.locations.length > 0) {
          const merged = Array.from(
            new Map([...lData.locations, ...TAMIL_NADU_LOCATIONS].map((item) => [item.name, item])).values()
          );
          setLocations(merged);
        }

        // Seed authentic Tamil Nadu operational incident list
        const initialSeed = [
          {
            alert_id: "ALT-SKG-01",
            severity: "HIGH",
            camera_id: "CCTV-PRD-01",
            junction: "Sankagiri Junction",
            location: "CCTV-PRD-01 · Sankagiri Junction",
            reason: "23 vehicles · Road occupancy 9%",
            action: "Monitor traffic conditions",
            timestamp: "Just now",
            status: "NEW",
            hasDiversion: true,
          },
          {
            alert_id: "ALT-ERD-02",
            severity: "HIGH",
            location: "Erode Central Bus Stand",
            junction: "Erode Central Bus Stand",
            reason: "Diversion accepted · Alternate route active",
            action: "",
            timestamp: "02:25 PM",
            status: "ACTION ACCEPTED",
            hasDiversion: true,
          },
          {
            alert_id: "ALT-SLM-03",
            severity: "HIGH",
            location: "Five Roads Junction",
            junction: "Five Roads Junction",
            reason: "Traffic flow normalized",
            action: "",
            timestamp: "01:56 PM",
            status: "RESOLVED",
            hasDiversion: false,
          },
        ];

        let combinedAlerts = initialSeed;
        if (aData?.alerts && Array.isArray(aData.alerts) && aData.alerts.length > 0) {
          const existingIds = new Set(initialSeed.map((a) => a.alert_id));
          const backendItems = aData.alerts.filter((a) => !existingIds.has(a.alert_id || a.id));
          combinedAlerts = [...initialSeed, ...backendItems];
        }
        setAlerts(combinedAlerts);
      } catch (err) {
        console.error("Initial load error:", err);
      }
    };

    fetchInitial();

    // Clean any lingering stale URL params so app starts fresh on officer's current location
    try {
      if (typeof window !== "undefined" && window.location.search) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    } catch (e) {}

    // Automatically detect officer's current location on open across every page
    detectCurrentLocation();
  }, [detectCurrentLocation]);

  // 2. Periodic Telemetry Polling
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const telData = await getCameraTelemetry(activeCameraId).catch(() => null);
        if (telData && !telData.error && telData.telemetry) {
          setTelemetry(telData.telemetry);
          setCameraStatus("online");
        }

        const fcData = await getCameraForecast(activeCameraId).catch(() => null);
        if (fcData && !fcData.error && fcData.forecast) {
          setForecast(fcData.forecast);
        }

        const hData = await getHealth().catch(() => null);
        if (hData) setHealth(hData);
      } catch (e) {}
    }, cameraStatus === "online" ? 1000 : 3000);

    return () => clearInterval(pollInterval);
  }, [activeCameraId, cameraStatus]);

  // 2b. State Synchronization with System (Junction Risk, Live Map Markers, Alert Feed)
  useEffect(() => {
    if (!telemetry || cameraStatus !== "online") return;

    const vCount = telemetry.vehicle_count ?? telemetry.total_tracked ?? 0;
    const rawScore = telemetry.congestion_score != null
      ? (telemetry.congestion_score > 1.0 ? telemetry.congestion_score / 100.0 : telemetry.congestion_score)
      : (vCount > 20 ? 0.85 : vCount > 10 ? 0.6 : 0.25);

    // Update matching junction in areaJunctions
    setAreaJunctions((prevJncs) =>
      prevJncs.map((jnc) => {
        const hasActiveCam = (jnc.cameras || []).some((c) => c.id === activeCameraId) ||
          (activeCameraId === "CCTV-SKG-01" && jnc.name.includes("Sankagiri")) ||
          (activeCameraId === "CCTV-SLM-01" && jnc.name.includes("Salem")) ||
          (activeCameraId === "CCTV-ERD-01" && jnc.name.includes("Erode"));

        if (!hasActiveCam) return jnc;

        const updatedMetrics = {
          ...(jnc.metrics || {}),
          vehicleCount: vCount,
          averageSpeedKmh: telemetry.average_speed_kmh != null ? Math.round(telemetry.average_speed_kmh) : jnc.metrics?.averageSpeedKmh,
          roadOccupancyPct: telemetry.road_occupancy != null ? Math.round(telemetry.road_occupancy * 100) : jnc.metrics?.roadOccupancyPct,
          trafficFlowVpm: telemetry.traffic_flow_vpm != null ? Math.round(telemetry.traffic_flow_vpm * 10) / 10 : jnc.metrics?.trafficFlowVpm,
          cars: telemetry.cars ?? telemetry.vehicles?.car,
          trucks: telemetry.trucks ?? telemetry.vehicles?.truck,
          buses: telemetry.buses ?? telemetry.vehicles?.bus,
          bikes: telemetry.bikes ?? telemetry.vehicles?.bike,
        };

        return {
          ...jnc,
          congestionScore: rawScore,
          metrics: updatedMetrics,
          provenance: "LIVE",
        };
      })
    );

    // Also update selectedJunction if it matches active camera
    setSelectedJunction((prev) => {
      if (!prev) return prev;
      const hasActiveCam = (prev.cameras || []).some((c) => c.id === activeCameraId) ||
        (activeCameraId === "CCTV-SKG-01" && prev.name.includes("Sankagiri")) ||
        (activeCameraId === "CCTV-SLM-01" && prev.name.includes("Salem")) ||
        (activeCameraId === "CCTV-ERD-01" && prev.name.includes("Erode"));

      if (!hasActiveCam) return prev;

      return {
        ...prev,
        congestionScore: rawScore,
        metrics: {
          ...(prev.metrics || {}),
          vehicleCount: vCount,
          averageSpeedKmh: telemetry.average_speed_kmh != null ? Math.round(telemetry.average_speed_kmh) : prev.metrics?.averageSpeedKmh,
          roadOccupancyPct: telemetry.road_occupancy != null ? Math.round(telemetry.road_occupancy * 100) : prev.metrics?.roadOccupancyPct,
          trafficFlowVpm: telemetry.traffic_flow_vpm != null ? Math.round(telemetry.traffic_flow_vpm * 10) / 10 : prev.metrics?.trafficFlowVpm,
        },
        provenance: "LIVE",
      };
    });

    // Generate high-density incident when congestion is severe
    if (rawScore >= 0.70 || vCount >= 18) {
      const alertId = `ALT-LIVE-${activeCameraId}`;
      setAlerts((prevAlerts) => {
        if (prevAlerts.some((a) => a.alert_id === alertId)) return prevAlerts;
        const newAlert = {
          alert_id: alertId,
          severity: rawScore >= 0.85 ? "CRITICAL" : "HIGH",
          location: `${activeCameraId} · Sankagiri Junction`,
          camera_id: activeCameraId,
          reason: `${vCount} vehicles detected · Road occupancy ${(telemetry.road_occupancy ? telemetry.road_occupancy * 100 : 18).toFixed(0)}%.`,
          action: rawScore >= 0.85 ? "Diversion recommended." : "Monitor traffic conditions.",
          timestamp: "Just now",
          status: "ACTIVE",
          isLive: true,
          hasDiversion: rawScore >= 0.85,
        };
        return [newAlert, ...prevAlerts];
      });
    }
  }, [telemetry, cameraStatus, activeCameraId]);

  // 3. Camera Handlers
  const handleStartCamera = async (camId = activeCameraId, options = {}) => {
    setIsLoadingCameraAction(true);
    try {
      await startCamera(camId, options);
      setActiveCameraId(camId);
      setCameraStatus("online");
      const tel = await getCameraTelemetry(camId).catch(() => null);
      if (tel?.telemetry) setTelemetry(tel.telemetry);
      const fc = await getCameraForecast(camId).catch(() => null);
      if (fc?.forecast) setForecast(fc.forecast);
    } catch (err) {
      console.error("Start camera failed:", err);
    } finally {
      setIsLoadingCameraAction(false);
    }
  };

  const handleStopCamera = async (camId = activeCameraId) => {
    setIsLoadingCameraAction(true);
    try {
      await stopCamera(camId);
      setCameraStatus("offline");
      setTelemetry(null);
    } catch (err) {
      console.error("Stop camera failed:", err);
    } finally {
      setIsLoadingCameraAction(false);
    }
  };

  // 4. Route Planning Handler
  const handlePlanRoute = async (from, to) => {
    if (!from || !to) return;
    setIsCalculatingRoute(true);
    setFromLocation(from);
    setToLocation(to);
    try {
      const data = await computeOptimalRoute(from, to, locations);
      if (data) {
        setRouteResult(data);
        if (data.recommendation) {
          setActiveStrategy(data.recommendation);
        }
      }
    } catch (err) {
      console.error("Route planning failed:", err);
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  // 5. Categorized Location Search Selection Handler
  const handleSearchSelect = (item) => {
    if (!item) return;

    const isJunction =
      item.searchCategory === "junction" ||
      item.category === "Junction" ||
      item.category === "Junctions" ||
      item.type?.toLowerCase().includes("junction") ||
      item.name?.toLowerCase().includes("junction") ||
      item.name?.toLowerCase().includes("signal") ||
      item.id?.startsWith("jnc-");

    if (isJunction) {
      // Find full junction data if item is from TAMIL_NADU_LOCATIONS or allJunctions
      const fullJnc =
        trafficService.allJunctions.find((j) => j.name.toLowerCase() === item.name.toLowerCase()) ||
        (item.coords
          ? item
          : {
              ...item,
              id: item.id || `jnc-${item.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
              coords: item.coords || [item.lon, item.lat],
              congestionScore: item.congestionScore ?? 0.28,
              status: item.status || "NORMAL",
              metrics: item.metrics || {
                vehicleCount: item.vehicleCount ?? 26,
                averageSpeedKmh: 42.0,
                roadOccupancyPct: 26,
                trafficFlowVpm: 18.0,
                cars: 18,
                trucks: 4,
                buses: 2,
                bikes: 2,
              },
              cameras: item.cameras || [
                {
                  id: `CCTV-${item.name.substring(0, 3).toUpperCase()}-01`,
                  name: `${item.name} Approach`,
                  status: "ONLINE",
                  type: "Fixed PTZ",
                },
              ],
            });

      setSelectedJunction(fullJnc);
      const lon = fullJnc.coords ? fullJnc.coords[0] : (item.lon || item.lat);
      const lat = fullJnc.coords ? fullJnc.coords[1] : (item.lat || item.lon);
      setSelectedLocation({ lon, lat, name: fullJnc.name || item.name, searchCategory: "junction", _ts: Date.now() });

      const dKey = (fullJnc.district || item.district || "Tamil Nadu").toLowerCase();
      setSelectedDistrict(dKey);
      setDistrictName(fullJnc.district || item.district || "Tamil Nadu");
      setAreaOverview(trafficService.getAreaOverview(dKey));
      const relevantJncs = trafficService.getRelevantJunctions([lon, lat], 45);
      setAreaJunctions(relevantJncs);

      if (fullJnc.cameras && fullJnc.cameras.length > 0) {
        const firstOnline = fullJnc.cameras.find((c) => c.status === "ONLINE") || fullJnc.cameras[0];
        setActiveCameraId(firstOnline.id);
      }
      if (fullJnc.diversion) {
        setDiversionData(fullJnc.diversion);
      }
      return;
    }

    if (item.searchCategory === "camera") {
      // A specific camera was searched
      setActiveCameraId(item.id);
      if (item.junctionId) {
        const jnc = trafficService.getJunctionById(item.junctionId);
        if (jnc) setSelectedJunction(jnc);
      }
      if (item.coords) {
        setSelectedLocation({ lon: item.coords[0], lat: item.coords[1], name: item.name, searchCategory: "camera", _ts: Date.now() });
      }
      return;
    }

    if (item.searchCategory === "road") {
      // A specific highway / road was searched
      const matchJnc = (trafficService.allJunctions || []).find((j) =>
        (j.roads || []).some((r) => r.toLowerCase().includes(item.name.toLowerCase()))
      );
      if (matchJnc) {
        setSelectedJunction(matchJnc);
        setSelectedLocation({ lon: matchJnc.coords[0], lat: matchJnc.coords[1], name: item.name, searchCategory: "road", _ts: Date.now() });
      } else if (item.coords) {
        setSelectedLocation({ lon: item.coords[0], lat: item.coords[1], name: item.name, searchCategory: "road", _ts: Date.now() });
      }
      return;
    }

    // A District or City was searched
    const dName = (item.name || item.district || "").toLowerCase().trim();
    const distData = trafficService.getDistrict(dName);
    if (distData) {
      setSelectedDistrict(distData.id);
      setDistrictName(distData.name);
      setAreaOverview(trafficService.getAreaOverview(distData.id));
      const jncs = trafficService.getJunctionsByArea(distData.id);
      setAreaJunctions(jncs);

      const queryTerm = (item.name || "").toLowerCase();
      const matchingJnc = jncs.find(
        (j) => j.area?.toLowerCase() === queryTerm || j.name.toLowerCase().includes(queryTerm)
      );

      if (matchingJnc) {
        setSelectedJunction(matchingJnc);
        if (matchingJnc.diversion) setDiversionData(matchingJnc.diversion);
        if (matchingJnc.cameras && matchingJnc.cameras.length > 0) {
          const firstOnline = matchingJnc.cameras.find((c) => c.status === "ONLINE") || matchingJnc.cameras[0];
          setActiveCameraId(firstOnline.id);
        }
        const lon = item.lon || item.coords?.[0] || matchingJnc.coords[0];
        const lat = item.lat || item.coords?.[1] || matchingJnc.coords[1];
        setSelectedLocation({ lon, lat, name: item.name || matchingJnc.name, searchCategory: "junction", _ts: Date.now() });
      } else if (jncs.length > 0) {
        setSelectedJunction(jncs[0]);
        if (jncs[0].cameras && jncs[0].cameras.length > 0) {
          setActiveCameraId(jncs[0].cameras[0].id);
        }
        setSelectedLocation({
          lon: item.lon || jncs[0].coords[0],
          lat: item.lat || jncs[0].coords[1],
          name: item.name || distData.name,
          _ts: Date.now(),
        });
      } else {
        setSelectedJunction(null);
        setDiversionData(null);
        setSelectedLocation({
          lon: item.lon || distData.center[0],
          lat: item.lat || distData.center[1],
          name: item.name || distData.name,
          _ts: Date.now(),
        });
      }
    } else {
      const lon = item.lon || (item.coords ? item.coords[0] : 78.1348);
      const lat = item.lat || (item.coords ? item.coords[1] : 11.6643);
      setSelectedLocation({ ...item, lon, lat, _ts: Date.now() });
      setDistrictName(item.name);
      setAreaOverview(trafficService.getAreaOverview(item.name));
      const relevant = trafficService.getRelevantJunctions([lon, lat], 45);
      setAreaJunctions(relevant);
      setSelectedJunction(relevant[0] || null);
      if (relevant[0]?.cameras?.length > 0) {
        setActiveCameraId(relevant[0].cameras[0].id);
      }
      setDiversionData(null);
    }

    if (
      activeTab !== "dashboard" &&
      activeTab !== "map" &&
      activeTab !== "cctv" &&
      activeTab !== "routing" &&
      activeTab !== "predictions"
    ) {
      setActiveTab("dashboard");
    }
  };

  // 6. Direct Junction Selection
  const handleSelectJunction = (jnc) => {
    setSelectedJunction(jnc);
    if (jnc && jnc.coords) {
      setSelectedLocation({
        lon: jnc.coords[0],
        lat: jnc.coords[1],
        name: jnc.name,
        searchCategory: "junction",
        zoom: 14.5,
        _ts: Date.now(),
      });
      if (jnc.cameras && jnc.cameras.length > 0) {
        const firstOnline = jnc.cameras.find((c) => c.status === "ONLINE") || jnc.cameras[0];
        setActiveCameraId(firstOnline.id);
      }
      if (jnc.diversion) setDiversionData(jnc.diversion);
    } else {
      setDiversionData(null);
    }
  };

  // 7. Officer Action Dispatch Handler
  const handleOfficerAction = async (targetId, actionType, alertItem = null) => {
    const alertId = alertItem?.alert_id || targetId || `ALT-${actionType}-${Date.now().toString().slice(-4)}`;
    const locName = alertItem?.location || selectedJunction?.name || "Sankagiri Junction";
    const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });

    let statusText = "ACKNOWLEDGED";
    let conditionText = alertItem?.reason || "Traffic condition active";
    let actionText = alertItem?.action || "";
    let actionUpdateText = "Action recorded";

    if (actionType === "ACCEPT" || actionType === "ACCEPT_DIVERSION") {
      statusText = "ACTION ACCEPTED";
      conditionText = "Diversion accepted · Alternate route active";
      actionText = "";
      actionUpdateText = "Diversion accepted · Alternate route active";
    } else if (actionType === "REJECT" || actionType === "REJECT_DIVERSION") {
      statusText = "ACTION REJECTED";
      conditionText = "Diversion rejected · Standard signal timing retained";
      actionText = "";
      actionUpdateText = "Diversion rejected · Standard signal timing retained";
    } else if (actionType === "OVERRIDE" || actionType === "MANUAL_CONTROL") {
      statusText = "MANUAL CONTROL ACTIVE";
      conditionText = "Manual officer control active";
      actionText = "";
      actionUpdateText = "Manual officer control active";
    } else if (actionType === "RESOLVE") {
      statusText = "RESOLVED";
      conditionText = "Traffic flow normalized";
      actionText = "";
      actionUpdateText = "Incident resolved · Traffic flow normalized";
    } else if (actionType === "ACKNOWLEDGE") {
      statusText = "ACKNOWLEDGED";
      actionUpdateText = "Incident acknowledged";
    }

    const notifMsg = `${locName} · ${actionUpdateText} · ${nowTime}`;

    try {
      await trafficService.recordOfficerDecision(alertId, actionType, notifMsg);
    } catch (e) {
      console.warn("Officer decision recording note:", e);
    }

    setAlerts((prev) => {
      const targetLower = String(targetId || "").toLowerCase();
      const locLower = String(locName || "").toLowerCase();

      const idx = prev.findIndex((a) => {
        if (a.alert_id === alertId || a.id === alertId) return true;
        if (targetId && (a.alert_id === targetId || a.id === targetId)) return true;
        if (a.camera_id && (targetLower.includes(a.camera_id.toLowerCase()) || (alertItem?.camera_id && a.camera_id === alertItem.camera_id))) return true;
        const aLoc = String(a.location || a.junction || "").toLowerCase();
        if (aLoc && locLower && (aLoc.includes(locLower) || locLower.includes(aLoc))) return true;
        if (targetLower && aLoc.includes(targetLower)) return true;
        return false;
      });

      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          status: statusText,
          reason: conditionText,
          action: actionText,
          timestamp: nowTime,
        };
        return updated;
      }
      return [
        {
          alert_id: alertId,
          severity: "HIGH",
          location: locName,
          junction: locName,
          reason: conditionText,
          action: actionText,
          timestamp: nowTime,
          status: statusText,
          hasDiversion: true,
        },
        ...prev,
      ];
    });

    return { notifMsg, statusText, timeStr: nowTime };
  };

  // 8. Diversion & Route Evaluation
  const handleEvaluateDiversion = (item) => {
    if (!item) return;
    const origin = item.name || item.recommendedName || fromLocation || "Perundurai Junction";
    const dest = item.diversion?.destination || toLocation || "Salem Bus Stand";

    if (item.diversion) {
      setDiversionData(item.diversion);
    } else if (item.recommendedName) {
      setDiversionData(item);
    }

    setFromLocation(origin);
    setToLocation(dest);
    handlePlanRoute(origin, dest);
    setActiveTab("routing");
  };

  const handleClearDiversion = () => {
    setDiversionData(null);
  };


  const handleClearRoute = () => {
    setRouteResult(null);
    setFromLocation("");
    setToLocation("");
  };

  // Smart incident navigation: determines the correct tab based on incident data
  // Camera-related incident → CCTV page with that camera
  // Junction incident → Map page with that junction focused
  // Fallback → Alerts page
  const handleIncidentClick = (incident) => {
    if (!incident) return;

    // Find matching junction from incident data
    const jncName = (incident.junction || incident.location || "").toLowerCase();
    const matchedJnc =
      (jncName &&
        (trafficService.allJunctions?.find((j) =>
          jncName.includes(j.name.toLowerCase()) || j.name.toLowerCase().includes(jncName)
        ) ||
        areaJunctions.find((j) =>
          jncName.includes(j.name.toLowerCase()) || j.name.toLowerCase().includes(jncName)
        ))) || null;

    // Apply junction selection (map zoom + camera update)
    if (matchedJnc) {
      handleSelectJunction(matchedJnc);
    }

    // Navigate to the most relevant page
    if (incident.camera_id) {
      setActiveCameraId(incident.camera_id);
      setActiveTab("cctv");
    } else if (matchedJnc) {
      setActiveTab("map");
    } else {
      setActiveTab("alerts");
    }
  };

  // Render Active Page View
  const renderActivePage = () => {
    if (operatingMode === "field") {
      return (
        <OfficerFieldApp
          onSwitchMode={() => setOperatingMode("control")}
        />
      );
    }

    switch (activeTab) {
      case "dashboard":
        return (
          <Dashboard
            health={health}
            locations={locations}
            telemetry={telemetry}
            forecast={forecast}
            alerts={alerts}
            cameraStatus={cameraStatus}
            isLoadingCameraAction={isLoadingCameraAction}
            onStartCamera={handleStartCamera}
            onStopCamera={handleStopCamera}
            routeResult={routeResult}
            activeStrategy={activeStrategy}
            setActiveStrategy={setActiveStrategy}
            onPlanRoute={handlePlanRoute}
            isCalculatingRoute={isCalculatingRoute}
            fromLocation={fromLocation}
            toLocation={toLocation}
            activeCameraId={activeCameraId}
            onSelectCamera={setActiveCameraId}
            selectedLocation={selectedLocation}
            areaOverview={areaOverview}
            districtName={districtName}
            areaJunctions={areaJunctions}
            selectedJunction={selectedJunction}
            onSelectJunction={handleSelectJunction}
            onCloseJunctionDetail={() => setSelectedJunction(null)}
            diversionData={diversionData}
            onEvaluateDiversion={handleEvaluateDiversion}
            onClearDiversion={handleClearDiversion}
            onOfficerAction={handleOfficerAction}
            onViewAlert={(a) => {
              const matchedJnc = areaJunctions.find((j) => (a.location || "").includes(j.name));
              if (matchedJnc) handleSelectJunction(matchedJnc);
            }}
            onAcknowledgeAlert={(aId) => handleOfficerAction(selectedJunction?.id || "ALERT", "ACKNOWLEDGE")}
            onDismissOverview={() => setAreaOverview(null)}
            onNavigateTab={setActiveTab}
          />
        );

      case "map":
        return (
          <LiveTrafficMapPage
            routeResult={routeResult}
            activeStrategy={activeStrategy}
            setActiveStrategy={setActiveStrategy}
            telemetry={telemetry}
            cameraStatus={cameraStatus}
            onPlanRoute={handlePlanRoute}
            locations={locations}
            selectedLocation={selectedLocation}
            fromLocation={fromLocation}
            toLocation={toLocation}
            alerts={alerts}
            areaJunctions={areaJunctions}
            selectedJunction={selectedJunction}
            onSelectJunction={setSelectedJunction}
            activeCameraId={activeCameraId}
            onSelectCamera={setActiveCameraId}
            onClearRoute={handleClearRoute}
            isCalculatingRoute={isCalculatingRoute}
            onOfficerAction={handleOfficerAction}
            diversionData={diversionData}
            onStartCamera={handleStartCamera}
            onStopCamera={handleStopCamera}
            districtName={districtName}
          />
        );

      case "cctv":
        return (
          <CCTVCamerasPage
            telemetry={telemetry}
            cameraStatus={cameraStatus}
            isLoadingCameraAction={isLoadingCameraAction}
            onStartCamera={handleStartCamera}
            onStopCamera={handleStopCamera}
            activeCameraId={activeCameraId}
            onSelectCamera={setActiveCameraId}
            selectedJunction={selectedJunction}
            selectedLocation={selectedLocation}
            districtName={districtName}
            alerts={alerts}
            onOfficerAction={handleOfficerAction}
            onNavigateTab={setActiveTab}
            onIncidentClick={handleIncidentClick}
            onSelectJunction={handleSearchSelect}
          />
        );

      case "routing":
        return (
          <RoutePlannerPage
            locations={locations}
            onPlanRoute={handlePlanRoute}
            isLoadingRoute={isCalculatingRoute}
            routeResult={routeResult}
            activeStrategy={activeStrategy}
            setActiveStrategy={setActiveStrategy}
            fromLocation={fromLocation}
            toLocation={toLocation}
            cameraTelemetry={telemetry}
            areaJunctions={areaJunctions}
            selectedJunction={selectedJunction}
            onSelectJunction={handleSelectJunction}
            selectedLocation={selectedLocation}
            onSelectLocation={setSelectedLocation}
            onSelectCamera={setActiveCameraId}
            alerts={alerts}
            forecast={forecast}
            diversionData={diversionData}
            onEvaluateDiversion={handleEvaluateDiversion}
            onClearRoute={handleClearRoute}
          />
        );

      case "predictions":
        return (
          <TFTPredictionsPage
            forecast={forecast}
            telemetry={telemetry}
            selectedLocation={selectedLocation}
            selectedJunction={selectedJunction}
            districtName={districtName}
            selectedDistrict={selectedDistrict}
            areaJunctions={areaJunctions}
            alerts={alerts}
            routeResult={routeResult}
            fromLocation={fromLocation}
            toLocation={toLocation}
            cameraStatus={cameraStatus}
            activeCameraId={activeCameraId}
            diversionData={diversionData}
            onPlanRoute={handlePlanRoute}
            onNavigateTab={setActiveTab}
            onSelectJunction={handleSearchSelect}
            onOfficerAction={handleOfficerAction}
          />
        );

      case "alerts":
        return (
          <AlertsPage
            alerts={alerts}
            onViewAlert={(a) => {
              const locStr = String(a.location || a.junction || "").toLowerCase();
              const matchedJnc =
                areaJunctions.find((j) => locStr.includes(j.name.toLowerCase()) || locStr.includes(j.id.toLowerCase())) ||
                trafficService.allJunctions?.find((j) => locStr.includes(j.name.toLowerCase()) || locStr.includes(j.id.toLowerCase()));

              if (matchedJnc) {
                handleSelectJunction(matchedJnc);
                if (matchedJnc.diversion || a.hasDiversion || a.status === "ACTION ACCEPTED") {
                  handleEvaluateDiversion(matchedJnc);
                }
              } else if (a.coords) {
                setSelectedLocation({ lon: a.coords[0], lat: a.coords[1], name: a.location || a.junction, searchCategory: "junction" });
              }

              if (a.camera_id) {
                setActiveCameraId(a.camera_id);
              }
              if (operatingMode === "field") setOperatingMode("control");
              setActiveTab("map");
            }}
            onAcknowledgeAlert={(aId, alertItem) => handleOfficerAction(aId, "ACKNOWLEDGE", alertItem)}
            onOfficerAction={handleOfficerAction}
            onNavigateTab={setActiveTab}
            selectedJunction={selectedJunction}
            selectedLocation={selectedLocation}
            diversionData={diversionData}
          />
        );

      case "settings":
        return (
          <SettingsPage
            onSwitchWorkingMode={(mode) => {
              setOperatingMode(mode);
              updateSetting("workingMode", null, mode);
            }}
          />
        );

      case "system":
        return (
          <SettingsPage
            onSwitchWorkingMode={(mode) => {
              setOperatingMode(mode);
              updateSetting("workingMode", null, mode);
            }}
          />
        );

      case "mobile":
        return (
          <MobileCameraPage />
        );

      default:
        return null;
    }
  };

  if (activeTab === "mobile" && (window.innerWidth < 768 || new URLSearchParams(window.location.search).get("page") === "mobile")) {
    return <MobileCameraPage />;
  }

  return (
    <div className="app-container">
      <Sidebar
        activeTab={operatingMode === "field" ? "field" : activeTab}
        setActiveTab={(tab) => {
          if (operatingMode === "field") setOperatingMode("control");
          setActiveTab(tab);
        }}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
      />

      <div className="main-content-wrapper">
        <Header
          systemHealth={health}
          onSearchSelect={handleSearchSelect}
          locations={locations}
          selectedLocation={selectedLocation}
          selectedJunction={selectedJunction}
          districtName={districtName}
          onRequestCurrentLocation={detectCurrentLocation}
          isLocating={isLocating}
          dataMode={dataMode}
        />

        <main
          className="page-content hide-scrollbar"
          style={{
            padding: activeTab === "map" || activeTab === "routing" ? 0 : activeTab === "predictions" ? "0.6rem 1rem" : "0.75rem 1.25rem",
            height: activeTab === "map" || activeTab === "routing" || activeTab === "predictions" ? "calc(100vh - 58px)" : "auto",
            overflow: activeTab === "map" || activeTab === "routing" || activeTab === "predictions" ? "hidden" : "auto",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {renderActivePage()}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <AppContent />
    </SettingsProvider>
  );
}
