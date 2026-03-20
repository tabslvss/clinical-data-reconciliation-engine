import { useState } from "react";
import { reconcileMedication } from "../services/api";
import SourceCard from "../components/SourceCard";
import TagInput from "../components/TagInput";
import MedicationResult from "../components/MedicationResult";

function makeSource(overrides = {}) {
  return { system: "", medication: "", date: "", dateType: "last_updated", source_reliability: "high", ...overrides };
}

// ── Autofill datasets ────────────────────────────────────────────
const TEST_DATASETS = [
  {
    label: "Metformin dose conflict (eGFR low)",
    patient: { age: "67", conditions: ["Type 2 Diabetes", "Hypertension"], egfr: "45" },
    sources: [
      makeSource({ system: "Hospital EHR",  medication: "Metformin 1000mg twice daily", date: "2024-10-15", source_reliability: "high" }),
      makeSource({ system: "Primary Care",  medication: "Metformin 500mg twice daily",  date: "2025-01-20", source_reliability: "high" }),
      makeSource({ system: "Pharmacy",       medication: "Metformin 1000mg daily",       date: "2025-01-25", dateType: "last_filled", source_reliability: "medium" }),
    ],
  },
  {
    label: "Aspirin dose discrepancy",
    patient: { age: "72", conditions: ["Hypertension", "CAD"], egfr: "" },
    sources: [
      makeSource({ system: "Hospital EHR",  medication: "Aspirin 325mg daily",   date: "2024-08-10", source_reliability: "high" }),
      makeSource({ system: "Clinic B",      medication: "Aspirin 81mg daily",    date: "2025-02-01", source_reliability: "high" }),
      makeSource({ system: "Patient Portal", medication: "Not taking aspirin",   date: "2025-01-15", source_reliability: "low" }),
    ],
  },
  {
    label: "Lisinopril dose conflict",
    patient: { age: "55", conditions: ["Hypertension", "Heart Failure"], egfr: "" },
    sources: [
      makeSource({ system: "Cardiology",    medication: "Lisinopril 20mg daily", date: "2025-02-10", source_reliability: "high" }),
      makeSource({ system: "Patient Portal", medication: "Lisinopril 10mg daily", date: "2024-08-01", source_reliability: "low" }),
      makeSource({ system: "Pharmacy",       medication: "Lisinopril 20mg daily", date: "2025-02-12", dateType: "last_filled", source_reliability: "medium" }),
    ],
  },
];

function buildPayload(patient, sources) {
  const labs = {};
  if (patient.egfr !== "") labs.eGFR = parseFloat(patient.egfr);
  return {
    patient_context: {
      age: patient.age ? parseInt(patient.age) : undefined,
      conditions: patient.conditions,
      recent_labs: Object.keys(labs).length ? labs : undefined,
    },
    sources: sources.map(s => ({
      system: s.system,
      medication: s.medication,
      [s.dateType]: s.date || undefined,
      source_reliability: s.source_reliability,
    })),
  };
}

function validate(patient, sources) {
  const errs = { patient: {}, sources: [] };
  let ok = true;
  if (!patient.age || isNaN(parseInt(patient.age)) || parseInt(patient.age) < 0 || parseInt(patient.age) > 130) {
    errs.patient.age = "Enter a valid age (0–130)"; ok = false;
  }
  if (patient.egfr !== "" && (isNaN(parseFloat(patient.egfr)) || parseFloat(patient.egfr) < 0)) {
    errs.patient.egfr = "Enter a valid eGFR value"; ok = false;
  }
  const srcErrs = sources.map(s => {
    const e = {};
    if (!s.system.trim()) { e.system = "Required"; ok = false; }
    if (!s.medication.trim()) { e.medication = "Required"; ok = false; }
    if (!s.date) { e.date = "Required"; ok = false; }
    return e;
  });
  errs.sources = srcErrs;
  return { ok, errs };
}

