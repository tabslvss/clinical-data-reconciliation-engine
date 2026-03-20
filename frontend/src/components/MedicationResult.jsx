import { useState } from "react";

function ChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
  );
}

function confidenceColor(pct) {
  if (pct >= 75) return "#16a34a";
  if (pct >= 50) return "#d97706";
  return "#ef4444";
}

export default function MedicationResult({ result }) {
  const [decision, setDecision] = useState(null);
  const [conflictOpen, setConflictOpen] = useState(false);

  const pct = Math.round(result.confidence_score * 100);
  const color = confidenceColor(pct);
  const isPassed = result.clinical_safety_check === "PASSED";

  const sources = result.conflict_summary
    ? result.conflict_summary.split("\n").map(line => {
        const m = line.match(/^- (.+?):\s+(.+?)\s+\(reliability:\s+(\w+)\)/);
        return m ? { system: m[1], medication: m[2], reliability: m[3] } : null;
      }).filter(Boolean)
    : [];

  return (
    <div className="result-card" style={{ display: "flex", flexDirection: "column", gap: "0" }}>

      {/* Header */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-muted)", marginBottom: "8px" }}>
          Reconciled Medication
        </div>
        <div className="reconciled-med-name">{result.reconciled_medication}</div>
        <div className="result-badges">
          <span className="badge badge-gray">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12 14 14"/></svg>
            {result.source_used}
          </span>
          <span className={`badge ${isPassed ? "badge-green" : "badge-yellow"}`}>
            {isPassed ? "✓ Safety Passed" : "⚠ Safety Warning"}
          </span>
        </div>
      </div>

      {/* Confidence */}
      <div className="conf-wrap">
        <div className="conf-header">
          <span className="conf-label">Confidence Score</span>
          <span className="conf-value" style={{ color }}>{pct}%</span>
        </div>
        <div className="conf-track">
          <div className="conf-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}99, ${color})` }} />
        </div>
      </div>

      <hr className="divider" />

      {/* Reasoning */}
      <div style={{ marginBottom: "18px" }}>
        <div className="section-label">Clinical Reasoning</div>
        <div className="reasoning-block">{result.reasoning}</div>
      </div>

      {/* Actions */}
      {result.recommended_actions?.length > 0 && (
        <div style={{ marginBottom: "18px" }}>
          <div className="section-label">Recommended Actions</div>
          <ul className="actions-list">
            {result.recommended_actions.map((a, i) => (
              <li key={i} style={{ animationDelay: `${i * 80}ms` }}>
                <span className="action-arrow">→</span>
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Conflict summary collapsible */}
      {sources.length > 0 && (
        <div style={{ marginBottom: "18px" }}>
          <button
            type="button"
            className={`conflict-toggle${conflictOpen ? " open" : ""}`}
            onClick={() => setConflictOpen(v => !v)}
          >
            <ChevronDown />
            {conflictOpen ? "Hide" : "Show"} all {sources.length} conflicting sources
          </button>
          <div className="conflict-body" style={{ maxHeight: conflictOpen ? `${sources.length * 56}px` : "0px" }}>
            <div style={{ paddingTop: "10px" }}>
              {sources.map((s, i) => (
                <div key={i} className="conflict-source-row">
                  <span className="conflict-system">{s.system}</span>
                  <span className="conflict-med">{s.medication}</span>
                  <span className={`badge ${s.reliability === "high" ? "badge-green" : s.reliability === "medium" ? "badge-yellow" : "badge-gray"}`} style={{ fontSize: "11px" }}>
                    {s.reliability}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <hr className="divider" />

      {/* Clinician decision */}
      <div className="decision-wrap">
        {!decision ? (
          <>
            <div className="decision-label">Clinician Decision</div>
            <div className="btn-row">
              <button className="btn btn-success" onClick={() => setDecision("approved")} style={{ flex: 1 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                Approve Suggestion
              </button>
              <button className="btn btn-secondary" onClick={() => setDecision("rejected")} style={{ flex: 1, borderColor: "var(--red-border)", color: "var(--red)" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                Reject &amp; Override
              </button>
            </div>
          </>
        ) : (
          <div className={`decision-banner ${decision === "approved" ? "decision-approved" : "decision-rejected"}`}>
            {decision === "approved"
              ? "✓ Approved — reconciliation accepted by clinician"
              : "✗ Rejected — AI suggestion overridden by clinician"}
          </div>
        )}
      </div>
    </div>
  );
}
