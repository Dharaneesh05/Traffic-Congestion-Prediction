import React, { useState, useEffect } from "react";
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
import MobileCameraPage from "./pages/MobileCameraPage";
import OfficerFieldApp from "./pages/OfficerFieldApp";

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
  predictions: "PREDICTIONS",
  alerts: "ALERTS",
  system: "SYSTEM DIAGNOSTICS",
  mobile: "MOBILE CAMERA",
  field: "FIELD OFFICER MODE",
};

export default function App() {
  const getInitialTab = () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("page") === "mobile" || window.location.pathname === "/mobile" || window.location.hash === "#mobile") {
      return "mobile";
    }
    return "dashboard";
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [operatingMode, setOperatingMode] = useState("control"); // "control" | "field"

  // Core System State
  const [health, setHealth] = useState(null);
  const [routingStatus, setRoutingStatus] = useState(null);
  const [locations, setLocations] = useState(TAMIL_NADU_LOCATIONS);
  const [telemetry, setTelemetry] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [cameraStatus, setCameraStatus] = useState("offline");
  const [activeCameraId, setActiveCameraId] = useState("CCTV-SKG-01");
  const [isLoadingCameraAction, setIsLoadingCameraAction] = useState(false);

  // Single Source of Truth: Area & Junction Hierarchy
  const [selectedDistrict, setSelectedDistrict] = useState("nagapattinam");
  const [districtName, setDistrictName] = useState("Nagapattinam");
  const [areaOverview, setAreaOverview] = useState(() => trafficService.getAreaOverview("nagapattinam"));
  const [areaJunctions, setAreaJunctions] = useState(() => trafficService.getJunctionsByArea("nagapattinam"));
  const [selectedJunction, setSelectedJunction] = useState(null);
  const [diversionData, setDiversionData] = useState(null);

  // Location Search State (for map centering)
  const [selectedLocation, setSelectedLocation] = useState({ lon: 79.8449, lat: 10.7672, name: "Nagapattinam" });

  // Route Planning State
  const [routeResult, setRouteResult] = useState(null);
  const [activeStrategy, setActiveStrategy] = useState("forecast");
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [fromLocation, setFromLocation] = useState("Salem Bus Stand");
  const [toLocation, setToLocation] = useState("Erode Bus Stand");

  // Determine Data Mode: "LIVE" if active streaming or "DEMO"
  const isStreamingLive = cameraStatus === "online" && telemetry && telemetry.vehicle_count !== undefined;
  const dataMode = isStreamingLive ? "LIVE" : "DEMO";

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

        // Seed initial alert list
        const initialAlerts = aData?.alerts && aData.alerts.length > 0 ? aData.alerts : [
          {
            alert_id: "ALT-VDM-01",
            title: "CRITICAL CONGESTION • Vedaranyam Junction",
            severity: "CRITICAL",
            location: "Vedaranyam Main Junction • NH32",
            reason: "Traffic density exceeded 74% capacity. Queue extending 450m on North Approach.",
            action: "Divert vehicles via East Coastal Bypass.",
            timestamp: "10 mins ago",
          },
          {
            alert_id: "ALT-SLM-02",
            title: "HEAVY INFLOW • Five Roads Rotary",
            severity: "HIGH",
            location: "Five Roads Junction • Salem",
            reason: "Rotary bottleneck spreading toward Omalur approach.",
            action: "Activate flyover diversion protocol.",
            timestamp: "18 mins ago",
          },
        ];
        setAlerts(initialAlerts);
      } catch (err) {
        console.error("Initial load error:", err);
      }
    };

    fetchInitial();

    // Check URL query parameters for initial state deep link
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const urlDist = searchParams.get("district");
      const urlJnc = searchParams.get("junction");
      if (urlDist) {
        const distData = trafficService.getDistrict(urlDist);
        if (distData) {
          setSelectedDistrict(distData.id);
          setDistrictName(distData.name);
          setAreaOverview(trafficService.getAreaOverview(distData.id));
          const jncs = trafficService.getJunctionsByArea(distData.id);
          setAreaJunctions(jncs);
          if (urlJnc) {
            const matchedJnc = jncs.find((j) => j.id === urlJnc) || trafficService.getJunctionById(urlJnc);
            if (matchedJnc) {
              setSelectedJunction(matchedJnc);
              setSelectedLocation({ lon: matchedJnc.coords[0], lat: matchedJnc.coords[1], name: matchedJnc.name, searchCategory: "junction" });
              if (matchedJnc.diversion) setDiversionData(matchedJnc.diversion);
              if (matchedJnc.cameras && matchedJnc.cameras.length > 0) {
                const firstOnline = matchedJnc.cameras.find((c) => c.status === "ONLINE") || matchedJnc.cameras[0];
                setActiveCameraId(firstOnline.id);
              }
            }
          } else {
            setSelectedLocation({ lon: distData.center[0], lat: distData.center[1], name: distData.name });
          }
        }
      }
    } catch (e) {
      console.warn("URL query param parse error:", e);
    }

    handlePlanRoute("Salem Bus Stand", "Erode Bus Stand");
  }, []);

  // Sync URL search params with active district and junction
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (selectedDistrict) {
        params.set("district", selectedDistrict);
      } else {
        params.delete("district");
      }
      if (selectedJunction?.id) {
        params.set("junction", selectedJunction.id);
      } else {
        params.delete("junction");
      }
      const newQuery = params.toString();
      const newUrl = `${window.location.pathname}${newQuery ? "?" + newQuery : ""}`;
      window.history.replaceState(null, "", newUrl);
    } catch (e) {}
  }, [selectedDistrict, selectedJunction]);

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

    // Generate high-density alert when congestion is severe
    if (rawScore >= 0.70 || vCount >= 18) {
      const alertId = `ALT-LIVE-${activeCameraId}`;
      setAlerts((prevAlerts) => {
        if (prevAlerts.some((a) => a.alert_id === alertId)) return prevAlerts;
        const newAlert = {
          alert_id: alertId,
          title: `HIGH DENSITY SURGE • ${activeCameraId}`,
          severity: rawScore >= 0.85 ? "CRITICAL" : "HIGH",
          location: `${activeCameraId} Highway Corridor`,
          reason: `Camera feed detected ${vCount} active vehicles. Road occupancy ${(telemetry.road_occupancy ? telemetry.road_occupancy * 100 : 70).toFixed(0)}%.`,
          action: "Deploy field interceptor and trigger signal extension.",
          timestamp: "Just now",
          isLive: true,
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

    if (item.searchCategory === "junction" || item.id?.startsWith("jnc-")) {
      // A specific junction was searched
      setSelectedJunction(item);
      if (item.coords) {
        setSelectedLocation({ lon: item.coords[0], lat: item.coords[1], name: item.name, searchCategory: "junction" });
      }
      if (item.district) {
        const dKey = item.district.toLowerCase();
        setSelectedDistrict(dKey);
        setDistrictName(item.district);
        setAreaOverview(trafficService.getAreaOverview(dKey));
        setAreaJunctions(trafficService.getJunctionsByArea(dKey));
      }
      if (item.cameras && item.cameras.length > 0) {
        const firstOnline = item.cameras.find((c) => c.status === "ONLINE") || item.cameras[0];
        setActiveCameraId(firstOnline.id);
      }
      if (item.diversion) {
        setDiversionData(item.diversion);
      }
    } else if (item.searchCategory === "camera") {
      // A specific camera was searched
      setActiveCameraId(item.id);
      if (item.junctionId) {
        const jnc = trafficService.getJunctionById(item.junctionId);
        if (jnc) setSelectedJunction(jnc);
      }
      if (item.coords) {
        setSelectedLocation({ lon: item.coords[0], lat: item.coords[1], name: item.name, searchCategory: "camera" });
      }
    } else if (item.searchCategory === "road") {
      // A specific highway / road was searched
      if (item.coords) {
        setSelectedLocation({ lon: item.coords[0], lat: item.coords[1], name: item.name, searchCategory: "road" });
      }
      const matchJnc = areaJunctions.find((j) => (j.roads || []).includes(item.name));
      if (matchJnc) setSelectedJunction(matchJnc);
    } else {
      // A District or City was searched
      const dName = (item.name || item.district || "").toLowerCase().trim();
      const distData = trafficService.getDistrict(dName);
      if (distData) {
        setSelectedDistrict(distData.id);
        setDistrictName(distData.name);
        setAreaOverview(trafficService.getAreaOverview(distData.id));
        const jncs = trafficService.getJunctionsByArea(distData.id);
        setAreaJunctions(jncs);

        // If the searched item specifically matches a town / area or junction name (e.g. Vedaranyam, Sankagiri)
        const queryTerm = (item.name || "").toLowerCase();
        const matchingJnc = jncs.find(
          (j) =>
            j.area?.toLowerCase() === queryTerm ||
            j.name.toLowerCase().includes(queryTerm)
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
          setSelectedLocation({ lon, lat, name: item.name || matchingJnc.name, searchCategory: "junction" });
        } else {
          setSelectedJunction(null);
          setDiversionData(null);
          setSelectedLocation({
            lon: item.lon || distData.center[0],
            lat: item.lat || distData.center[1],
            name: item.name || distData.name,
          });
        }
      } else {
        setSelectedLocation(item);
        setDistrictName(item.name);
        setAreaOverview(trafficService.getAreaOverview(item.name));
        setAreaJunctions([]);
        setSelectedJunction(null);
        setDiversionData(null);
      }
    }

    if (activeTab !== "dashboard" && activeTab !== "map") {
      setActiveTab("dashboard");
    }
  };

  // 6. Direct Junction Selection
  const handleSelectJunction = (jnc) => {
    setSelectedJunction(jnc);
    if (jnc.coords) {
      setSelectedLocation({ lon: jnc.coords[0], lat: jnc.coords[1], name: jnc.name, searchCategory: "junction" });
    }
    if (jnc.cameras && jnc.cameras.length > 0) {
      const firstOnline = jnc.cameras.find((c) => c.status === "ONLINE") || jnc.cameras[0];
      setActiveCameraId(firstOnline.id);
    }
  };

  // 7. Officer Action Dispatch Handler
  const handleOfficerAction = async (junctionId, actionType) => {
    const alertId = `ALT-${actionType}-${Date.now().toString().slice(-4)}`;
    await trafficService.recordOfficerDecision(alertId, actionType, `Officer dispatch for ${selectedJunction?.name || junctionId}`);

    setAlerts((prev) => [
      {
        alert_id: alertId,
        title: `Officer Action: ${actionType.replace("_", " ")}`,
        severity: actionType === "ACCEPT_DIVERSION" ? "HIGH" : "NOTICE",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        reason: `Officer dispatched action '${actionType}' for ${selectedJunction?.name || junctionId}.`,
        action: selectedJunction?.recommendedAction || "Diversion active.",
        status: "ACKNOWLEDGED",
      },
      ...prev,
    ]);
  };

  // 8. Diversion Evaluation
  const handleEvaluateDiversion = (jnc) => {
    if (jnc?.diversion) {
      setDiversionData(jnc.diversion);
    }
  };

  const handleClearDiversion = () => {
    setDiversionData(null);
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
          />
        );

      case "predictions":
        return (
          <TFTPredictionsPage
            forecast={forecast}
            telemetry={telemetry}
          />
        );

      case "alerts":
        return (
          <AlertsPage alerts={alerts} />
        );

      case "system":
        return (
          <SystemStatusPage
            health={health}
            routingStatus={routingStatus}
            cameraStatus={cameraStatus}
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
          activePageTitle={PAGE_TITLES[operatingMode === "field" ? "field" : activeTab] || "CONTROL CENTER"}
          operatingMode={operatingMode}
          onToggleOperatingMode={setOperatingMode}
          dataMode={dataMode}
        />

        <main className="page-content" style={{ padding: "0.75rem 1.25rem" }}>
          {renderActivePage()}
        </main>
      </div>
    </div>
  );
}
