import { useEffect, useState } from "react";
import { fetchAdminOverview } from "../api/admin";

function AdminOverview() {
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAdminOverview()
      .then((res) => setMetrics(res.data))
      .catch(() => setError("Failed to load overview metrics."));
  }, []);

  const cards = [
    { label: "Users", value: metrics?.users_count, icon: "👥" },
    { label: "Sellers", value: metrics?.sellers_count, icon: "🏪" },
    { label: "Open Disputes", value: metrics?.open_disputes_count, icon: "⚖️" },
    { label: "Pending Withdrawals", value: metrics?.pending_withdrawals_count, icon: "💸" },
    { label: "Risky Users", value: metrics?.risky_users_count, icon: "🚨" },
    { label: "Fraud Alerts", value: metrics?.fraud_alerts_count, icon: "🛡️" },
    { label: "Auto Resolved %", value: `${metrics?.auto_resolved_disputes_percent ?? 0}%`, icon: "🤖" },
  ];

  return (
    <div>
      <h2 className="admin-page-title">Admin Overview</h2>
      <p className="admin-page-subtitle">
        Moderate disputes, approve payouts, and manage user accounts.
      </p>
      {error && <div className="admin-error">{error}</div>}
      <div className="admin-metrics">
        {cards.map((c) => (
          <div key={c.label} className="admin-metric-card">
            <div className="admin-metric-icon">{c.icon}</div>
            <div>
              <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>{c.label}</p>
              <p className="admin-metric-value">{metrics ? c.value ?? 0 : "—"}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AdminOverview;
