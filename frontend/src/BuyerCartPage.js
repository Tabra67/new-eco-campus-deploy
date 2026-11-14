import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  fetchCart,
  updateCartItem,
  removeCartItem,
  clearCart
} from "./api/cart";
import { initiateMpesaCheckout, pollMpesaPayment } from "./api/orders";
import PaymentFormCard from "./components/PaymentFormCard";
import { formatKsh } from "./utils/currency";

function BuyerCartPage() {
  const navigate = useNavigate();
  const [cart, setCart] = useState({ items: [], subtotal: 0, item_count: 0, total_amount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [paymentModal, setPaymentModal] = useState({ open: false, phase: "idle", submitting: false });
  const [phone, setPhone] = useState("");
  const [checkoutProgress, setCheckoutProgress] = useState("");

  const loadCart = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchCart();
      setCart(data);
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load cart.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  const handleQuantityChange = async (itemId, quantity) => {
    const qty = parseInt(quantity, 10);
    if (Number.isNaN(qty) || qty < 1) return;
    try {
      await updateCartItem(itemId, qty);
      await loadCart();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update quantity.");
    }
  };

  const handleRemove = async (itemId) => {
    try {
      await removeCartItem(itemId);
      await loadCart();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to remove item.");
    }
  };

  const openCheckout = () => {
    if (!cart.items?.length) {
      setError("Your cart is empty.");
      return;
    }
    setPaymentModal({ open: true, phase: "idle", submitting: false });
    setCheckoutProgress("");
  };

  const closePaymentModal = () => {
    if (paymentModal.submitting) return;
    setPaymentModal({ open: false, phase: "idle", submitting: false });
    setCheckoutProgress("");
  };

  const submitCartCheckout = async () => {
    if (!phone.trim()) {
      setError("Enter your M-Pesa phone number.");
      return;
    }
    setPaymentModal((m) => ({ ...m, submitting: true, phase: "processing" }));
    setError("");

    const items = [...(cart.items || [])];
    try {
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        setCheckoutProgress(`Processing item ${i + 1} of ${items.length}: ${item.product_title}`);

        const checkout = await initiateMpesaCheckout({
          productId: item.product_id,
          quantity: item.quantity,
          phone: phone.trim()
        });

        const checkoutRequestId = checkout.checkout_request_id;
        if (!checkoutRequestId) {
          throw new Error(checkout.error || "Payment could not be started.");
        }

        setPaymentModal((m) => ({ ...m, phase: "waiting" }));

        let paid = false;
        for (let attempt = 0; attempt < 60; attempt += 1) {
          await new Promise((r) => setTimeout(r, 3000));
          const status = await pollMpesaPayment(checkoutRequestId);
          if (status.status === "completed") {
            paid = true;
            break;
          }
          if (status.status === "failed" || status.status === "cancelled" || status.status === "timeout") {
            throw new Error(status.result_desc || status.message || "Payment failed or was cancelled.");
          }
        }
        if (!paid) {
          throw new Error("Payment timed out. Please try again.");
        }
      }

      await clearCart();
      setPaymentModal({ open: false, phase: "idle", submitting: false });
      setSuccess("Checkout complete! Your orders have been placed.");
      setCheckoutProgress("");
      await loadCart();
      setTimeout(() => navigate("/dashboard"), 2000);
    } catch (err) {
      setPaymentModal((m) => ({ ...m, submitting: false, phase: "idle" }));
      setCheckoutProgress("");
      setError(err.response?.data?.error || err.message || "Checkout failed.");
    }
  };

  const cartTotal = Number(cart.total_amount || cart.subtotal || 0);
  const estimatedEscrow = cartTotal * 0.05;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc" }}>
      <aside
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: "220px",
          height: "100vh",
          backgroundColor: "#1e293b",
          color: "white",
          padding: "20px",
          zIndex: 1000,
          overflowY: "auto"
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: "20px" }}>Buyer Dashboard</div>
        <Link to="/dashboard" style={{ display: "block", color: "#cbd5e1", marginBottom: "10px", textDecoration: "none" }}>
          Browse
        </Link>
        <Link
          to="/buyer/cart"
          style={{
            display: "block",
            color: "white",
            marginBottom: "10px",
            textDecoration: "none",
            background: "#475569",
            padding: "10px",
            borderRadius: "5px"
          }}
        >
          🛒 Cart ({cart.item_count || 0})
        </Link>
        <Link to="/dashboard" style={{ display: "block", color: "#cbd5e1", marginBottom: "10px", textDecoration: "none" }}>
          My Orders
        </Link>
      </aside>

      <main style={{ marginLeft: "240px", padding: "24px", width: "100%", maxWidth: "960px" }}>
        <h1 style={{ margin: "0 0 8px", color: "#0f172a" }}>Shopping Cart</h1>
        <p style={{ color: "#64748b", marginBottom: "20px" }}>Review items before checkout.</p>

        {error && (
          <div style={{ padding: "12px", background: "#fee2e2", color: "#991b1b", borderRadius: "8px", marginBottom: "16px" }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ padding: "12px", background: "#d1fae5", color: "#065f46", borderRadius: "8px", marginBottom: "16px" }}>
            {success}
          </div>
        )}

        {loading ? (
          <p>Loading cart...</p>
        ) : !cart.items?.length ? (
          <div style={{ background: "white", padding: "40px", borderRadius: "12px", textAlign: "center", color: "#64748b" }}>
            <p>Your cart is empty.</p>
            <Link to="/dashboard" style={{ color: "#667eea", fontWeight: 600 }}>Browse products</Link>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gap: "16px", marginBottom: "24px" }}>
              {cart.items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    gap: "16px",
                    flexWrap: "wrap",
                    alignItems: "center",
                    background: "white",
                    padding: "16px",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0"
                  }}
                >
                  {item.image_url && (
                    <img
                      src={item.image_url}
                      alt={item.product_title}
                      style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "8px" }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: "180px" }}>
                    <div style={{ fontWeight: 600, color: "#0f172a" }}>{item.product_title}</div>
                    <div style={{ color: "#64748b", fontSize: "0.9rem" }}>Seller: {item.seller_name}</div>
                    <div style={{ color: "#667eea", fontWeight: 600 }}>{formatKsh(item.price)} each</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <label style={{ fontSize: "0.85rem", color: "#64748b" }}>Qty</label>
                    <input
                      type="number"
                      min="1"
                      max={item.units_available}
                      value={item.quantity}
                      onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                      style={{ width: "64px", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                    />
                  </div>
                  <div style={{ fontWeight: 700, minWidth: "100px", textAlign: "right" }}>
                    {formatKsh(item.subtotal)}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    style={{
                      background: "#fee2e2",
                      color: "#b91c1c",
                      border: "none",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontWeight: 600
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div
              style={{
                background: "white",
                padding: "20px",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "16px"
              }}
            >
              <div>
                <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0f172a" }}>
                  Total: {formatKsh(cartTotal)}
                </div>
                <div style={{ color: "#64748b", fontSize: "0.9rem" }}>
                  Escrow fee (est. 5%): {formatKsh(estimatedEscrow)}
                </div>
              </div>
              <button
                type="button"
                onClick={openCheckout}
                style={{
                  background: "linear-gradient(135deg, #28a745 0%, #20c997 100%)",
                  color: "white",
                  border: "none",
                  padding: "14px 28px",
                  borderRadius: "12px",
                  fontSize: "16px",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Proceed to Checkout
              </button>
            </div>
          </>
        )}
      </main>

      {paymentModal.open && (
        <PaymentFormCard
          order={{
            productName: `${cart.items?.length || 0} item(s) in cart`,
            productImage: cart.items?.[0]?.image_url || null,
            sellerName: "Multiple sellers",
            productPrice: cartTotal,
            escrowFee: estimatedEscrow,
            discountAmount: 0,
            totalAmount: cartTotal + estimatedEscrow,
          }}
          phone={phone}
          onPhoneChange={setPhone}
          onSubmit={submitCartCheckout}
          onClose={closePaymentModal}
          onBack={closePaymentModal}
          submitting={paymentModal.submitting}
          phase={paymentModal.phase}
          backLabel="← Back to cart"
          extraMessage={checkoutProgress}
        />
      )}
    </div>
  );
}

export default BuyerCartPage;
