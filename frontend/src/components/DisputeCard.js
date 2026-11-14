import { Link } from "react-router-dom";
import TrustInline from "./TrustBadge";
import "./DisputeCard.css";
import { formatKsh } from "../utils/currency";
import { formatDisputeDecision, getAdminComment } from "../utils/disputeLabels";

function statusClass(status) {
  const s = (status || "OPEN").toUpperCase();
  if (["OPEN", "AWAITING_SELLER_RESPONSE"].includes(s)) return "open";
  if (s === "UNDER_REVIEW") return "UNDER_REVIEW";
  if (s === "ESCALATED") return "ESCALATED";
  return "RESOLVED";
}

export default function DisputeCard({ dispute, view = "buyer", detailLink }) {
  const reason = dispute.reason || dispute.title || "Dispute";
  const status = dispute.status || "OPEN";
  const amount = dispute.amount ?? dispute.order?.price;
  const orderId = dispute.order_id || dispute.order?.id || dispute.order;
  const decisionLabel = formatDisputeDecision(dispute);
  const adminComment = getAdminComment(dispute);

  return (
    <div className="dispute-card">
      <div className="dispute-card-header">
        <h3 className="dispute-card-title">{reason}</h3>
        <span className={`dispute-status-badge ${statusClass(status)}`}>{status.replace(/_/g, " ")}</span>
      </div>

      {(dispute.buyer_trust || dispute.seller_trust) && (
        <div className="dispute-trust-row">
          {dispute.buyer_trust && (
            <div>
              <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginBottom: 4 }}>Buyer</div>
              <TrustInline trust={dispute.buyer_trust} compact />
            </div>
          )}
          {dispute.seller_trust && (
            <div>
              <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginBottom: 4 }}>Seller</div>
              <TrustInline trust={dispute.seller_trust} compact />
            </div>
          )}
        </div>
      )}

      <div className="dispute-meta-row">
        <span>Order #{orderId}</span>
        {view === "buyer" && <span>Seller: {dispute.seller_username || "—"}</span>}
        {view === "seller" && <span>Buyer: {dispute.buyer_username || "—"}</span>}
        {amount != null && <span>Amount: {formatKsh(amount)}</span>}
        {dispute.response_deadline && (
          <span>Deadline: {new Date(dispute.response_deadline).toLocaleString()}</span>
        )}
      </div>

      <p className="dispute-description">
        {dispute.detailed_description || dispute.description || "—"}
      </p>

      {(dispute.evidence_urls?.length > 0 || dispute.evidence?.length > 0) && (
        <div className="dispute-evidence-links">
          {(dispute.evidence_urls || dispute.evidence || []).map((ev, i) => (
            <a key={ev.id || i} href={ev.url} target="_blank" rel="noreferrer">
              Evidence {i + 1}
            </a>
          ))}
        </div>
      )}

      {decisionLabel && (
        <div className="dispute-admin-decision">
          <h4 style={{ margin: "0 0 6px", fontSize: "0.85rem", color: "#64748b" }}>Decision</h4>
          <p style={{ margin: "0 0 8px", fontWeight: 700, color: "#0f172a" }}>{decisionLabel}</p>
          {adminComment && (
            <>
              <h4 style={{ margin: "0 0 4px", fontSize: "0.85rem", color: "#64748b" }}>Admin Comment</h4>
              <p style={{ margin: 0, fontSize: "0.9rem", color: "#334155" }}>{adminComment}</p>
            </>
          )}
        </div>
      )}

      {detailLink && (
        <Link
          to={detailLink}
          style={{
            display: "inline-block",
            marginTop: 12,
            padding: "8px 14px",
            background: "#1e293b",
            color: "#fff",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: "0.85rem",
          }}
        >
          View Dispute
        </Link>
      )}
    </div>
  );
}
