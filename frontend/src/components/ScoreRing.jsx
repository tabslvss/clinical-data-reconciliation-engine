export default function ScoreRing({ score, label }) {
  const color =
    score >= 75 ? "var(--green)" : score >= 50 ? "var(--yellow)" : "var(--red)";
  return (
    <div className="score-ring" style={{ borderColor: color, color }}>
      <span className="score-ring-num">{score}</span>
      <span className="score-ring-label">{label || "/100"}</span>
    </div>
  );
}
