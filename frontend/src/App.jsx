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

// API
import {
  getHealth,
  getRoutingStatus,
  getLocations,
  getCameraTelemetry,
  getCameraForecast,
  startCamera,
  stopCamera,
  getRouteByName,
  getAlerts,
} from "./api";

import { TAMIL_NADU_LOCATIONS } from "./locations";

const PAGE_TITLES = {
  dashboard: "DASHBOARD",
  map: "LIVE TRAFFIC MAP",
  cctv: "CAMERAS",
  routing: "ROUTE PLANNER",
  predictions: "PREDICTIONS",
  alerts: "ALERTS",
  system: "SYSTEM DIAGNOSTICS",
  mobile: "MOBILE CAMERA",
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

  // Location Search State (for map centering)
  const [selectedLocation, setSelectedLocation] = useState(null);

  // Route Planning State
  const [routeResult, setRouteResult] = useState(null);
  const [activeStrategy, setActiveStrategy] = useState("forecast");
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [fromLocation, setFromLocation] = useState("Salem Bus Stand");
  const [toLocation, setToLocation] = useState("Erode Bus Stand");

  // Rolling Telemetry History
  const [telemetryHistory, setTelemetryHistory] = useState([]);

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
          // Merge backend locations with master catalog
          const merged = Array.from(
            new Map([...lData.locations, ...TAMIL_NADU_LOCATIONS].map((item) => [item.name, item])).values()
          );
          setLocations(merged);
        }
        if (aData?.alerts) setAlerts(aData.alerts);
      } catch (err) {
        console.error("Initial load error:", err);
      }
    };

    fetchInitial();
    handlePlanRoute("Salem Bus Stand", "Erode Bus Stand");
  }, []);

  // 2. Periodic Telemetry Polling
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const telData = await getCameraTelemetry(activeCameraId).catch(() => null);
        if (telData && !telData.error && telData.telemetry) {
          setTelemetry(telData.telemetry);
          setCameraStatus("online");

          const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
          setTelemetryHistory((prev) => {
            const next = [
              ...prev,
              {
                time: nowTime,
                vehicles: telData.telemetry.vehicle_count || 0,
                speed: telData.telemetry.average_speed_kmh || 0,
                congestion: telData.telemetry.congestion_score || 0,
              },
            ];
            return next.slice(-15);
          });
        }

        const fcData = await getCameraForecast(activeCameraId).catch(() => null);
        if (fcData && !fcData.error && fcData.forecast) {
          setForecast(fcData.forecast);
        }

        const hData = await getHealth().catch(() => null);
        if (hData) setHealth(hData);

        const aData = await getAlerts().catch(() => null);
        if (aData?.alerts) setAlerts(aData.alerts);
      } catch (e) {}
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [activeCameraId]);

  // 3. Camera Handlers
  const handleStartCamera = async (camId = activeCameraId) => {
    setIsLoadingCameraAction(true);
    try {
      await startCamera(camId);
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
      const data = await getRouteByName(from, to);
      setRouteResult(data);
      if (data.recommendation) {
        setActiveStrategy(data.recommendation);
      }
    } catch (err) {
      console.error("Route planning failed:", err);
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  // 5. Search Selection Handler (Centers Map on Searched Location)
  const handleSearchSelect = (loc) => {
    setSelectedLocation(loc);
    // If user is on another page, move to dashboard/map
    if (activeTab !== "dashboard" && activeTab !== "map") {
      setActiveTab("dashboard");
    }
  };

  // Render Active Page View
  const renderActivePage = () => {
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
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
      />

      <div className="main-content-wrapper">
        <Header
          systemHealth={health}
          onSearchSelect={handleSearchSelect}
          locations={locations}
          activePageTitle={PAGE_TITLES[activeTab] || "CONTROL CENTER"}
        />

        <main className="page-content" style={{ padding: "0.875rem 1.25rem" }}>
          {renderActivePage()}
        </main>
      </div>
    </div>
  );
}
