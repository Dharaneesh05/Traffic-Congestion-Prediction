/**
 * App.jsx — Traffic Authority Decision Support System Shell
 * ==========================================================
 * Smart Traffic Control & Decision Support System (Tamil Nadu)
 *
 * Provides two primary interfaces:
 *   1. CONTROL ROOM DASHBOARD  — KEMETRA style operator monitoring & decision room
 *   2. POLICE OFFICER MOBILE   — Clean green/white mobile/PWA field app
 */

import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Video, BarChart2, TrendingUp, Map,
  Zap, Navigation2, Shield, ChevronRight, ArrowLeft,
  Smartphone, Monitor, Radio, AlertOctagon
} from "lucide-react";

import Dashboard           from "./pages/Dashboard";
import LiveCamera          from "./pages/LiveCamera";
import TrafficAnalytics    from "./pages/TrafficAnalytics";
import Prediction          from "./pages/Prediction";
import RouteRecommendation from "./pages/RouteRecommendation";
import OfficerFieldApp     from "./pages/OfficerFieldApp";
import { getTrafficStats, getAlerts } from "./api";

// ──────────────────────────────────────────────────────────────────────────────
// Mode Selector (Authority Landing Screen)
// ──────────────────────────────────────────────────────────────────────────────

const ModeSelector = ({ onSelect }) => (
  <motion.div
    className="mode-selector-screen"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.4 }}
  >
    {/* Header Logo */}
    <motion.div
      className="text-center mb-10"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.1 }}
    >
      <div style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 68, height: 68, borderRadius: 20,
        background: "linear-gradient(135deg, #1e40af, #059669)",
        marginBottom: "1rem",
        boxShadow: "0 8px 32px rgba(5,150,105,0.25)",
      }}>
        <Shield size={34} color="white" />
      </div>
      <h1 style={{ fontSize: "2.1rem", fontWeight: 900, letterSpacing: "-0.03em" }}>
        Smart Traffic Control & Decision Support
      </h1>
      <p className="text-secondary" style={{ marginTop: "0.5rem", fontSize: "1.05rem" }}>
        Tamil Nadu Traffic Authority • Control Room & Field Response System
      </p>
      <p className="text-muted text-xs mt-2 font-mono">YOLO11 • ByteTrack • TFT Forecast • OSM A* • Agentic RAG</p>
    </motion.div>

    {/* Mode Cards */}
    <div className="flex gap-6 max-w-4xl w-full justify-center">
      {/* Control Room Mode */}
      <motion.div
        className="mode-card control"
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        onClick={() => onSelect("control")}
      >
        <div className="mode-icon" style={{ background: "linear-gradient(135deg, rgba(30,64,175,0.2), rgba(30,64,175,0.05))", border: "1px solid rgba(59,130,246,0.3)" }}>
          <Monitor size={32} color="#3b82f6" />
        </div>
        <div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: 0, color: "#f3f4f6" }}>Control Room Console</h2>
          <p className="text-muted text-sm mt-2" style={{ lineHeight: 1.5 }}>
            For Traffic Supervisors & Operators.<br />
            KEMETRA-style junction overview, OSM road network, traffic charts, events, and AI diversion dispatch.
          </p>
        </div>
        <div className="flex flex-col gap-1.5" style={{ width: "100%", fontSize: "0.8rem", color: "var(--text-muted)" }}>
          {["Sankagiri 4-Approach OSM Network", "Real-time YOLO11 + ByteTrack CCTV Feeds", "Explainable AI Diversion & RAG SOPs", "Live Dispatch to Field Units"].map((f) => (
            <div key={f} className="flex items-center gap-2">
              <ChevronRight size={12} color="#3b82f6" />
              <span>{f}</span>
            </div>
          ))}
        </div>
        <div className="btn btn-primary w-full" style={{ pointerEvents: "none", background: "linear-gradient(135deg, #1e40af, #2563eb)" }}>
          <Monitor size={14} /> Open Control Room
        </div>
      </motion.div>

      {/* Police Officer Mobile App Mode */}
      <motion.div
        className="mode-card officer-field"
        initial={{ x: 20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        onClick={() => onSelect("officer")}
      >
        <div className="mode-icon" style={{ background: "linear-gradient(135deg, rgba(5,150,105,0.2), rgba(5,150,105,0.05))", border: "1px solid rgba(16,185,129,0.3)" }}>
          <Smartphone size={32} color="#10b981" />
        </div>
        <div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: 0, color: "#f3f4f6" }}>Police Officer Mobile App</h2>
          <p className="text-muted text-sm mt-2" style={{ lineHeight: 1.5 }}>
            For Field Officers on Duty.<br />
            Urgent mobile alerts, 4-approach statuses, diversion map, and rapid Acknowledge/Accept actions.
          </p>
        </div>
        <div className="flex flex-col gap-1.5" style={{ width: "100%", fontSize: "0.8rem", color: "var(--text-muted)" }}>
          {["Urgent Severity & Time-to-Worsen Alerts", "4-Approach Live Vehicle Count & Velocity", "Clearance Benefit & Bypass Route Map", "Field Action: Acknowledge, Accept, Resolve"].map((f) => (
            <div key={f} className="flex items-center gap-2">
              <ChevronRight size={12} color="#10b981" />
              <span>{f}</span>
            </div>
          ))}
        </div>
        <div className="btn w-full" style={{
          background: "rgba(16,185,129,0.15)", color: "#10b981",
          border: "1px solid rgba(16,185,129,0.3)", pointerEvents: "none",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          gap: "0.5rem", padding: "0.5625rem 1.125rem", borderRadius: 8,
          fontWeight: 700, fontSize: "0.875rem",
        }}>
          <Smartphone size={14} /> Open Officer Field App
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
      Tamil Nadu Traffic Authority • Smart Traffic Control & Decision Support System
    </motion.div>
  </motion.div>
);

