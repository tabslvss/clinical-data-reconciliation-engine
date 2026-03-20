const COLORS = ["#16a34a","#2563eb","#7c3aed","#ea580c","#0891b2","#db2777"];

export default function SourceCard({ index, source, onChange, onRemove, canRemove, errors = {} }) {
  const color = COLORS[index % COLORS.length];

  function set(field, val) {
    onChange({ ...source, [field]: val });
  }

  return (
    <div className="source-card" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="source-card-header">
        <span className="source-badge">
          <span className="source-badge-dot" style={{ background: color }} />
          Source {index + 1}
        </span>
        {canRemove && (
          <button className="btn-icon danger" type="button" onClick={onRemove} title="Remove source">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
            </svg>
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {/* System name */}
        <div className="field">
          <label className="field-label">Source System</label>
          <input
            type="text"
            placeholder="e.g. Hospital EHR, Primary Care, Pharmacy"
            value={source.system}
            onChange={e => set("system", e.target.value)}
            className={errors.system ? "error" : ""}
          />
          {errors.system && <span className="field-error">{errors.system}</span>}
        </div>

        {/* Medication */}
        <div className="field">
          <label className="field-label">Medication &amp; Dose</label>
          <input
            type="text"
            placeholder="e.g. Metformin 500mg twice daily"
            value={source.medication}
            onChange={e => set("medication", e.target.value)}
            className={errors.medication ? "error" : ""}
          />
          {errors.medication && <span className="field-error">{errors.medication}</span>}
        </div>

        {/* Date + date type */}
        <div className="form-grid-2" style={{ alignItems: "end" }}>
          <div className="field">
            <label className="field-label">Date</label>
            <input
              type="date"
              value={source.date}
              onChange={e => set("date", e.target.value)}
              className={errors.date ? "error" : ""}
            />
            {errors.date && <span className="field-error">{errors.date}</span>}
          </div>
          <div className="field">
            <label className="field-label">Date Type</label>
            <div className="date-toggle">
              <button type="button" className={source.dateType === "last_updated" ? "active" : ""} onClick={() => set("dateType", "last_updated")}>Updated</button>
              <button type="button" className={source.dateType === "last_filled" ? "active" : ""} onClick={() => set("dateType", "last_filled")}>Filled</button>
            </div>
          </div>
        </div>

        {/* Reliability */}
        <div className="field">
          <label className="field-label">Source Reliability</label>
          <div className="reliability-group">
            {["high", "medium", "low"].map(r => (
              <div className="reliability-opt" key={r}>
                <input
                  type="radio"
                  id={`rel-${index}-${r}`}
                  name={`reliability-${index}`}
                  value={r}
                  checked={source.source_reliability === r}
                  onChange={() => set("source_reliability", r)}
                />
                <label htmlFor={`rel-${index}-${r}`}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
