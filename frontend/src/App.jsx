/**
 * App.jsx — Two-Mode Application Shell
 * ======================================
 * Mode 1: PUBLIC USER   — Google Maps-style traveler interface
 * Mode 2: CONTROL ROOM  — Traffic police monitoring dashboard
 *
 * Mode is selected at launch and can be switched via the header.
 */

import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Video, BarChart2, TrendingUp, Map,
  Zap, Navigation2, Shield, ChevronRight, ArrowLeft,
  Car, Globe
} from "lucide-react";

import Dashboard           from "./pages/Dashboard";
import LiveCamera          from "./pages/LiveCamera";
import TrafficAnalytics    from "./pages/TrafficAnalytics";
import Prediction          from "./pages/Prediction";
import RouteRecommendation from "./pages/RouteRecommendation";
import PublicRoute         from "./pages/PublicRoute";
import { getTrafficStats } from "./api";

// ──────────────────────────────────────────────────────────────────────────────
// Mode Selector (Landing Screen)
// ──────────────────────────────────────────────────────────────────────────────

const ModeSelector = ({ onSelect }) => (
  <motion.div
    className="mode-selector-screen"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.4 }}
  >
    {/* Logo */}
    <motion.div
      className="text-center mb-12"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.1 }}
    >
      <div style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 64, height: 64, borderRadius: 18,
        background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
        marginBottom: "1rem",
        boxShadow: "0 8px 32px rgba(59,130,246,0.35)",
      }}>
        <Zap size={30} color="white" />
      </div>
      <h1 style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.03em" }}>
        Smart Traffic System
      </h1>
      <p className="text-secondary" style={{ marginTop: "0.5rem", fontSize: "1rem" }}>
        Congestion Prediction & Route Optimization · Agentic AI
      </p>
      <p className="text-muted text-sm mt-2">Select your mode to continue</p>
    </motion.div>

    {/* Mode cards */}
    <div className="flex gap-6">
      {/* Public Mode */}
      <motion.div
        className="mode-card public"
        initial={{ x: -30, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        onClick={() => onSelect("public")}
      >
        <div className="mode-icon" style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(59,130,246,0.05))", border: "1px solid rgba(59,130,246,0.3)" }}>
          <Navigation2 size={32} color="var(--accent-primary)" />
        </div>
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0 }}>I'm a Traveler</h2>
          <p className="text-muted text-sm mt-2" style={{ lineHeight: 1.5 }}>
            Find the best route between Tamil Nadu cities.<br />
            Live traffic, AI recommendations, alternate routes.
          </p>
        </div>
        <div className="flex flex-col gap-1" style={{ width: "100%", fontSize: "0.8rem", color: "var(--text-muted)" }}>
          {["From / To location search", "Google Maps-style UI", "Agentic AI route advice"].map((f) => (
            <div key={f} className="flex items-center gap-2">
              <ChevronRight size={12} color="var(--accent-primary)" />
              {f}
            </div>
          ))}
        </div>
        <div className="btn btn-primary w-full" style={{ pointerEvents: "none" }}>
          <Globe size={14} /> Enter as Traveler
        </div>
      </motion.div>

      {/* Control Room Mode */}
      <motion.div
        className="mode-card control"
        initial={{ x: 30, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        onClick={() => onSelect("control")}
      >
        <div className="mode-icon" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.2), rgba(139,92,246,0.05))", border: "1px solid rgba(139,92,246,0.3)" }}>
          <Shield size={32} color="var(--accent-purple)" />
        </div>
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0 }}>Traffic Control Room</h2>
          <p className="text-muted text-sm mt-2" style={{ lineHeight: 1.5 }}>
            For traffic police & operators.<br />
            Live cameras, YOLO11 detection, TFT prediction.
          </p>
        </div>
        <div className="flex flex-col gap-1" style={{ width: "100%", fontSize: "0.8rem", color: "var(--text-muted)" }}>
          {["4 CCTV camera feeds", "YOLO11 + ByteTrack analysis", "AI diversion recommendations"].map((f) => (
            <div key={f} className="flex items-center gap-2">
              <ChevronRight size={12} color="var(--accent-purple)" />
              {f}
            </div>
          ))}
        </div>
        <div className="btn w-full" style={{
          background: "rgba(139,92,246,0.15)", color: "var(--accent-purple)",
          border: "1px solid rgba(139,92,246,0.3)", pointerEvents: "none",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          gap: "0.5rem", padding: "0.5625rem 1.125rem", borderRadius: 8,
          fontWeight: 600, fontSize: "0.875rem",
        }}>
          <Shield size={14} /> Enter Control Room
        </div>
      </motion.div>
    </div>

    {/* Footer */}
    <motion.div
      className="text-muted text-xs text-center mt-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
    >
      Smart Traffic Congestion Prediction & Route Optimization · Final Year Engineering Project
    </motion.div>
  </motion.div>
);

// ──────────────────────────────────────────────────────────────────────────────
// Control Room Sidebar
// ──────────────────────────────────────────────────────────────────────────────

const SidebarItem = ({ to, icon: Icon, label }) => {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== "/" && location.pathname.startsWith(to));
  return (
    <Link to={to} className={`nav-item ${isActive ? "active" : ""}`}>
      <Icon size={17} />
      <span>{label}</span>
    </Link>
  );
};

