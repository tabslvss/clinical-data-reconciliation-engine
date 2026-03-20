import { useState } from "react";
import ConfidenceBar from "./ConfidenceBar";

export default function MedicationResult({ result }) {
  const [decision, setDecision] = useState(null);

  const safetyClass =
    result.clinical_safety_check === "PASSED" ? "safety-passed" : "safety-warning";
  const safetyIcon = result.clinical_safety_check === "PASSED" ? "✓" : "⚠";

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <div className="card-title">Reconciliation Result</div>

      {/* Main medication */}
      <div>
        <div className="label">Reconciled Medication</div>
        <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--accent)", marginBottom: "6px" }}>
          {result.reconciled_medication}
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <span className="source-pill best">✓ {result.source_used}</span>
          <span className={`safety-badge ${safetyClass}`}>
            {safetyIcon} {result.clinical_safety_check}
          </span>
        </div>
      </div>

      {/* Confidence */}
      <ConfidenceBar score={result.confidence_score} />

      {/* Reasoning */}
      <div>
        <div className="label">Clinical Reasoning</div>
        <div className="reasoning-block">{result.reasoning}</div>
      </div>

      {/* Recommended actions */}
      {result.recommended_actions?.length > 0 && (
        <div>
          <div className="label">Recommended Actions</div>
          <ul className="action-list">
            {result.recommended_actions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Conflict summary */}
      {result.conflict_summary && (
        <div>
          <div className="label">Conflicting Sources</div>
          <pre style={{
            background: "var(--surface2)",
            borderRadius: "8px",
            padding: "12px",
            fontSize: "12px",
            color: "var(--text-muted)",
            overflowX: "auto",
            whiteSpace: "pre-wrap",
          }}>
            {result.conflict_summary}
          </pre>
        </div>
      )}

      <hr className="divider" />

      {/* Approve / Reject */}
      {!decision ? (
        <div>
          <div className="label" style={{ marginBottom: "10px" }}>Clinician Decision</div>
          <div className="btn-row">
            <button className="btn-success" onClick={() => setDecision("approved")}>
              ✓ Approve Suggestion
            </button>
            <button className="btn-danger" onClick={() => setDecision("rejected")}>
              ✗ Reject & Override
            </button>
          </div>
        </div>
      ) : (
        <div className={`approval-banner ${decision === "approved" ? "approval-approved" : "approval-rejected"}`}>
          {decision === "approved"
            ? "✓ Approved — Reconciliation accepted by clinician"
            : "✗ Rejected — AI suggestion overridden by clinician"}
        </div>
      )}
    </div>
  );
}
