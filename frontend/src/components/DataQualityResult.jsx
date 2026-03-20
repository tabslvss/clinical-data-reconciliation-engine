import ScoreRing from "./ScoreRing";

const SEVERITY_TAG = {
  high: "tag-red",
  medium: "tag-yellow",
  low: "tag-blue",
};

const BREAKDOWN_LABELS = {
  completeness: "Completeness",
  accuracy: "Accuracy",
  timeliness: "Timeliness",
  clinical_plausibility: "Clinical Plausibility",
};

function scoreColor(s) {
  return s >= 75 ? "var(--green)" : s >= 50 ? "var(--yellow)" : "var(--red)";
}

export default function DataQualityResult({ result }) {
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <div className="card-title">Data Quality Report</div>

      {/* Overall score ring */}
      <div className="score-ring-wrap">
        <ScoreRing score={result.overall_score} />
        <div>
          <div style={{ fontSize: "15px", fontWeight: 700 }}>
            {result.overall_score >= 75 ? "Good quality" : result.overall_score >= 50 ? "Needs attention" : "Poor quality"}
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>
            {result.issues_detected.length} issue{result.issues_detected.length !== 1 ? "s" : ""} detected
          </div>
        </div>
      </div>

      {/* Breakdown grid */}
      <div className="breakdown-grid">
        {Object.entries(result.breakdown).map(([key, val]) => (
          <div className="breakdown-item" key={key}>
            <div className="breakdown-item-label">{BREAKDOWN_LABELS[key] || key}</div>
            <div className="breakdown-item-score" style={{ color: scoreColor(val) }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Issues table */}
      {result.issues_detected.length > 0 && (
        <div>
          <div className="label">Issues Detected</div>
          <table className="issues-table">
            <thead>
              <tr>
                <th>Field</th>
                <th>Issue</th>
                <th>Severity</th>
              </tr>
            </thead>
            <tbody>
              {result.issues_detected.map((issue, i) => (
                <tr key={i}>
                  <td style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>{issue.field}</td>
                  <td>{issue.issue}</td>
                  <td>
                    <span className={`tag ${SEVERITY_TAG[issue.severity] || "tag-blue"}`}>
                      {issue.severity}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* AI insights */}
      {result.ai_insights && (
        <div>
          <div className="label">AI Insights</div>
          <div className="reasoning-block">{result.ai_insights}</div>
        </div>
      )}
    </div>
  );
}
