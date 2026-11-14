import { useEffect, useState } from "react";
import { fetchAdminWithdrawals } from "../api/admin";

function AdminWithdrawals() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  const load = () => {
    fetchAdminWithdrawals()
      .then((res) => setItems(res.data))
      .catch(() => setError("Failed to load withdrawals."));
  };

  useEffect(() => {
    load();
  }, []);

  const displayStatus = (w) => {
    if (w.status === "completed") return "Success";
    if (w.status === "processing") return "Processing";
    if (w.status === "failed" || w.status === "cancelled") return "Failed";
    return w.display_status || "Pending";
  };

  const badgeClass = (status) => {
    const label = String(status).toLowerCase();
    if (label === "success" || label === "completed") return "badge-approved";
    if (label === "failed" || label === "rejected") return "badge-rejected";
    if (label === "processing") return "badge-open";
    return "badge-pending";
  };

  const remarks = (w) =>
    w.failed_reason ||
    w.rejection_reason ||
    w.response_description ||
    w.result_description ||
    "—";

  return (
    <div>
      <h2 className="admin-page-title">Withdrawals</h2>
      <p className="admin-page-subtitle">
        Read-only withdrawal history. All payouts are processed automatically.
      </p>
      {error && <div className="admin-error">{error}</div>}
      {items.map((w) => (
        <div key={w.id} className="admin-card">
          <p className="admin-withdraw-amount">KES {w.amount}</p>
          <span className={`badge ${badgeClass(displayStatus(w))}`}>{displayStatus(w)}</span>
          <div className="admin-dispute-meta" style={{ marginTop: 12 }}>
            <span>Seller: {w.seller_username}</span>
            <span>Amount: KES {w.amount}</span>
            <span>Phone: {w.phone_number || w.payout_details || "—"}</span>
            <span>Method: {w.payout_method || "—"}</span>
            <span>Reference: {w.reference_id || w.mpesa_receipt || "—"}</span>
            <span>Requested: {new Date(w.created_at).toLocaleString()}</span>
          </div>
          <p style={{ marginTop: 8, color: "#475569" }}>
            <strong>Remarks:</strong> {remarks(w)}
          </p>
        </div>
      ))}
      {!items.length && <p>No withdrawal requests yet.</p>}
    </div>
  );
}

export default AdminWithdrawals;
