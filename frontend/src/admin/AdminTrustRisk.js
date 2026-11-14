import { useEffect, useState } from "react";
import { fetchAdminTrustDashboard, fetchAdminFlaggedUsers } from "../api/trust";

export default function AdminTrustRisk() {
  const [metrics, setMetrics] = useState(null);
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");

  const load = () => {
    fetchAdminTrustDashboard()
      .then((res) => setMetrics(res.data))
      .catch(() => setError("Failed to load trust metrics."));
    fetchAdminFlaggedUsers(filter)
      .then((res) => setUsers(res.data || []))
      .catch(() => setError("Failed to load users."));
  };

  useEffect(() => {
    load();
  }, [filter]);

  return (
    <div>
      <h2 className="admin-page-title">Trust & Risk Management</h2>
      <p className="admin-page-subtitle">Monitor platform trust scores, review sentiment, and flagged accounts.</p>
      {error && <div className="admin-error">{error}</div>}

      {metrics && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
          <div className="admin-card" style={{ padding: 16 }}>
            <div style={{ color: "#64748b", fontSize: "0.85rem" }}>Trusted Users</div>
            <div style={{ fontSize: "1.8rem", fontWeight: 800 }}>{metrics.total_trusted_users}</div>
          </div>
          <div className="admin-card" style={{ padding: 16 }}>
            <div style={{ color: "#64748b", fontSize: "0.85rem" }}>Watchlist</div>
            <div style={{ fontSize: "1.8rem", fontWeight: 800 }}>{metrics.watchlist_users}</div>
          </div>
          <div className="admin-card" style={{ padding: 16 }}>
            <div style={{ color: "#64748b", fontSize: "0.85rem" }}>High Risk</div>
            <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#b91c1c" }}>{metrics.high_risk_users}</div>
          </div>
          <div className="admin-card" style={{ padding: 16 }}>
            <div style={{ color: "#64748b", fontSize: "0.85rem" }}>Average Rating</div>
            <div style={{ fontSize: "1.8rem", fontWeight: 800 }}>{metrics.average_rating ?? "—"}</div>
          </div>
          <div className="admin-card" style={{ padding: 16 }}>
            <div style={{ color: "#64748b", fontSize: "0.85rem" }}>Total Reviews</div>
            <div style={{ fontSize: "1.8rem", fontWeight: 800 }}>{metrics.total_reviews ?? 0}</div>
          </div>
          <div className="admin-card" style={{ padding: 16 }}>
            <div style={{ color: "#64748b", fontSize: "0.85rem" }}>Review Sentiment Impact</div>
            <div style={{ fontSize: "1.8rem", fontWeight: 800 }}>{metrics.review_sentiment_impact ?? 0}</div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["all", "trusted", "good", "watchlist", "high_risk", "repeat"].map((f) => (
          <button
            key={f}
            type="button"
            className={`admin-btn ${filter === f ? "admin-btn-primary" : "admin-btn-muted"}`}
            onClick={() => setFilter(f)}
          >
            {f.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="admin-card" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
              <th style={{ padding: 10 }}>User</th>
              <th>Role</th>
              <th>Trust Score</th>
              <th>Avg Rating</th>
              <th>Reviews</th>
              <th>Sentiment</th>
              <th>Risk Level</th>
              <th>Disputes Won</th>
              <th>Disputes Lost</th>
              <th>Transactions</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.user_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: 10 }}>{u.user}</td>
                <td>{u.role}</td>
                <td>{u.trust_score}</td>
                <td>{u.average_rating ?? "—"}</td>
                <td>{u.total_reviews ?? 0}</td>
                <td>{u.review_sentiment_impact ?? 0}</td>
                <td>{u.risk_level}</td>
                <td>{u.disputes_won ?? 0}</td>
                <td>{u.disputes_lost ?? 0}</td>
                <td>{u.transactions}</td>
                <td>
                  {u.repeat_offender ? (
                    <span style={{ color: "#b91c1c", fontWeight: 700 }}>REPEAT OFFENDER</span>
                  ) : (
                    u.status
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!users.length && <p style={{ padding: 16 }}>No users in this filter.</p>}
      </div>
    </div>
  );
}