const ControlRoomShell = ({ onSwitchMode, isProcessing }) => (
  <div className="app-container">
    {/* Sidebar */}
    <aside className="sidebar glass-panel">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-6" style={{ padding: "0 0.5rem" }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Zap size={17} color="white" />
        </div>
        <div>
          <div className="font-bold" style={{ fontSize: "0.875rem", lineHeight: 1.2 }}>Smart Traffic</div>
          <div className="text-muted" style={{ fontSize: "0.65rem" }}>Control Room</div>
        </div>
      </div>

      {/* Status indicator */}
      <div className="flex items-center gap-2 mb-5 px-3 py-2 rounded-md"
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
        <span className={`status-dot ${isProcessing ? "active" : "inactive"}`} />
        <span className="text-xs font-bold" style={{ color: isProcessing ? "var(--accent-success)" : "var(--text-muted)" }}>
          {isProcessing ? "SYSTEM ACTIVE" : "SYSTEM IDLE"}
        </span>
      </div>

      <div className="text-xs text-muted uppercase tracking-wider font-bold mb-2 px-3">Navigation</div>
      <nav className="flex flex-col flex-1">
        <SidebarItem to="/"          icon={Activity}    label="Dashboard" />
        <SidebarItem to="/camera"    icon={Video}       label="Live Cameras" />
        <SidebarItem to="/analytics" icon={BarChart2}   label="Traffic Analytics" />
        <SidebarItem to="/prediction"icon={TrendingUp}  label="TFT Prediction" />
        <SidebarItem to="/route"     icon={Map}         label="Route Optimization" />
      </nav>

      <div className="mt-auto">
        <div className="divider mb-3" />
        <button
          className="nav-item w-full"
          style={{ cursor: "pointer", background: "none", border: "none", color: "var(--text-muted)", textAlign: "left", width: "100%", fontSize: "0.875rem" }}
          onClick={onSwitchMode}
        >
          <ArrowLeft size={16} />
          <span>Switch Mode</span>
        </button>
      </div>
    </aside>

    {/* Main Content */}
    <main className="main-content">
      {/* Header */}
      <header className="header">
        <div className="flex items-center gap-3">
          <Shield size={16} color="var(--accent-purple)" />
          <span className="font-bold" style={{ fontSize: "0.9375rem" }}>Southern Tamil Nadu Traffic Monitoring</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-muted font-mono">
            {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
          </div>
          <div className="flex items-center gap-2 glass-card-flat" style={{ padding: "0.35rem 0.875rem", borderRadius: 999 }}>
            <span className={`status-dot ${isProcessing ? "active" : "inactive"}`} />
            <span className="text-xs font-bold text-secondary">
              {isProcessing ? "LIVE" : "STANDBY"}
            </span>
          </div>
        </div>
      </header>

      {/* Page */}
      <div className="page-container">
        <Routes>
          <Route path="/"           element={<Dashboard />} />
          <Route path="/camera"     element={<LiveCamera />} />
          <Route path="/analytics"  element={<TrafficAnalytics />} />
          <Route path="/prediction" element={<Prediction />} />
          <Route path="/route"      element={<RouteRecommendation />} />
        </Routes>
      </div>
    </main>
  </div>
);

// ──────────────────────────────────────────────────────────────────────────────
// Public Mode Shell (full-page map — no sidebar)
// ──────────────────────────────────────────────────────────────────────────────

const PublicShell = ({ onSwitchMode }) => (
  <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
    {/* Slim header */}
    <header style={{
      height: 52, display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 1.25rem",
      background: "rgba(8,10,14,0.92)", backdropFilter: "blur(16px)",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
      flexShrink: 0, zIndex: 20,
    }}>
      <div className="flex items-center gap-2">
        <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Navigation2 size={14} color="white" />
        </div>
        <span className="font-bold text-sm">Smart Route Planner</span>
        <span className="badge badge-primary" style={{ fontSize: "0.6rem" }}>Tamil Nadu</span>
      </div>
      <button
        className="btn btn-ghost"
        style={{ padding: "0.3rem 0.75rem", fontSize: "0.75rem" }}
        onClick={onSwitchMode}
      >
        <Shield size={12} />
        Control Room
      </button>
    </header>

    {/* Full-height map page */}
    <div style={{ flex: 1, overflow: "hidden" }}>
      <Routes>
        <Route path="*" element={<PublicRoute />} />
      </Routes>
    </div>
  </div>
);

// ──────────────────────────────────────────────────────────────────────────────
// Root App
// ──────────────────────────────────────────────────────────────────────────────

function AppRoot() {
  const [mode, setMode]         = useState(null); // null = selector, "public", "control"
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const data = await getTrafficStats();
        setIsProcessing(data.is_processing);
      } catch {}
    };
    check();
    const id = setInterval(check, 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <AnimatePresence mode="wait">
      {mode === null && (
        <ModeSelector key="selector" onSelect={setMode} />
      )}
      {mode === "public" && (
        <motion.div key="public" style={{ height: "100vh" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <PublicShell onSwitchMode={() => setMode(null)} />
        </motion.div>
      )}
      {mode === "control" && (
        <motion.div key="control" style={{ height: "100vh" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <ControlRoomShell onSwitchMode={() => setMode(null)} isProcessing={isProcessing} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <Router>
      <AppRoot />
    </Router>
  );
}
