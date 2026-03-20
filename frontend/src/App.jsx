import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import ReconcilePage from "./pages/ReconcilePage";
import ValidatePage from "./pages/ValidatePage";
import "./index.css";
import "./App.css";

function PillIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m10.5 20.5-7-7a5 5 0 1 1 7.07-7.07l7 7a5 5 0 0 1-7.07 7.07Z"/><line x1="8.5" x2="15.5" y1="8.5" y2="15.5"/>
    </svg>
  );
}
function ClipboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    </svg>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <nav className="nav">
        <div className="nav-brand">
          <div className="nav-brand-icon">⚕</div>
          ClinicalRx
        </div>
        <div className="nav-links">
          <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
            <PillIcon /> Reconcile
          </NavLink>
          <NavLink to="/validate" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
            <ClipboardIcon /> Data Quality
          </NavLink>
        </div>
      </nav>
      <main className="main">
        <Routes>
          <Route path="/" element={<ReconcilePage />} />
          <Route path="/validate" element={<ValidatePage />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
