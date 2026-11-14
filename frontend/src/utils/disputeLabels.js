export function formatDisputeDecision(dispute) {
  const admin = dispute?.admin_decision;
  if (admin?.decision_label) return admin.decision_label;
  if (admin?.decision === "REFUND") return "Refunded to Buyer";
  if (admin?.decision === "RELEASE") return "Released to Seller";
  if (admin?.decision === "SPLIT") return "Split Between Buyer and Seller";
  if (admin?.decision === "REJECT") return "Dispute Rejected";

  const status = String(dispute?.status || "").toUpperCase();
  if (status === "REFUNDED") return "Refunded to Buyer";
  if (status === "RELEASED") return "Released to Seller";
  if (dispute?.refund_percentage && dispute.refund_percentage > 0 && dispute.refund_percentage < 100) {
    return "Split Between Buyer and Seller";
  }
  return null;
}

export function getAdminComment(dispute) {
  const admin = dispute?.admin_decision;
  return (
    admin?.admin_comment ||
    admin?.admin_notes ||
    dispute?.resolution_note ||
    dispute?.admin_notes ||
    ""
  );
}
