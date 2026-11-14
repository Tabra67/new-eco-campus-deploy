import TrustInline from "./TrustBadge";
import "./PaymentFormCard.css";
import { formatKsh } from "../utils/currency";

export default function PaymentFormCard({
  order,
  phone,
  onPhoneChange,
  onSubmit,
  onClose,
  onBack,
  submitting,
  phase,
  sellerTrust,
  backLabel = "← Back to Orders",
  extraMessage = "",
}) {
  if (!order) return null;

  const subtotal = Number(order.productPrice || order.price || 0);
  const discount = Number(order.discountAmount || 0);
  const escrowFee = Number(order.escrowFee || 0);
  const total = Number(order.totalAmount || subtotal - discount + escrowFee);

  const payLabel =
    phase === "initiating"
      ? "Starting M-Pesa…"
      : phase === "waiting"
      ? "Waiting for PIN…"
      : submitting
      ? "Processing..."
      : `Pay ${formatKsh(total)} now`;

  return (
    <div className="payment-form-overlay" onClick={onClose}>
      <div className="payment-form-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="payment-back-link" onClick={onBack || onClose}>
          {backLabel}
        </button>

        <div className="payment-secure-header">
          <span aria-hidden>🔒</span>
          <span>Secure escrow payment</span>
        </div>
        <h2>Complete payment</h2>
        <p className="payment-helper">
          Funds will be held in escrow and released to the seller only after you confirm delivery.
        </p>

        {sellerTrust && (
          <div className="payment-trust-strip">
            <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: 4 }}>Seller trust</div>
            <TrustInline trust={sellerTrust} />
          </div>
        )}

        <div className="payment-summary-card">
          <div className="payment-summary-left">
            {order.productImage ? (
              <img src={order.productImage} alt="" className="payment-product-img" />
            ) : (
              <div className="payment-product-img" />
            )}
            <div>
              <div style={{ fontWeight: 700, color: "#0f172a" }}>{order.productName}</div>
              <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: 4 }}>
                {order.sellerName || "Seller"}
              </div>
            </div>
          </div>
          <div style={{ fontWeight: 800, color: "#0f172a", alignSelf: "center" }}>{formatKsh(subtotal)}</div>
        </div>

        <div className="payment-breakdown">
          <div className="payment-breakdown-row">
            <span>Subtotal</span>
            <span>{formatKsh(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="payment-breakdown-row">
              <span>First-order discount</span>
              <span>- {formatKsh(discount)}</span>
            </div>
          )}
          <div className="payment-breakdown-row">
            <span>Escrow Fee</span>
            <span>{formatKsh(escrowFee)}</span>
          </div>
          <div className="payment-breakdown-divider" />
          <div className="payment-breakdown-total">
            <span>Total</span>
            <span>{formatKsh(total)}</span>
          </div>
        </div>

        {phase === "waiting" && (
          <p style={{ color: "#1e40af", fontWeight: 600, marginBottom: 12 }}>
            STK Push sent — enter your M-Pesa PIN on your phone.
          </p>
        )}
        {phase === "success" && (
          <p style={{ color: "#166534", fontWeight: 600, marginBottom: 12 }}>
            Payment successful. Escrow funded.
          </p>
        )}
        {extraMessage && (
          <p style={{ color: "#1e40af", fontWeight: 600, marginBottom: 12 }}>
            {extraMessage}
          </p>
        )}

        <label style={{ display: "block", marginBottom: 8, fontWeight: 600, fontSize: "0.9rem" }}>
          M-Pesa phone number
        </label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          placeholder="e.g. 07XXXXXXXX"
          disabled={phase === "waiting" || phase === "initiating"}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            marginBottom: 14,
            boxSizing: "border-box",
          }}
        />

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: "0 0 auto",
              padding: "12px 16px",
              border: "1px solid #cbd5e1",
              borderRadius: 10,
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="payment-pay-btn"
            style={{ flex: 1 }}
            onClick={onSubmit}
            disabled={submitting || !phone?.trim() || phase === "success"}
          >
            {payLabel}
          </button>
        </div>

        <p className="payment-footnote">
          Demo payment · No real card is charged. Replace with Stripe for live payments.
        </p>
      </div>
    </div>
  );
}
