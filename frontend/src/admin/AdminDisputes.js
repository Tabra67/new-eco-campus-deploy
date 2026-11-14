import { useEffect, useState } from "react";
import { disputeAdminAction, fetchAdminDisputes } from "../api/admin";
import TrustInline from "../components/TrustBadge";
import { formatKsh } from "../utils/currency";
import { formatDisputeDecision, getAdminComment } from "../utils/disputeLabels";

function EvidencePreview({ evidence = [] }) {
  if (!evidence.length) return null;

  return (
    <div style={{ marginTop: 12 }}>
      <strong style={{ fontSize: "0.85rem", display: "block", marginBottom: 8 }}>Evidence</strong>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {evidence.map((ev) => {
          const type = String(ev.type || "").toLowerCase();
          const isImage = type === "image" || /\.(jpg|jpeg|png|gif|webp)$/i.test(ev.url || "");
          const isPdf = type === "pdf" || /\.pdf$/i.test(ev.url || "");

          if (isImage) {
            return (
              <a key={ev.id || ev.url} href={ev.url} target="_blank" rel="noreferrer" style={{ display: "block" }}>
                <img
                  src={ev.url}
                  alt={ev.name || "Evidence"}
                  style={{ width: 120, height: 90, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0" }}
                />
              </a>
            );
          }

          return (
            <a
              key={ev.id || ev.url}
              href={ev.url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 12px",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                fontSize: "0.85rem",
                color: "#0f172a",
                textDecoration: "none"
              }}
            >
              {isPdf ? "📄 PDF" : "📎 Document"} — {ev.name || "View file"}
            </a>
          );
        })}
      </div>
    </div>
  );
}

function AdminDisputes() {
  const [disputes, setDisputes] = useState([]);
  const [notes, setNotes] = useState({});
  const [error, setError] = useState("");

  const load = () => {
    fetchAdminDisputes()
      .then((res) => setDisputes(res.data))
      .catch(() => setError("Failed to load disputes."));
  };

  useEffect(() => {
    load();
  }, []);

  const runAction = async (id, action) => {
    try {
      await disputeAdminAction(id, action, notes[id] || "");
      load();
    } catch (e) {
      setError(e.response?.data?.error || "Action failed.");
    }
  };

  const isResolved = (status) =>
    ["REFUNDED", "RELEASED", "REJECTED", "RESOLVED", "CLOSED", "AUTO_RESOLVED"].includes(status);

  return (
    <div>
      <h2 className="admin-page-title">Disputes</h2>
      <p className="admin-page-subtitle">Review and resolve buyer disputes.</p>
      {error && <div className="admin-error">{error}</div>}

      {disputes.map((d) => {
        const decisionLabel = formatDisputeDecision(d) || formatDisputeDecision({ admin_decision: d.admin_decision, status: d.status });
        const adminComment = getAdminComment(d);

        return (
        <div key={d.id} className="admin-card" style={{ marginBottom: 20, padding: 0, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 280px", gap: 0 }}>
            <div style={{ padding: 20, borderRight: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600, marginBottom: 6 }}>
                SECURE ESCROW
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <h3 style={{ margin: 0 }}>{d.title || d.reason || "Dispute"}</h3>
                <span className={`badge ${d.status === "OPEN" || d.status === "UNDER_REVIEW" ? "badge-open" : "badge-approved"}`}>
                  {d.status}
                </span>
              </div>

              <div className="admin-dispute-meta" style={{ marginTop: 12 }}>
                <span>Order #{d.order_id}</span>
                <span>{d.product_title}</span>
                <span>{formatKsh(d.amount)}</span>
                <span>Buyer: {d.buyer_username}</span>
                <span>Seller: {d.seller_username}</span>
              </div>

              {(d.buyer_trust || d.seller_trust) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16, margin: "12px 0", paddingBottom: 12, borderBottom: "1px dashed #e2e8f0" }}>
                  {d.buyer_trust && (
                    <div>
                      <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Buyer trust</div>
                      <TrustInline trust={d.buyer_trust} compact />
                    </div>
                  )}
                  {d.seller_trust && (
                    <div>
                      <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Seller trust</div>
                      <TrustInline trust={d.seller_trust} compact />
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginTop: 12, padding: 12, background: "#f8fafc", borderRadius: 8 }}>
                <strong>Product:</strong> {d.product_title}
              </div>

              <p style={{ color: "#334155", marginTop: 12 }}>{d.description}</p>

              <EvidencePreview evidence={d.evidence} />

              {!isResolved(d.status) && (
                <>
                  <input
                    className="admin-resolution-input"
                    placeholder="Admin comment / resolution note"
                    value={notes[d.id] || ""}
                    onChange={(e) => setNotes({ ...notes, [d.id]: e.target.value })}
                    style={{ marginTop: 14 }}
                  />
                  <div style={{ marginTop: 10 }}>
                    <button type="button" className="admin-btn admin-btn-muted" onClick={() => runAction(d.id, "under_review")}>
                      Mark under review
                    </button>
                    <button type="button" className="admin-btn admin-btn-primary" onClick={() => runAction(d.id, "refund_buyer")}>
                      Refund buyer
                    </button>
                    <button type="button" className="admin-btn admin-btn-success" onClick={() => runAction(d.id, "release_seller")}>
                      Release to seller
                    </button>
                    <button type="button" className="admin-btn admin-btn-danger" onClick={() => runAction(d.id, "reject")}>
                      Reject dispute
                    </button>
                  </div>
                </>
              )}
            </div>

            <div style={{ padding: 20, background: "#f8fafc" }}>
              <h4 style={{ margin: "0 0 12px", fontSize: "0.85rem", color: "#64748b" }}>ADMIN OUTCOME</h4>
              {decisionLabel ? (
                <>
                  <p style={{ margin: "0 0 4px", fontSize: "0.75rem", color: "#94a3b8" }}>Decision</p>
                  <p style={{ margin: "0 0 12px", fontWeight: 700, color: "#0f172a" }}>{decisionLabel}</p>
                </>
              ) : (
                <p style={{ margin: "0 0 12px", fontWeight: 700, color: "#0f172a" }}>Pending Review</p>
              )}
              {adminComment && (
                <>
                  <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: "0 0 4px" }}>Admin Comment</p>
                  <p style={{ fontSize: "0.85rem", color: "#334155" }}>{adminComment}</p>
                </>
              )}
            </div>
          </div>
        </div>
      )})}
      {!disputes.length && <p>No disputes found.</p>}
    </div>
  );
}

export default AdminDisputes;
