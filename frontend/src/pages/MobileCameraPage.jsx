import React, { useState, useEffect, useRef } from "react";
import { Smartphone, Video, Camera, Square, Play, RefreshCw, Activity, ArrowLeft } from "lucide-react";
import { getBackendHost, pushFrameBytes } from "../api";

export default function MobileCameraPage({ onBackToDashboard }) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [facingMode, setFacingMode] = useState("environment");
  const [telemetry, setTelemetry] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [fps, setFps] = useState(0);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamIntervalRef = useRef(null);
  const frameCountRef = useRef(0);
  const fpsTimerRef = useRef(null);

  const lanIp = getBackendHost();

  const startStream = async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsStreaming(true);

      const canvas = canvasRef.current || document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext("2d");

      frameCountRef.current = 0;
      fpsTimerRef.current = setInterval(() => {
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
      }, 1000);

      streamIntervalRef.current = setInterval(() => {
        if (videoRef.current && videoRef.current.readyState >= 2) {
          ctx.drawImage(videoRef.current, 0, 0, 640, 480);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                frameCountRef.current += 1;
                blob.arrayBuffer().then((buf) => {
                  pushFrameBytes("CCTV-MOBILE-01", new Uint8Array(buf))
                    .then((res) => {
                      if (res) setTelemetry(res);
                    })
                    .catch(() => {});
                });
              }
            },
            "image/jpeg",
            0.65
          );
        }
      }, 100);
    } catch (err) {
      console.error("Mobile Camera Access Error:", err);
      setErrorMsg(err.message || "Unable to access camera device.");
      setIsStreaming(false);
    }
  };

  const stopStream = () => {
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }
    if (fpsTimerRef.current) {
      clearInterval(fpsTimerRef.current);
      fpsTimerRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    setFps(0);
  };

  const switchCamera = () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    if (isStreaming) {
      stopStream();
      setTimeout(() => startStream(), 300);
    }
  };

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, []);

  return (
    <div style={{ maxWidth: "540px", margin: "0 auto", padding: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <button
          onClick={onBackToDashboard}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
            background: "#f1f5f9",
            border: "1px solid #cbd5e1",
            borderRadius: "4px",
            padding: "0.4rem 0.75rem",
            fontSize: "0.75rem",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <ArrowLeft size={14} />
          <span>Dashboard</span>
        </button>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "0.8125rem", fontWeight: 800, color: "#0f172a" }}>MOBILE CCTV UNIT</div>
          <div style={{ fontSize: "0.6875rem", color: "#64748b" }}>LAN: {lanIp}</div>
        </div>
      </div>

      <div
        style={{
          width: "100%",
          aspectRatio: "4/3",
          background: "#0f172a",
          borderRadius: "8px",
          overflow: "hidden",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "2px solid #334155",
          marginBottom: "1rem",
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: isStreaming ? "block" : "none",
          }}
        />
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {!isStreaming && (
          <div style={{ textAlign: "center", color: "#94a3b8", padding: "1rem" }}>
            <Camera size={36} style={{ margin: "0 auto 0.5rem", opacity: 0.7 }} />
            <div style={{ fontWeight: 700, color: "#f8fafc", fontSize: "0.875rem" }}>Mobile Camera Ready</div>
            <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
              Tap Start Live Stream to transmit rear camera frames to YOLO11 AI engine over Wi-Fi.
            </p>
          </div>
        )}

        {isStreaming && (
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              background: "rgba(15, 23, 42, 0.85)",
              color: "#ffffff",
              padding: "3px 8px",
              borderRadius: "4px",
              fontSize: "11px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444" }}></span>
            STREAMING • {fps} FPS
          </div>
        )}
      </div>

      {errorMsg && (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", color: "#991b1b", padding: "0.5rem 0.75rem", borderRadius: "4px", fontSize: "0.75rem", marginBottom: "1rem" }}>
          <strong>Camera Error:</strong> {errorMsg}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0.5rem", marginBottom: "1rem" }}>
        {!isStreaming ? (
          <button
            onClick={startStream}
            style={{
              padding: "0.75rem",
              background: "#10b981",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              fontSize: "0.875rem",
              fontWeight: 800,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
            }}
          >
            <Play size={16} />
            <span>Start Live Stream</span>
          </button>
        ) : (
          <button
            onClick={stopStream}
            style={{
              padding: "0.75rem",
              background: "#ef4444",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              fontSize: "0.875rem",
              fontWeight: 800,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
            }}
          >
            <Square size={16} />
            <span>Stop Stream</span>
          </button>
        )}

        <button
          onClick={switchCamera}
          style={{
            padding: "0.75rem",
            background: "#f1f5f9",
            color: "#0f172a",
            border: "1px solid #cbd5e1",
            borderRadius: "6px",
            fontSize: "0.75rem",
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.35rem",
          }}
        >
          <RefreshCw size={14} />
          <span>{facingMode === "environment" ? "Rear" : "Front"}</span>
        </button>
      </div>

      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "0.75rem" }}>
        <div style={{ fontSize: "0.6875rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", marginBottom: "0.5rem" }}>
          Live Highway Telemetry (Camera: CCTV-MOBILE-01)
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem", textAlign: "center" }}>
          <div style={{ background: "#f8fafc", padding: "0.5rem", borderRadius: "4px" }}>
            <div style={{ fontSize: "0.625rem", color: "#64748b", fontWeight: 700 }}>VEHICLES</div>
            <div style={{ fontSize: "1.125rem", fontWeight: 800, color: "#0f172a" }}>
              {isStreaming ? (telemetry?.vehicles ?? "0") : "--"}
            </div>
          </div>

          <div style={{ background: "#f8fafc", padding: "0.5rem", borderRadius: "4px" }}>
            <div style={{ fontSize: "0.625rem", color: "#64748b", fontWeight: 700 }}>SPEED</div>
            <div style={{ fontSize: "1.125rem", fontWeight: 800, color: "#0284c7" }}>
              {isStreaming ? `${telemetry?.speed?.toFixed(1) ?? "0.0"}` : "--"}
              {isStreaming && <span style={{ fontSize: "0.625rem" }}> km/h</span>}
            </div>
          </div>

          <div style={{ background: "#f8fafc", padding: "0.5rem", borderRadius: "4px" }}>
            <div style={{ fontSize: "0.625rem", color: "#64748b", fontWeight: 700 }}>CONGESTION</div>
            <div style={{ fontSize: "1.125rem", fontWeight: 800, color: "#10b981" }}>
              {isStreaming ? `${((telemetry?.congestion ?? 0) * 100).toFixed(0)}%` : "--"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
