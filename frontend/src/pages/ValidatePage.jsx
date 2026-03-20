import { useState } from "react";
import { validateDataQuality } from "../services/api";
import TagInput from "../components/TagInput";
import DataQualityResult from "../components/DataQualityResult";

const MED_SUGGESTIONS = [
  "Metformin 500mg", "Metformin 1000mg", "Lisinopril 10mg", "Lisinopril 20mg",
  "Atorvastatin 40mg", "Aspirin 81mg", "Aspirin 325mg", "Amlodipine 5mg",
  "Metoprolol 50mg", "Omeprazole 20mg", "Levothyroxine 50mcg", "Insulin Glargine",
];
const CONDITION_SUGGESTIONS = [
  "Type 2 Diabetes", "Type 1 Diabetes", "Hypertension", "Heart Failure",
  "Atrial Fibrillation", "CKD", "COPD", "Asthma", "Hyperlipidemia",
  "Hypothyroidism", "Depression", "GERD", "CAD",
];
const ALLERGY_SUGGESTIONS = [
  "Penicillin", "Sulfa drugs", "Aspirin", "NSAIDs", "Codeine",
  "Latex", "Shellfish", "Contrast dye", "Cephalosporins",
];

function buildPayload(form) {
  return {
    demographics: {
      name: form.name || undefined,
      dob: form.dob || undefined,
      gender: form.gender || undefined,
    },
    medications: form.medications.length ? form.medications : undefined,
    allergies: form.allergies.length ? form.allergies : [],
    conditions: form.conditions.length ? form.conditions : undefined,
    vital_signs: buildVitals(form),
    last_updated: form.last_updated || undefined,
  };
}

function buildVitals(form) {
  const v = {};
  if (form.bp) v.blood_pressure = form.bp;
  if (form.hr) v.heart_rate = parseInt(form.hr);
  if (form.spo2) v.oxygen_saturation = parseFloat(form.spo2);
  if (form.temp) v.temperature = parseFloat(form.temp);
  if (form.rr) v.respiratory_rate = parseInt(form.rr);
  return Object.keys(v).length ? v : undefined;
}

function validate(form) {
  const errs = {};
  let ok = true;

  if (form.dob) {
    const parsed = new Date(form.dob);
    if (isNaN(parsed.getTime())) { errs.dob = "Invalid date format"; ok = false; }
  }
  if (form.bp && !/^\d{2,3}\/\d{2,3}$/.test(form.bp.replace(/\s/g, ""))) {
    errs.bp = "Format: systolic/diastolic (e.g. 120/80)";
    ok = false;
  }
  if (form.hr && (isNaN(parseInt(form.hr)) || parseInt(form.hr) < 10 || parseInt(form.hr) > 300)) {
    errs.hr = "Enter 10–300 bpm";
    ok = false;
  }
  if (form.spo2 && (isNaN(parseFloat(form.spo2)) || parseFloat(form.spo2) < 50 || parseFloat(form.spo2) > 100)) {
    errs.spo2 = "Enter 50–100%";
    ok = false;
  }
  if (form.temp && (isNaN(parseFloat(form.temp)) || parseFloat(form.temp) < 30 || parseFloat(form.temp) > 45)) {
    errs.temp = "Enter 30–45 °C";
    ok = false;
  }
  return { ok, errs };
}

const EMPTY_FORM = {
  name: "", dob: "", gender: "",
  medications: [], allergies: [], conditions: [],
  bp: "", hr: "", spo2: "", temp: "", rr: "",
  last_updated: "",
};

