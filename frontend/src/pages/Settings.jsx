import { useState } from "react";
import { Save } from "lucide-react";

export default function Settings() {
  const [apiEndpoint, setApiEndpoint] = useState("http://localhost:8000/api");
  const [theme, setTheme] = useState("dark");
  const [autoRefresh, setAutoRefresh] = useState("2000");

  const handleSave = () => {
    alert("Settings saved locally.");
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <h2>System Settings</h2>
      
      <div className="glass-card flex flex-col gap-6">
        <div>
          <h3 className="mb-4">Backend Connection</h3>
          <div className="flex flex-col gap-2">
            <label className="text-sm text-secondary">FastAPI Endpoint URL</label>
            <input 
              type="text" 
              value={apiEndpoint} 
              onChange={(e) => setApiEndpoint(e.target.value)}
              className="glass-input w-full"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", padding: "0.75rem", color: "white", borderRadius: "8px" }}
            />
            <p className="text-xs text-muted mt-1">Default: http://localhost:8000/api</p>
          </div>
        </div>

        <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.1)" }} />

        <div>
          <h3 className="mb-4">Dashboard Preferences</h3>
          
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-secondary">UI Theme</label>
              <select 
                value={theme} 
                onChange={(e) => setTheme(e.target.value)}
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", padding: "0.75rem", color: "white", borderRadius: "8px" }}
              >
                <option value="dark">Premium Dark (Glassmorphism)</option>
                <option value="light" disabled>Light (Coming Soon)</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm text-secondary">Live Metric Refresh Rate (ms)</label>
              <select 
                value={autoRefresh} 
                onChange={(e) => setAutoRefresh(e.target.value)}
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", padding: "0.75rem", color: "white", borderRadius: "8px" }}
              >
                <option value="1000">1000 ms (Fast)</option>
                <option value="2000">2000 ms (Normal)</option>
                <option value="5000">5000 ms (Slow)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button className="btn btn-primary" onClick={handleSave}>
            <Save size={16} /> Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
