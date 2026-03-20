import { useState } from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import ReconcilePage from "./pages/ReconcilePage";
import ValidatePage from "./pages/ValidatePage";
import "./index.css";
import "./App.css";

function Nav() {
  return (
    <nav className="nav">
      <div className="nav-brand">
        <span className="nav-icon">⚕</span>
        <span>ClinicalRx</span>
      </div>
      <div className="nav-links">
        <NavLink to="/" end className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
          Reconcile
        </NavLink>
        <NavLink to="/validate" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
          Data Quality
        </NavLink>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <main className="main">
        <Routes>
          <Route path="/" element={<ReconcilePage />} />
          <Route path="/validate" element={<ValidatePage />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
