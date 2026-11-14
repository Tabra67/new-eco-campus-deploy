import TrustInline from "../TrustBadge";

function Stat({ label, value }) {
  return (
    <div style={{ padding: "12px 14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10 }}>
      <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>{value}</div>
    </div>
  );
}

export default function TrustDetailModal({ open, onClose, title, trust, role, loading }) {
  if (!open) return null;

  const isSeller = role === "seller";
  const score = trust ? Number(trust.trust_score || 0).toFixed(0) : "—";
  const memberSince = trust?.member_since
    ? new Date(trust.member_since).toLocaleDateString()
    : "—";

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 4000
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          maxHeight: "90vh",
          overflowY: "auto",
          background: "#fff",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 24px 48px rgba(15, 23, 42, 0.2)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <h2 style={{ margin: 0, color: "#0f172a" }}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            style={{ border: "none", background: "none", fontSize: 22, cursor: "pointer", color: "#64748b" }}
          >
            ×
          </button>
        </div>

        {loading && <p style={{ color: "#64748b" }}>Loading trust information…</p>}

        {!loading && trust && (
          <>
            <div style={{ marginBottom: 16 }}>
              <TrustInline trust={trust} />
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                gap: 10,
                marginBottom: 16
              }}
            >
              <Stat label="Trust Score" value={score} />
              <Stat label="Risk Level" value={trust.risk_level || "—"} />
              {isSeller ? (
                <>
                  <Stat label="Completed Sales" value={trust.completed_sales ?? 0} />
                  <Stat label="Reviews" value={trust.total_reviews ?? 0} />
                  <Stat label="Avg Rating" value={trust.average_rating ?? "—"} />
                  <Stat label="Response Rate" value={`${trust.response_rate ?? 0}%`} />
                  <Stat label="Dispute Rate" value={`${trust.dispute_rate ?? 0}%`} />
                </>
              ) : (
                <>
                  <Stat label="Orders Completed" value={trust.completed_orders ?? 0} />
                  <Stat label="Successful Payments" value={trust.successful_transactions ?? 0} />
                  <Stat label="Disputes Opened" value={trust.disputes_opened ?? 0} />
                  <Stat label="Disputes Won" value={trust.disputes_won ?? 0} />
                  <Stat label="Disputes Lost" value={trust.disputes_lost ?? 0} />
                </>
              )}
              <Stat label="Member Since" value={memberSince} />
            </div>
            {trust.badges?.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {trust.badges.map((b) => (
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
            )}
            {isSeller && trust.recent_reviews?.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <h4 style={{ margin: "0 0 10px", color: "#0f172a" }}>Recent Reviews</h4>
                <div style={{ display: "grid", gap: 8 }}>
                  {trust.recent_reviews.map((review) => (
                    <div key={review.id} style={{ padding: 10, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                      <div style={{ fontWeight: 700, color: "#f59e0b" }}>
                        {"★".repeat(Math.min(5, Number(review.rating || 0)))} {review.buyer_username}
                      </div>
                      <p style={{ margin: "6px 0 0", fontSize: "0.9rem", color: "#334155" }}>{review.review_text || "No comment."}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {!loading && !trust && <p style={{ color: "#64748b" }}>Trust information unavailable.</p>}
      </div>
    </div>
  );
}
