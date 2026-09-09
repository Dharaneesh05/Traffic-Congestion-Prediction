import React, { useState, useEffect } from "react";
import CCTVPanel from "../components/CCTVPanel";
import { Video, Camera, Activity, Smartphone, Globe, Radio } from "lucide-react";
import { getCameraTelemetry } from "../api";

export default function CCTVCamerasPage({
  telemetry,
  cameraStatus,
  isLoadingCameraAction,
  onStartCamera,
  onStopCamera,
}) {
  const [activeCamId, setActiveCamId] = useState("CCTV-SKG-01");
  const [pageTelemetry, setPageTelemetry] = useState(telemetry);
  const isOnline = cameraStatus === "online";

  useEffect(() => {
    if (telemetry) setPageTelemetry(telemetry);
  }, [telemetry]);

  useEffect(() => {
    if (!isOnline) {
      setPageTelemetry(null);
      return;
    }
    const interval = setInterval(async () => {
      try {
        const res = await getCameraTelemetry(activeCamId);
        if (res?.telemetry) {
          setPageTelemetry(res.telemetry);
        }
      } catch (e) {}
    }, 800);
    return () => clearInterval(interval);
  }, [isOnline, activeCamId]);

  const effTel = pageTelemetry || telemetry;

  const camerasList = [
    { id: "CCTV-SKG-01", name: "Sankagiri Junction", type: "Video (Traffic.mp4)", highway: "NH544 Inflow", status: isOnline && activeCamId === "CCTV-SKG-01" ? "online" : "standby" },
    { id: "CCTV-SLM-01", name: "Salem Bus Stand Area", type: "Video (Traffic2.mp4)", highway: "Salem Radial", status: isOnline && activeCamId === "CCTV-SLM-01" ? "online" : "standby" },
    { id: "CCTV-ERD-01", name: "Erode Junction Hub", type: "Video (Traffic3.mp4)", highway: "SH15 Link", status: isOnline && activeCamId === "CCTV-ERD-01" ? "online" : "standby" },
    { id: "CCTV-MOBILE-01", name: "Mobile Phone Cam (LAN)", type: "Mobile Push Stream", highway: "Dynamic Patrol", status: isOnline && activeCamId === "CCTV-MOBILE-01" ? "online" : "standby" },
    { id: "CCTV-WEBCAM-01", name: "Operator Workstation Cam", type: "PC WebCam Capture", highway: "Control Center", status: isOnline && activeCamId === "CCTV-WEBCAM-01" ? "online" : "standby" },
    { id: "CCTV-IP-01", name: "Corridor RTSP Stream", type: "IP / RTSP Network", highway: "NH544 Toll Plaza", status: isOnline && activeCamId === "CCTV-IP-01" ? "online" : "standby" },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Overview Banner */}
      <div className="card" style={{ padding: "0.875rem 1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "var(--radius-xs)",
                background: "var(--state-blue-subtle)",
                border: "1px solid rgba(37, 99, 235, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--state-blue)",
              }}
            >
              <Video size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: "1rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                CCTV Surveillance & Neural Ingestion Grid
              </h2>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>
                6 Highway Camera Nodes • 4 Input Modes (Uploaded Video, IP Camera, Mobile Camera, PC Webcam)
              </p>
            </div>
          </div>

          <span className={`status-pill ${isOnline ? "online" : "offline"}`}>
            <span className="status-dot"></span>
            {isOnline ? "ACTIVE TELEMETRY STREAM" : "CAMERA ENGINE STANDBY"}
          </span>
        </div>
      </div>

      {/* Camera Grid Selector Bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "0.5rem" }}>
        {camerasList.map((cam) => {
          const isSelected = activeCamId === cam.id;
          return (
            <button
              key={cam.id}
              onClick={() => setActiveCamId(cam.id)}
              style={{
                background: isSelected ? "#eff6ff" : "var(--bg-card)",
                border: `1px solid ${isSelected ? "var(--state-blue)" : "var(--border-default)"}`,
                borderRadius: "var(--radius-xs)",
                padding: "0.5rem 0.625rem",
                textAlign: "left",
                cursor: "pointer",
                transition: "all 0.1s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                <span style={{ fontSize: "0.6875rem", fontWeight: 800, color: isSelected ? "var(--state-blue)" : "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                  {cam.id}
                </span>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: cam.status === "online" ? "#10b981" : "#94a3b8",
                  }}
                />
              </div>
              <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {cam.name}
              </div>
              <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", marginTop: "2px" }}>
                {cam.highway}
              </div>
            </button>
          );
        })}
      </div>

      {/* Main CCTV Stream & Specifications */}
      <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: "1.25rem" }}>
        {/* Left: CCTV Live Video Feed & Controls */}
        <CCTVPanel
          telemetry={effTel}
          cameraStatus={cameraStatus}
          onStartCamera={onStartCamera}
          onStopCamera={onStopCamera}
          isLoadingAction={isLoadingCameraAction}
          activeCameraId={activeCamId}
          onSelectCamera={setActiveCamId}
        />

        {/* Right: Technical Specs & Class Breakdown */}
        <div className="flex flex-col gap-4">
          <div className="card">
            <h3 className="card-title mb-2">
              <Camera size={14} color="var(--state-blue)" />
              {activeCamId} Node Specifications
            </h3>

            <div className="flex flex-col gap-2" style={{ fontSize: "0.75rem" }}>
              <div style={{ background: "var(--bg-card-subtle)", padding: "0.5rem", borderRadius: "var(--radius-xs)" }}>
                <span style={{ color: "var(--text-muted)", fontSize: "0.6875rem", display: "block" }}>Location Corridor</span>
                <strong>{camerasList.find(c => c.id === activeCamId)?.name} • {camerasList.find(c => c.id === activeCamId)?.highway}</strong>
              </div>

              <div style={{ background: "var(--bg-card-subtle)", padding: "0.5rem", borderRadius: "var(--radius-xs)" }}>
                <span style={{ color: "var(--text-muted)", fontSize: "0.6875rem", display: "block" }}>Active Video / Source</span>
                <strong>{isOnline ? (effTel?.source || camerasList.find(c => c.id === activeCamId)?.type) : "Standby (No Video Running)"}</strong>
              </div>

              <div style={{ background: "var(--bg-card-subtle)", padding: "0.5rem", borderRadius: "var(--radius-xs)" }}>
                <span style={{ color: "var(--text-muted)", fontSize: "0.6875rem", display: "block" }}>Resolution</span>
                <strong>{isOnline && effTel?.resolution ? effTel.resolution : (isOnline ? "1280 × 720" : "--")}</strong>
              </div>

              <div style={{ background: "var(--bg-card-subtle)", padding: "0.5rem", borderRadius: "var(--radius-xs)" }}>
                <span style={{ color: "var(--text-muted)", fontSize: "0.6875rem", display: "block" }}>Frame Rate</span>
                <strong>{isOnline && effTel?.fps != null ? `${effTel.fps} FPS` : (isOnline ? "30.0 FPS" : "--")}</strong>
              </div>

              <div style={{ background: "var(--bg-card-subtle)", padding: "0.5rem", borderRadius: "var(--radius-xs)" }}>
                <span style={{ color: "var(--text-muted)", fontSize: "0.6875rem", display: "block" }}>Neural Model</span>
                <strong>{effTel?.detector || "YOLO11n"} (Ultralytics)</strong>
              </div>

              <div style={{ background: "var(--bg-card-subtle)", padding: "0.5rem", borderRadius: "var(--radius-xs)" }}>
                <span style={{ color: "var(--text-muted)", fontSize: "0.6875rem", display: "block" }}>Multi-Object Tracker</span>
                <strong>{effTel?.tracker || "ByteTrack"} (Kalman Filter + Hungarian)</strong>
              </div>

              <div style={{ background: "var(--bg-card-subtle)", padding: "0.5rem", borderRadius: "var(--radius-xs)" }}>
                <span style={{ color: "var(--text-muted)", fontSize: "0.6875rem", display: "block" }}>Detection Status</span>
                <strong style={{ color: isOnline ? "#15803d" : "#64748b" }}>
                  {isOnline ? "Running" : "Idle"}
                </strong>
              </div>

              <div style={{ background: "var(--bg-card-subtle)", padding: "0.5rem", borderRadius: "var(--radius-xs)" }}>
                <span style={{ color: "var(--text-muted)", fontSize: "0.6875rem", display: "block" }}>Confidence Threshold</span>
                <strong>0.25 (IoU 0.45)</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