// ──────────────────────────────────────────────────────────────────────────────
// Control Room Sidebar Item
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

// ──────────────────────────────────────────────────────────────────────────────
// Control Room Shell (KEMETRA Style Layout)
// ──────────────────────────────────────────────────────────────────────────────

const ControlRoomShell = ({ onSwitchMode, isProcessing }) => (
  <div className="app-container">
    {/* Left Navigation Sidebar */}
    <aside className="sidebar glass-panel">
      {/* Brand Header */}
      <div className="flex items-center gap-2.5 mb-6 px-1">
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "linear-gradient(135deg, #1e40af, #2563eb)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Shield size={18} color="white" />
        </div>
        <div>
          <div className="font-extrabold text-sm text-gray-100" style={{ letterSpacing: "0.02em" }}>KEMETRA TRAFFIC</div>
          <div className="text-muted text-[10px]">Decision Support Console</div>
        </div>
      </div>

      {/* Online Status Pill */}
      <div className="flex items-center gap-2 mb-5 px-3 py-2 rounded-md bg-gray-900/40 border border-white/5">
        <span className={`status-dot ${isProcessing ? "active" : "inactive"}`} />
        <span className="text-xs font-bold" style={{ color: isProcessing ? "var(--accent-success)" : "var(--text-muted)" }}>
          {isProcessing ? "PIPELINE ACTIVE" : "SURVEILLANCE STANDBY"}
        </span>
      </div>

      <div className="text-[11px] text-gray-400 uppercase tracking-wider font-bold mb-2 px-3">Navigation</div>
      <nav className="flex flex-col flex-1 gap-1">
        <SidebarItem to="/"          icon={Activity}    label="Dashboard" />
        <SidebarItem to="/camera"    icon={Video}       label="CCTV Matrix (4 Cam)" />
        <SidebarItem to="/analytics" icon={BarChart2}   label="Traffic Analytics" />
        <SidebarItem to="/prediction"icon={TrendingUp}  label="TFT Forecast" />
        <SidebarItem to="/route"     icon={Map}         label="A* Route Network" />
      </nav>

      <div className="mt-auto">
        <div className="divider mb-3" />
        <button
          className="nav-item w-full text-emerald-400 hover:text-emerald-300"
          style={{ cursor: "pointer", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "8px", padding: "0.5rem 0.75rem", textAlign: "left", width: "100%", fontSize: "0.8125rem", display: "flex", alignItems: "center", gap: "0.5rem" }}
          onClick={() => onSwitchMode("officer")}
        >
          <Smartphone size={15} />
          <span className="font-semibold">Officer Mobile App</span>
        </button>

        <button
          className="nav-item w-full mt-2"
          style={{ cursor: "pointer", background: "none", border: "none", color: "var(--text-muted)", textAlign: "left", width: "100%", fontSize: "0.8125rem" }}
          onClick={() => onSwitchMode(null)}
        >
          <ArrowLeft size={15} />
          <span>Switch Mode</span>
        </button>
      </div>
    </aside>

    {/* Main Content Area */}
    <main className="main-content">
      {/* Header Bar */}
      <header className="header">
        <div className="flex items-center gap-3">
          <Shield size={16} color="#3b82f6" />
          <span className="font-bold text-sm text-gray-100">Tamil Nadu Traffic Management • Sankagiri & Corridor Node</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-muted font-mono">
            {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
          </div>
          <button
            className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition"
            onClick={() => onSwitchMode("officer")}
          >
            <Smartphone size={13} />
            <span>Open Field App</span>
          </button>
        </div>
      </header>

      {/* Page Routing */}
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
// Root Application
// ──────────────────────────────────────────────────────────────────────────────

function AppRoot() {
  const location = useLocation();
  const [mode, setMode] = useState(() => {
    if (location.pathname === "/officer") return "officer";
    return "control";
  });
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (location.pathname === "/officer") {
      setMode("officer");
    }
  }, [location.pathname]);

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
      {mode === "control" && (
        <motion.div key="control" style={{ height: "100vh" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <ControlRoomShell onSwitchMode={setMode} isProcessing={isProcessing} />
        </motion.div>
      )}
      {mode === "officer" && (
        <motion.div key="officer" style={{ height: "100vh" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <OfficerFieldApp onSwitchMode={() => setMode("control")} />
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
