export default function ConfidenceBar({ score }) {
  const pct = Math.round(score * 100);
  const color = pct >= 75 ? "var(--green)" : pct >= 50 ? "var(--yellow)" : "var(--red)";
  return (
    <div className="conf-bar-wrap">
      <div className="conf-bar-label">
        <span>Confidence</span>
        <span style={{ color, fontWeight: 700 }}>{pct}%</span>
      </div>
      <div className="conf-bar-track">
        <div className="conf-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
