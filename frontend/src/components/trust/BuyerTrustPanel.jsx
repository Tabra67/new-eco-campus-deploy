import { useEffect, useState } from "react";
import { fetchMyTrustProfile } from "../../api/trust";
import TrustInline from "../TrustBadge";

function Stat({ label, value }) {
  return (
    <div style={{ padding: 16, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12 }}>
      <div style={{ fontSize: "0.8rem", color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", marginTop: 4 }}>{value}</div>
    </div>
  );
}

function DisputeHistoryTable({ rows }) {
  if (!rows?.length) {
    return <p style={{ color: "#64748b", margin: 0 }}>No disputes on record.</p>;
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
        <thead>
          <tr style={{ background: "#f8fafc", textAlign: "left" }}>
            <th style={{ padding: 10, borderBottom: "1px solid #e2e8f0" }}>Dispute ID</th>
            <th style={{ padding: 10, borderBottom: "1px solid #e2e8f0" }}>Order</th>
            <th style={{ padding: 10, borderBottom: "1px solid #e2e8f0" }}>Reason</th>
            <th style={{ padding: 10, borderBottom: "1px solid #e2e8f0" }}>Status</th>
            <th style={{ padding: 10, borderBottom: "1px solid #e2e8f0" }}>Opened</th>
            <th style={{ padding: 10, borderBottom: "1px solid #e2e8f0" }}>Outcome</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.dispute_id}>
              <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>#{d.dispute_id}</td>
              <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>#{d.order_id}</td>
              <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{d.reason}</td>
              <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{d.status}</td>
              <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>
                {d.date_opened ? new Date(d.date_opened).toLocaleDateString() : "—"}
              </td>
              <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{d.outcome || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function BuyerTrustPanel() {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    fetchMyTrustProfile().then((res) => setProfile(res.data));
  }, []);

  if (!profile) {
    return <p style={{ color: "#64748b" }}>Loading trust profile…</p>;
  }

  const score = Number(profile.trust_score || 0).toFixed(0);

  return (
    <div>
      <h1 style={{ margin: "0 0 6px", color: "#0f172a" }}>Trust Profile</h1>
      <p style={{ color: "#64748b", marginBottom: 20 }}>Your marketplace reputation and dispute history.</p>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 24, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "#15803d" }}>{score}</div>
            <div style={{ color: "#64748b" }}>Trust Score</div>
          </div>
          <div>
            <TrustInline trust={profile} />
          </div>
        </div>
        <div style={{ marginTop: 16, height: 8, background: "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ width: `${Math.min(100, score)}%`, height: "100%", background: "#16a34a" }} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        <Stat label="Orders Completed" value={profile.completed_orders ?? 0} />
        <Stat label="Successful Payments" value={profile.successful_transactions ?? 0} />
        <Stat label="Disputes Won" value={profile.disputes_won ?? 0} />
        <Stat label="Disputes Lost" value={profile.disputes_lost ?? 0} />
        <Stat label="Open Disputes" value={profile.open_disputes ?? 0} />
        <Stat label="Risk Level" value={profile.risk_level || "—"} />
        <Stat
          label="Member Since"
          value={profile.member_since ? new Date(profile.member_since).toLocaleDateString() : "—"}
        />
      </div>

      {profile.badges?.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ color: "#0f172a" }}>Trust Badges</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {profile.badges.map((b) => (
              <span
                key={b}
                style={{
                  padding: "6px 12px",
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: 8,
                  fontSize: "0.85rem"
                }}
              >
                {b}
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 20 }}>
        <h3 style={{ margin: "0 0 12px", color: "#0f172a" }}>Recent Dispute History</h3>
        <DisputeHistoryTable rows={profile.dispute_history} />
      </div>
    </div>
  );
}
