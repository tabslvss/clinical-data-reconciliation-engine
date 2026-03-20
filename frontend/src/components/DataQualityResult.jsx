const DIMS = {
  completeness: "Completeness",
  accuracy: "Accuracy",
  timeliness: "Timeliness",
  clinical_plausibility: "Clinical Plausibility",
};

function scoreColor(s) {
  if (s >= 75) return "#16a34a";
  if (s >= 50) return "#d97706";
  return "#ef4444";
}

function ScoreRing({ score }) {
  const r = 38, stroke = 6;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = scoreColor(score);

  return (
    <svg width="96" height="96" style={{ flexShrink: 0, overflow: "visible" }}>
      <circle cx="48" cy="48" r={r} fill="none" stroke="var(--surface2)" strokeWidth={stroke} />
      <circle
        cx="48" cy="48" r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 48 48)"
        style={{ animation: "ringDraw 0.9s cubic-bezier(0.4,0,0.2,1) both" }}
      />
      <text x="48" y="44" textAnchor="middle" fill={color} fontSize="20" fontWeight="900" fontFamily="Inter,sans-serif">{score}</text>
      <text x="48" y="60" textAnchor="middle" fill="var(--text-muted)" fontSize="11" fontWeight="500" fontFamily="Inter,sans-serif">/100</text>
    </svg>
  );
}

const SEV_CLASS = { high: "badge-red", medium: "badge-yellow", low: "badge-gray" };

export default function DataQualityResult({ result }) {
  const color = scoreColor(result.overall_score);
  const label = result.overall_score >= 75 ? "Good Quality" : result.overall_score >= 50 ? "Needs Attention" : "Poor Quality";

  return (
    <div className="result-card" style={{ display: "flex", flexDirection: "column" }}>

      {/* Score header */}
      <div className="score-ring-wrap">
        <ScoreRing score={result.overall_score} />
        <div className="score-ring-text">
          <div className="score-ring-status" style={{ color }}>{label}</div>
          <div style={{ fontSize: "14px", color: "var(--text-secondary)" }}>Overall quality score</div>
          <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
            {result.issues_detected.length} issue{result.issues_detected.length !== 1 ? "s" : ""} detected
          </div>
        </div>
      </div>

      {/* Dimension breakdown */}
      <div className="section-label">Score Breakdown</div>
      <div className="dim-grid" style={{ marginBottom: "22px" }}>
        {Object.entries(result.breakdown).map(([key, val], i) => {
          const c = scoreColor(val);
          return (
            <div className="dim-card" key={key} style={{ animationDelay: `${i * 60}ms` }}>
              <div className="dim-label">{DIMS[key] || key}</div>
              <div className="dim-score" style={{ color: c }}>{val}</div>
              <div className="dim-bar">
                <div className="dim-bar-fill" style={{ width: `${val}%`, background: c, animationDelay: `${i * 80}ms` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Issues */}
      {result.issues_detected.length > 0 && (
        <>
          <div className="section-label">Issues Detected</div>
          <table className="issues-table" style={{ marginBottom: "16px" }}>
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
                  <td><span className="field-code">{issue.field}</span></td>
                  <td style={{ color: "var(--text-secondary)" }}>{issue.issue}</td>
                  <td><span className={`badge ${SEV_CLASS[issue.severity] || "badge-gray"}`}>{issue.severity}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* AI insights */}
      {result.ai_insights && (
        <div className="ai-insights">
          <span className="ai-insights-icon">✦</span>
          <span>{result.ai_insights}</span>
        </div>
      )}
    </div>
  );
}
