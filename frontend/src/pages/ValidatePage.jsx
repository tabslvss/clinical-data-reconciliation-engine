import { useState } from "react";
import { validateDataQuality } from "../services/api";
import TagInput from "../components/TagInput";
import MedicationEntry, { makeMed } from "../components/MedicationEntry";
import DataQualityResult from "../components/DataQualityResult";

const ALLERGY_SUGGESTIONS = [
  "Penicillin", "Sulfa drugs", "Aspirin", "NSAIDs", "Codeine",
  "Latex", "Shellfish", "Contrast dye", "Cephalosporins",
];

// ── Autofill datasets ────────────────────────────────────────────
const TEST_DATASETS = [
  {
    label: "Poor quality record",
    data: {
      name: "John Doe", dob: "1955-03-15", gender: "M",
      medications: [
        { name: "Metformin", amount: "500", unit: "mg" },
        { name: "Lisinopril", amount: "10", unit: "mg" },
      ],
      allergies: [],
      conditions: ["Type 2 Diabetes"],
      bp: "340/180", hr: "72",
      last_updated: "2024-06-15",
    },
  },
  {
    label: "High quality record",
    data: {
      name: "Alice Smith", dob: "1962-11-20", gender: "F",
      medications: [
        { name: "Metformin", amount: "500", unit: "mg" },
        { name: "Lisinopril", amount: "10", unit: "mg" },
        { name: "Atorvastatin", amount: "40", unit: "mg" },
      ],
      allergies: ["Penicillin", "Sulfa drugs"],
      conditions: ["Type 2 Diabetes", "Hypertension", "Hyperlipidemia"],
      bp: "132/84", hr: "76",
      last_updated: new Date().toISOString().split("T")[0],
    },
  },
  {
    label: "Missing data record",
    data: {
      name: "", dob: "", gender: "",
      medications: [],
      allergies: [],
      conditions: [],
      bp: "", hr: "",
      last_updated: "2022-03-01",
    },
  },
];

function medsToString(meds) {
  return meds
    .filter(m => m.name.trim())
    .map(m => `${m.name.trim()}${m.amount ? " " + m.amount + m.unit : ""}`)
    .filter(Boolean);
}

function buildPayload(form) {
  return {
    demographics: {
      name: form.name || undefined,
      dob: form.dob || undefined,
      gender: form.gender || undefined,
    },
    medications: medsToString(form.medications),
    allergies: form.allergies,
    conditions: form.conditions.length ? form.conditions : undefined,
    vital_signs: buildVitals(form),
    last_updated: form.last_updated || undefined,
  };
}

function buildVitals(form) {
  const v = {};
  if (form.bp) v.blood_pressure = form.bp;
  if (form.hr) v.heart_rate = parseInt(form.hr);
  return Object.keys(v).length ? v : undefined;
}

function validate(form) {
  const errs = {};
  let ok = true;

  if (form.dob) {
    const parsed = new Date(form.dob);
    if (isNaN(parsed.getTime())) { errs.dob = "Invalid date"; ok = false; }
  }
  if (form.bp && !/^\d{2,3}\/\d{2,3}$/.test(form.bp.replace(/\s/g, ""))) {
    errs.bp = "Format: 120/80";
    ok = false;
  }
  if (form.hr && (isNaN(parseInt(form.hr)) || parseInt(form.hr) < 10 || parseInt(form.hr) > 300)) {
    errs.hr = "Enter 10–300 bpm";
    ok = false;
  }
  return { ok, errs };
}

const EMPTY_FORM = {
  name: "", dob: "", gender: "",
  medications: [],
  allergies: [], conditions: [],
  bp: "", hr: "",
  last_updated: "",
};

