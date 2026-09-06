import React from "react";
import {
  LayoutDashboard,
  Map,
  Navigation2,
  TrendingUp,
  Video,
  BarChart2,
  AlertTriangle,
  Server,
  ChevronLeft,
  ChevronRight,
  Shield,
} from "lucide-react";

export default function Sidebar({ activeTab, setActiveTab, isCollapsed, setIsCollapsed }) {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "map", label: "Live Traffic Map", icon: Map },
    { id: "cctv", label: "Cameras", icon: Video },
    { id: "routing", label: "Route Planner", icon: Navigation2 },
    { id: "predictions", label: "Predictions", icon: TrendingUp },
    { id: "alerts", label: "Alerts", icon: AlertTriangle },
    { id: "system", label: "System Diagnostics", icon: Server },
  ];

  return (
    <aside
      style={{
        width: isCollapsed ? "64px" : "220px",
        background: "var(--bg-sidebar)",
        borderRight: "1px solid var(--border-default)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        transition: "width 0.15s ease",
        position: "sticky",
        top: 0,
        height: "100vh",
        zIndex: 60,
        flexShrink: 0,
      }}
    >
      {/* Brand Header */}
      <div>
        <div
          style={{
            padding: isCollapsed ? "1rem 0.5rem" : "1rem 1.125rem",
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
            borderBottom: "1px solid var(--border-light)",
            justifyContent: isCollapsed ? "center" : "flex-start",
          }}
        >
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "var(--radius-xs)",
              background: "#0f172a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              flexShrink: 0,
            }}
          >
            <Shield size={16} />
          </div>

          {!isCollapsed && (
            <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <span
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 800,
                  color: "var(--text-primary)",
                  letterSpacing: "-0.01em",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}
              >
                TrafficControl
              </span>
              <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", fontWeight: 600 }}>
                Tamil Nadu Operations
              </span>
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <nav style={{ padding: "0.625rem 0.375rem", display: "flex", flexDirection: "column", gap: "0.125rem" }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                title={isCollapsed ? item.label : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.625rem",
                  padding: isCollapsed ? "0.5rem" : "0.5rem 0.75rem",
                  width: "100%",
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  background: isActive ? "var(--state-blue-subtle)" : "transparent",
                  color: isActive ? "var(--state-blue)" : "var(--text-secondary)",
                  fontWeight: isActive ? 700 : 500,
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                  transition: "all 0.1s ease",
                  justifyContent: isCollapsed ? "center" : "flex-start",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "#f1f5f9";
                    e.currentTarget.style.color = "#0f172a";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--text-secondary)";
                  }
                }}
              >
                <Icon size={16} color={isActive ? "var(--state-blue)" : "#64748b"} />
                {!isCollapsed && <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Collapse Toggle */}
      <div
        style={{
          padding: "0.75rem 0.625rem",
          borderTop: "1px solid var(--border-light)",
          display: "flex",
          justifyContent: isCollapsed ? "center" : "flex-end",
        }}
      >
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{
            background: "var(--bg-card-subtle)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-xs)",
            width: "26px",
            height: "26px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#64748b",
            cursor: "pointer",
          }}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </aside>
  );
}