export default function ValidatePage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [errors, setErrors] = useState({});

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

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

  function handleReset() {
    setForm(EMPTY_FORM);
    setResult(null);
    setErrors({});
    setApiError(null);
  }

  return (
    <div style={{ animation: "fadeInUp 0.4s ease both" }}>
      <div className="page-header">
        <h1 className="page-title">Data Quality Validator</h1>
        <p className="page-subtitle">Score a patient record across completeness, accuracy, timeliness, and clinical plausibility.</p>
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
                    <input type="date" value={form.dob} onChange={e => setField("dob", e.target.value)} className={errors.dob ? "error" : ""} />
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

            {/* Clinical Data */}
            <div className="card" style={{ animation: "fadeInUp 0.4s ease 0.1s both" }}>
              <div className="section-label">Clinical Data</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                <div className="field">
                  <label className="field-label">Current Medications</label>
                  <TagInput
                    value={form.medications}
                    onChange={v => setField("medications", v)}
                    placeholder="e.g. Metformin 500mg, Lisinopril 10mg"
                    suggestions={MED_SUGGESTIONS}
                  />
                </div>
                <div className="field">
                  <label className="field-label">Known Allergies</label>
                  <TagInput
                    value={form.allergies}
                    onChange={v => setField("allergies", v)}
                    placeholder="e.g. Penicillin, Sulfa drugs"
                    suggestions={ALLERGY_SUGGESTIONS}
                  />
                  <span className="field-hint">Leave empty if no known allergies (will flag as potentially incomplete)</span>
                </div>
                <div className="field">
                  <label className="field-label">Diagnoses / Conditions</label>
                  <TagInput
                    value={form.conditions}
                    onChange={v => setField("conditions", v)}
                    placeholder="e.g. Type 2 Diabetes, Hypertension"
                    suggestions={CONDITION_SUGGESTIONS}
                  />
                </div>
              </div>
            </div>

            {/* Vital Signs */}
            <div className="card" style={{ animation: "fadeInUp 0.4s ease 0.15s both" }}>
              <div className="section-label">Vital Signs <span style={{ textTransform: "none", fontSize: "11px", fontWeight: 400 }}>(optional)</span></div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div className="form-grid-2">
                  <div className="field">
                    <label className="field-label">Blood Pressure</label>
                    <input
                      type="text" placeholder="e.g. 120/80"
                      value={form.bp} onChange={e => setField("bp", e.target.value)}
                      className={errors.bp ? "error" : ""}
                    />
                    {errors.bp && <span className="field-error">{errors.bp}</span>}
                  </div>
                  <div className="field">
                    <label className="field-label">Heart Rate <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: "12px" }}>bpm</span></label>
                    <input
                      type="number" placeholder="e.g. 72" min="10" max="300"
                      value={form.hr} onChange={e => setField("hr", e.target.value)}
                      className={errors.hr ? "error" : ""}
                    />
                    {errors.hr && <span className="field-error">{errors.hr}</span>}
                  </div>
                </div>
                <div className="form-grid-3">
                  <div className="field">
                    <label className="field-label">SpO₂ <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: "12px" }}>%</span></label>
                    <input
                      type="number" placeholder="e.g. 98" min="50" max="100" step="0.1"
                      value={form.spo2} onChange={e => setField("spo2", e.target.value)}
                      className={errors.spo2 ? "error" : ""}
                    />
                    {errors.spo2 && <span className="field-error">{errors.spo2}</span>}
                  </div>
                  <div className="field">
                    <label className="field-label">Temperature <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: "12px" }}>°C</span></label>
                    <input
                      type="number" placeholder="e.g. 36.6" min="30" max="45" step="0.1"
                      value={form.temp} onChange={e => setField("temp", e.target.value)}
                      className={errors.temp ? "error" : ""}
                    />
                    {errors.temp && <span className="field-error">{errors.temp}</span>}
                  </div>
                  <div className="field">
                    <label className="field-label">Resp. Rate <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: "12px" }}>/min</span></label>
                    <input
                      type="number" placeholder="e.g. 16" min="4" max="60"
                      value={form.rr} onChange={e => setField("rr", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Record date */}
            <div className="card" style={{ animation: "fadeInUp 0.4s ease 0.2s both" }}>
              <div className="field">
                <label className="field-label">Record Last Updated</label>
                <input type="date" value={form.last_updated} onChange={e => setField("last_updated", e.target.value)} />
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
              <button type="button" className="btn btn-secondary" onClick={handleReset}>Reset</button>
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
                  <div className="empty-subtitle">Fill in the patient record fields and click Validate Record to receive a quality score with detected issues.</div>
                </div>
              </div>
            )}
          </div>

        </div>
      </form>
    </div>
  );
}
