import "./TrustBadge.css";

export function TrustInline({ trust, compact }) {
  if (!trust) return null;
  const score = Number(trust.trust_score || 0).toFixed(0);
  const risk = trust.risk_level || "GOOD";
  return (
    <div className={`trust-badge ${compact ? "trust-badge-compact" : ""}`}>
      {trust.trust_badge && <span>{trust.trust_badge}</span>}
      <span className="trust-badge-score">Trust {score}</span>
      <span className={`trust-badge-risk ${risk}`}>{risk.replace("_", " ")}</span>
      {trust.repeat_offender && <span className="trust-offender">REPEAT OFFENDER</span>}
    </div>
  );
}

export default TrustInline;
