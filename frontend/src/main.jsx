import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Dashboard ErrorBoundary caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "2rem", fontFamily: "sans-serif", background: "#f8fafc", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ maxWidth: "500px", background: "#ffffff", padding: "1.5rem", borderRadius: "4px", border: "1px solid #cbd5e1", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 800, color: "#0f172a", marginBottom: "0.5rem" }}>
              Traffic Operations Interface Notice
            </h2>
            <p style={{ fontSize: "0.8125rem", color: "#64748b", lineHeight: 1.5, marginBottom: "1rem" }}>
              Component render error: <code style={{ color: "#dc2626", background: "#fef2f2", padding: "2px 4px", borderRadius: "2px" }}>{this.state.error?.message}</code>
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              style={{ padding: "0.5rem 1rem", background: "#0f172a", color: "#ffffff", border: "none", borderRadius: "2px", fontWeight: 700, fontSize: "0.75rem", cursor: "pointer" }}
            >
              Reload Interface
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
