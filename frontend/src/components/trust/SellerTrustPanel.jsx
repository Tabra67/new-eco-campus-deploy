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

export default function SellerTrustPanel() {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    fetchMyTrustProfile().then((res) => setProfile(res.data));
  }, []);

  if (!profile) {
    return <p style={{ color: "#64748b" }}>Loading trust center…</p>;
  }

  const score = Number(profile.trust_score || 0).toFixed(0);
  const disputes = profile.dispute_history || [];

  return (
    <div>
      <h1 style={{ margin: "0 0 6px", color: "#0f172a" }}>Trust Center</h1>
      <p style={{ color: "#64748b", marginBottom: 20 }}>Build buyer confidence with a strong trust score.</p>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 24, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "#15803d" }}>{score}</div>
            <div style={{ color: "#64748b" }}>Trust Score</div>
          </div>
          <TrustInline trust={profile} />
        </div>
        <div style={{ marginTop: 16, height: 10, background: "#e2e8f0", borderRadius: 6, overflow: "hidden" }}>
          <div
            style={{
              width: `${Math.min(100, score)}%`,
              height: "100%",
              background: "linear-gradient(90deg, #16a34a, #22c55e)"
            }}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        <Stat label="Average Rating" value={profile.average_rating ?? "—"} />
        <Stat label="Total Reviews" value={profile.total_reviews ?? 0} />
        <Stat label="Completed Sales" value={profile.completed_sales ?? 0} />
        <Stat label="Response Rate" value={`${profile.response_rate ?? 0}%`} />
        <Stat label="Dispute Rate" value={`${profile.dispute_rate ?? 0}%`} />
        <Stat
          label="Member Since"
          value={profile.member_since ? new Date(profile.member_since).toLocaleDateString() : "—"}
        />
      </div>

      {profile.repeat_offender && (
        <div
          style={{
            marginBottom: 20,
            padding: 12,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            color: "#991b1b"
          }}
        >
          Your account is flagged as a repeat offender due to frequent disputes.
        </div>
      )}

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 20 }}>
        <h3 style={{ margin: "0 0 12px", color: "#0f172a" }}>Dispute History</h3>
        {disputes.length === 0 ? (
          <p style={{ color: "#64748b", margin: 0 }}>No disputes involving your store.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                  <th style={{ padding: 10, borderBottom: "1px solid #e2e8f0" }}>Order</th>
                  <th style={{ padding: 10, borderBottom: "1px solid #e2e8f0" }}>Reason</th>
                  <th style={{ padding: 10, borderBottom: "1px solid #e2e8f0" }}>Status</th>
                  <th style={{ padding: 10, borderBottom: "1px solid #e2e8f0" }}>Resolution</th>
                  <th style={{ padding: 10, borderBottom: "1px solid #e2e8f0" }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {disputes.map((d) => (
                  <tr key={d.dispute_id}>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>#{d.order_id}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{d.reason}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{d.status}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>
                      {d.resolution || d.outcome || "—"}
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>
                      {d.date_opened ? new Date(d.date_opened).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
