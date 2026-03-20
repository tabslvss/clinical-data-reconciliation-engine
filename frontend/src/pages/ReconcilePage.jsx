import { useState } from "react";
import { reconcileMedication } from "../services/api";
import MedicationResult from "../components/MedicationResult";

const EXAMPLE = {
  patient_context: {
    age: 67,
    conditions: ["Type 2 Diabetes", "Hypertension"],
    recent_labs: { eGFR: 45 },
  },
  sources: [
    {
      system: "Hospital EHR",
      medication: "Metformin 1000mg twice daily",
      last_updated: "2024-10-15",
      source_reliability: "high",
    },
    {
      system: "Primary Care",
      medication: "Metformin 500mg twice daily",
      last_updated: "2025-01-20",
      source_reliability: "high",
    },
    {
      system: "Pharmacy",
      medication: "Metformin 1000mg daily",
      last_filled: "2025-01-25",
      source_reliability: "medium",
    },
  ],
};

export default function ReconcilePage() {
  const [json, setJson] = useState(JSON.stringify(EXAMPLE, null, 2));
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit() {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const parsed = JSON.parse(json);
      const data = await reconcileMedication(parsed);
      setResult(data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-title">Medication Reconciliation</div>
      <div className="page-subtitle">
        Paste conflicting medication records. The engine applies clinical rules + AI reasoning to find the most likely truth.
      </div>

      <div className="two-col">
        {/* Input panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div className="card">
            <div className="card-title">Input — Patient &amp; Sources</div>
            <label className="label">Request JSON</label>
            <textarea
              rows={28}
              value={json}
              onChange={(e) => setJson(e.target.value)}
              spellCheck={false}
            />
            <div className="btn-row">
              <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
                {loading ? "Reconciling…" : "→ Reconcile"}
              </button>
              <button className="btn-ghost" onClick={() => { setJson(JSON.stringify(EXAMPLE, null, 2)); setResult(null); setError(null); }}>
                Reset Example
              </button>
            </div>
          </div>

          {error && <div className="error-box">⚠ {error}</div>}
        </div>

        {/* Result panel */}
        <div>
          {loading && (
            <div className="card loading-row">
              <div className="spinner" />
              Analysing sources…
            </div>
          )}
          {result && !loading && <MedicationResult result={result} />}
          {!result && !loading && (
            <div className="card" style={{ textAlign: "center", padding: "48px", color: "var(--text-muted)" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>💊</div>
              <div>Submit a request to see the reconciliation result.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
