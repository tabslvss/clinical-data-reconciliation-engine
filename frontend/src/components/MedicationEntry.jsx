const UNITS = ["mg", "mcg", "g", "mEq", "mL", "units", "IU", "%", "mg/mL"];

function makeMed() {
  return { name: "", amount: "", unit: "mg" };
}

export { makeMed };

export default function MedicationEntry({ value = [], onChange, errors = [] }) {
  function update(i, field, val) {
    onChange(value.map((m, idx) => idx === i ? { ...m, [field]: val } : m));
  }
  function add() {
    onChange([...value, makeMed()]);
  }
  function remove(i) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {value.map((med, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 90px 80px 32px",
            gap: "8px",
            alignItems: "start",
            animation: "fadeInUp 0.2s ease both",
            animationDelay: `${i * 40}ms`,
          }}
        >
          {/* Drug name */}
          <div>
            <input
              type="text"
              placeholder="Drug name (e.g. Metformin)"
              value={med.name}
              onChange={e => update(i, "name", e.target.value)}
              className={errors[i]?.name ? "error" : ""}
              style={{ fontSize: "13.5px" }}
            />
            {errors[i]?.name && <span className="field-error">{errors[i].name}</span>}
          </div>

          {/* Amount */}
          <div>
            <input
              type="text"
              placeholder="500"
              value={med.amount}
              onChange={e => update(i, "amount", e.target.value)}
              className={errors[i]?.amount ? "error" : ""}
              style={{ fontSize: "13.5px" }}
            />
            {errors[i]?.amount && <span className="field-error">{errors[i].amount}</span>}
          </div>

          {/* Unit */}
          <select
            value={med.unit}
            onChange={e => update(i, "unit", e.target.value)}
            style={{ fontSize: "13.5px" }}
          >
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            <option value="other">other</option>
          </select>

          {/* Remove */}
          <button
            type="button"
            className="btn-icon danger"
            onClick={() => remove(i)}
            title="Remove medication"
            style={{ marginTop: "1px" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      ))}

      {/* Column headers (only when there are entries) */}
      {value.length > 0 && (
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 90px 80px 32px",
          gap: "8px", order: -1, marginBottom: "-2px",
        }}>
          <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", paddingLeft: "2px" }}>Drug Name</span>
          <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)" }}>Amount</span>
          <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)" }}>Unit</span>
          <span />
        </div>
      )}

      <button type="button" className="add-source-btn" onClick={add} style={{ marginTop: "4px" }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Add medication
      </button>
    </div>
  );
}