export default function ReconcilePage() {
  const [patient, setPatient] = useState({ age: "", conditions: [], egfr: "" });
  const [sources, setSources] = useState([makeSource(), makeSource()]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [errors, setErrors] = useState({ patient: {}, sources: [] });
  const [autofillOpen, setAutofillOpen] = useState(false);

  function setPatientField(k, v) { setPatient(p => ({ ...p, [k]: v })); }
  function updateSource(i, val) { setSources(prev => prev.map((s, idx) => idx === i ? val : s)); }
  function addSource() { setSources(prev => [...prev, makeSource()]); }
  function removeSource(i) { setSources(prev => prev.filter((_, idx) => idx !== i)); }

  function applyAutofill(ds) {
    setPatient(ds.patient);
    setSources(ds.sources);
    setResult(null);
    setErrors({ patient: {}, sources: [] });
    setApiError(null);
    setAutofillOpen(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setApiError(null);
    const { ok, errs } = validate(patient, sources);
    setErrors(errs);
    if (!ok) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await reconcileMedication(buildPayload(patient, sources));
      setResult(data);
      setTimeout(() => {
        document.getElementById("result-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err) {
      setApiError(err.response?.data?.detail || err.message || "Request failed. Check the server is running.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ animation: "fadeInUp 0.4s ease both" }}>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <h1 className="page-title">Medication Reconciliation</h1>
            <p className="page-subtitle">Enter conflicting medication records from different EHR systems to find the most clinically accurate answer.</p>
          </div>

          {/* Autofill dropdown */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setAutofillOpen(v => !v)}
              style={{ whiteSpace: "nowrap" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
              Autofill Test Data
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {autofillOpen && (
              <div style={{
                position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 50,
                background: "var(--bg)", border: "1.5px solid var(--border)",
                borderRadius: "var(--radius-sm)", boxShadow: "var(--shadow-lg)",
                minWidth: "260px", overflow: "hidden",
                animation: "scaleIn 0.15s ease",
              }}>
                {TEST_DATASETS.map((ds, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applyAutofill(ds)}
                    style={{
                      display: "block", width: "100%", padding: "11px 16px",
                      background: "none", border: "none",
                      textAlign: "left", fontSize: "13.5px", fontWeight: 500,
                      color: "var(--text)", cursor: "pointer",
                      borderBottom: i < TEST_DATASETS.length - 1 ? "1px solid var(--border)" : "none",
                      transition: "background var(--transition)",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--surface)"}
                    onMouseLeave={e => e.currentTarget.style.background = "none"}
                  >
                    {ds.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="page-cols">

          {/* ── Left: Form ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

            {/* Patient Context */}
            <div className="card" style={{ animation: "fadeInUp 0.4s ease 0.05s both" }}>
              <div className="section-label">Patient Context</div>
              <div className="card-section">
                <div className="form-grid-2">
                  <div className="field">
                    <label className="field-label">Age <span style={{ color: "var(--red)" }}>*</span></label>
                    <input
                      type="number" min="0" max="130"
                      placeholder="e.g. 67"
                      value={patient.age}
                      onChange={e => setPatientField("age", e.target.value)}
                      className={errors.patient.age ? "error" : ""}
                    />
                    {errors.patient.age && <span className="field-error">{errors.patient.age}</span>}
                  </div>
                  <div className="field">
                    <label className="field-label">eGFR <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></label>
                    <input
                      type="number" min="0" max="200"
                      placeholder="e.g. 45 mL/min"
                      value={patient.egfr}
                      onChange={e => setPatientField("egfr", e.target.value)}
                      className={errors.patient.egfr ? "error" : ""}
                    />
                    {errors.patient.egfr && <span className="field-error">{errors.patient.egfr}</span>}
                    <span className="field-hint">Used to check Metformin dosing safety</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="field-label" style={{ display: "block", marginBottom: "6px" }}>
                  Known Conditions <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span>
                </label>
                <TagInput
                  value={patient.conditions}
                  onChange={v => setPatientField("conditions", v)}
                  placeholder="e.g. Type 2 Diabetes, Hypertension"
                />
              </div>
            </div>

            {/* Sources */}
            <div style={{ animation: "fadeInUp 0.4s ease 0.1s both" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "15px" }}>Medication Sources</div>
                  <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>Add records from each EHR system</div>
                </div>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", background: "var(--surface2)", padding: "3px 10px", borderRadius: "20px", fontWeight: 600 }}>
                  {sources.length} sources
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {sources.map((src, i) => (
                  <SourceCard
                    key={i} index={i} source={src}
                    onChange={v => updateSource(i, v)}
                    onRemove={() => removeSource(i)}
                    canRemove={sources.length > 2}
                    errors={errors.sources[i] || {}}
                  />
                ))}
                {sources.length < 6 && (
                  <button type="button" className="add-source-btn" onClick={addSource}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add another source
                  </button>
                )}
              </div>
            </div>

            {apiError && (
              <div className="error-banner">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {apiError}
              </div>
            )}
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "100%", padding: "14px", fontSize: "15px" }}>
              {loading
                ? <><span className="spinner" /> Reconciling…</>
                : <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> Reconcile Medications</>
              }
            </button>
          </div>

          {/* ── Right: Result ── */}
          <div id="result-anchor" style={{ animation: "fadeInUp 0.4s ease 0.15s both" }}>
            {loading && (
              <div className="card loading-card">
                <div className="spinner spinner-dark" />
                <span style={{ color: "var(--text-secondary)" }}>Analysing sources and generating clinical reasoning…</span>
              </div>
            )}
            {result && !loading && <MedicationResult result={result} />}
            {!result && !loading && (
              <div className="card">
                <div className="empty-state">
                  <div className="empty-icon">💊</div>
                  <div className="empty-title">No result yet</div>
                  <div className="empty-subtitle">Fill in patient details and sources, or use Autofill Test Data above to try a pre-loaded scenario.</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
