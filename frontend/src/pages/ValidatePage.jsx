import { useState } from "react";
import { validateDataQuality } from "../services/api";
import DataQualityResult from "../components/DataQualityResult";

const EXAMPLE = {
  demographics: { name: "John Doe", dob: "1955-03-15", gender: "M" },
  medications: ["Metformin 500mg", "Lisinopril 10mg"],
  allergies: [],
  conditions: ["Type 2 Diabetes"],
  vital_signs: { blood_pressure: "340/180", heart_rate: 72 },
  last_updated: "2024-06-15",
};

export default function ValidatePage() {
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
      const data = await validateDataQuality(parsed);
      setResult(data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-title">Data Quality Validator</div>
      <div className="page-subtitle">
        Submit a patient record to receive a quality score across completeness, accuracy, timeliness, and clinical plausibility.
      </div>

      <div className="two-col">
        {/* Input panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div className="card">
            <div className="card-title">Input — Patient Record</div>
            <label className="label">Request JSON</label>
            <textarea
              rows={26}
              value={json}
              onChange={(e) => setJson(e.target.value)}
              spellCheck={false}
            />
            <div className="btn-row">
              <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
                {loading ? "Validating…" : "→ Validate"}
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
              Scoring record…
            </div>
          )}
          {result && !loading && <DataQualityResult result={result} />}
          {!result && !loading && (
            <div className="card" style={{ textAlign: "center", padding: "48px", color: "var(--text-muted)" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>📋</div>
              <div>Submit a patient record to see the quality report.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