export default function ValidatePage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [errors, setErrors] = useState({});
  const [autofillOpen, setAutofillOpen] = useState(false);

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function applyAutofill(dataset) {
    setForm(dataset.data);
    setResult(null);
    setErrors({});
    setApiError(null);
    setAutofillOpen(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setApiError(null);
    const { ok, errs } = validate(form);
    setErrors(errs);
    if (!ok) return;

    setLoading(true);
    setResult(null);
    try {
      const data = await validateDataQuality(buildPayload(form));
      setResult(data);
      setTimeout(() => {
        document.getElementById("quality-result-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
            <h1 className="page-title">Data Quality Validator</h1>
            <p className="page-subtitle">Score a patient record across completeness, accuracy, timeliness, and clinical plausibility.</p>
          </div>
          {/* Autofill dropdown */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setAutofillOpen(v => !v)}
              style={{ gap: "7px", whiteSpace: "nowrap" }}
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
                minWidth: "220px", overflow: "hidden",
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

            {/* Demographics */}
            <div className="card" style={{ animation: "fadeInUp 0.4s ease 0.05s both" }}>
              <div className="section-label">Patient Demographics</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div className="field">
                  <label className="field-label">Full Name</label>
                  <input type="text" placeholder="e.g. John Doe" value={form.name} onChange={e => setField("name", e.target.value)} />
                </div>
                <div className="form-grid-2">
                  <div className="field">
                    <label className="field-label">Date of Birth</label>
                    <input
                      type="date" value={form.dob}
                      onChange={e => setField("dob", e.target.value)}
                      className={errors.dob ? "error" : ""}
                    />
                    {errors.dob && <span className="field-error">{errors.dob}</span>}
                  </div>
                  <div className="field">
                    <label className="field-label">Gender</label>
                    <select value={form.gender} onChange={e => setField("gender", e.target.value)}>
                      <option value="">Select…</option>
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                      <option value="O">Other / Non-binary</option>
                      <option value="U">Prefer not to say</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Medications */}
            <div className="card" style={{ animation: "fadeInUp 0.4s ease 0.08s both" }}>
              <div className="section-label">Current Medications</div>
              <MedicationEntry
                value={form.medications}
                onChange={v => setField("medications", v)}
              />
            </div>

            {/* Allergies + Conditions */}
            <div className="card" style={{ animation: "fadeInUp 0.4s ease 0.11s both" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                <div className="field">
                  <label className="field-label">Known Allergies</label>
                  <TagInput
                    value={form.allergies}
                    onChange={v => setField("allergies", v)}
                    placeholder="e.g. Penicillin, Sulfa drugs"
                    suggestions={ALLERGY_SUGGESTIONS}
                  />
                  <span className="field-hint">Leave empty if none — will flag as potentially incomplete</span>
                </div>
                <div className="field">
                  <label className="field-label">Diagnoses / Conditions</label>
                  <TagInput
                    value={form.conditions}
                    onChange={v => setField("conditions", v)}
                    placeholder="e.g. Type 2 Diabetes, Hypertension"
                  />
                </div>
              </div>
            </div>

            {/* Vital Signs — BP + HR only */}
            <div className="card" style={{ animation: "fadeInUp 0.4s ease 0.14s both" }}>
              <div className="section-label">Vital Signs <span style={{ textTransform: "none", fontWeight: 400, fontSize: "11px" }}>(optional)</span></div>
              <div className="form-grid-2">
                <div className="field">
                  <label className="field-label">Blood Pressure</label>
                  <input
                    type="text" placeholder="e.g. 120/80"
                    value={form.bp} onChange={e => setField("bp", e.target.value)}
                    className={errors.bp ? "error" : ""}
                  />
                  {errors.bp
                    ? <span className="field-error">{errors.bp}</span>
                    : <span className="field-hint">systolic/diastolic mmHg</span>
                  }
                </div>
                <div className="field">
                  <label className="field-label">Heart Rate</label>
                  <input
                    type="number" placeholder="e.g. 72"
                    min="10" max="300"
                    value={form.hr} onChange={e => setField("hr", e.target.value)}
                    className={errors.hr ? "error" : ""}
                  />
                  {errors.hr
                    ? <span className="field-error">{errors.hr}</span>
                    : <span className="field-hint">beats per minute</span>
                  }
                </div>
              </div>
            </div>

            {/* Record date */}
            <div className="card" style={{ animation: "fadeInUp 0.4s ease 0.17s both" }}>
              <div className="field">
                <label className="field-label">Record Last Updated</label>
                <input
                  type="date" value={form.last_updated}
                  onChange={e => setField("last_updated", e.target.value)}
                />
                <span className="field-hint">Used to assess timeliness of the record</span>
              </div>
            </div>

            {/* Actions */}
            {apiError && (
              <div className="error-banner">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {apiError}
              </div>
            )}
            <div className="btn-row">
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1, padding: "14px", fontSize: "15px" }}>
                {loading
                  ? <><span className="spinner" /> Validating…</>
                  : <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Validate Record</>
                }
              </button>
              <button
                type="button" className="btn btn-secondary"
                onClick={() => { setForm(EMPTY_FORM); setResult(null); setErrors({}); setApiError(null); }}
              >
                Reset
              </button>
            </div>
          </div>

          {/* ── Right: Result ── */}
          <div id="quality-result-anchor" style={{ animation: "fadeInUp 0.4s ease 0.2s both" }}>
            {loading && (
              <div className="card loading-card">
                <div className="spinner spinner-dark" />
                <span style={{ color: "var(--text-secondary)" }}>Scoring record quality…</span>
              </div>
            )}
            {result && !loading && <DataQualityResult result={result} />}
            {!result && !loading && (
              <div className="card">
                <div className="empty-state">
                  <div className="empty-icon">📋</div>
                  <div className="empty-title">No report yet</div>
                  <div className="empty-subtitle">Fill in the patient record and click Validate Record, or use Autofill Test Data to try a sample.</div>
                </div>
              </div>
            )}
          </div>

        </div>
      </form>
    </div>
  );
}
