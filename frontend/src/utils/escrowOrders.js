import { MEDIA_BASE_URL } from "../api/client";

export const ESCROW_STATUS = {
  PENDING_PAYMENT: "Pending Payment",
  PAID: "Paid",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  DISPUTED: "Disputed",
  CANCELLED: "Cancelled",
  // Legacy UI labels
  PENDING: "Pending Payment",
  CONFIRMED: "Processing",
  SHIPPING: "Shipped"
};

export const ESCROW_ACTIONS = {
  BUYER_PAY: "BUYER_PAY",
  SELLER_PROCESSING: "SELLER_PROCESSING",
  SELLER_SHIP: "SELLER_SHIP",
  SELLER_MARK_DELIVERED: "SELLER_MARK_DELIVERED",
  BUYER_CONFIRM_DELIVERY: "BUYER_CONFIRM_DELIVERY",
  BUYER_DISPUTE: "BUYER_DISPUTE",
  SELLER_CONFIRM: "SELLER_CONFIRM"
};

export const ESCROW_ACTION_TO_API = {
  [ESCROW_ACTIONS.BUYER_PAY]: "buyer_pay",
  [ESCROW_ACTIONS.SELLER_PROCESSING]: "seller_processing",
  [ESCROW_ACTIONS.SELLER_CONFIRM]: "seller_confirm",
  [ESCROW_ACTIONS.SELLER_SHIP]: "seller_ship",
  [ESCROW_ACTIONS.SELLER_MARK_DELIVERED]: "seller_deliver",
  [ESCROW_ACTIONS.BUYER_CONFIRM_DELIVERY]: "buyer_confirm_delivery",
  [ESCROW_ACTIONS.BUYER_DISPUTE]: "buyer_dispute"
};

export function mapApiOrderToUi(order, index = 0) {
  const rawImage = order?.image_url ?? "";
  const image =
    typeof rawImage === "string" && rawImage.startsWith("/")
      ? `${MEDIA_BASE_URL}${rawImage}`
      : rawImage;

  return normalizeEscrowOrder(
    {
      ...order,
      id: order?.id,
      productId: order?.product,
      productName: order?.product_title,
      productPrice: order?.price,
      productImage: image,
      image,
      sellerName: order?.seller_name,
      sellerId: order?.seller,
      buyerId: order?.buyer,
      buyerName: order?.buyer_name,
      orderDate: order?.created_at,
      createdAt: order?.created_at,
      status: order?.status,
      rawStatus: order?.status,
      escrowStatus: order?.escrow_status,
      paymentReference: order?.payment_reference,
      paymentPhone: order?.payment_phone,
      paidAt: order?.paid_at,
      deliveredAt: order?.delivered_at,
      completedAt: order?.completed_at,
      disputeReason: order?.dispute_reason,
      disputeDescription: order?.dispute_description,
      disputedAt: order?.disputed_at,
      buyerReview: order?.buyer_review,
      subtotal: order?.subtotal ?? order?.price,
      escrowFee: order?.escrow_fee,
      discountAmount: order?.discount_amount,
      totalAmount: order?.total_amount
    },
    index
  );
}

export function ordersToPayments(orders) {
  if (!Array.isArray(orders)) return [];
  return orders
    .filter((o) => {
      const s = normalizeEscrowStatus(o.status);
      return o.paidAt || o.paymentReference || [ESCROW_STATUS.PAID, ESCROW_STATUS.PROCESSING, ESCROW_STATUS.SHIPPED, ESCROW_STATUS.DELIVERED, ESCROW_STATUS.COMPLETED].includes(s);
    })
    .map((o) => ({
      id: o.paymentReference || `order-${o.id}`,
      orderName: o.productName || o.itemName || "Order",
      date: o.paidAt || o.createdAt,
      amount: Number(o.totalAmount ?? o.productPrice ?? o.price ?? 0),
      phone: o.paymentPhone || ""
    }));
}

export function ordersToDisputes(orders) {
  if (!Array.isArray(orders)) return [];
  return orders
    .filter((o) => normalizeEscrowStatus(o.status) === ESCROW_STATUS.DISPUTED)
    .map((o) => ({
      id: `dispute-${o.id}`,
      orderId: String(o.id),
      orderName: o.productName || o.itemName || "Order",
      type: o.category || "Product",
      price: o.productPrice ?? o.price,
      reason: o.disputeReason || "Dispute",
      description: o.disputeDescription || "",
      evidence: o.disputeEvidenceUrl ? { name: "Evidence", preview: o.disputeEvidenceUrl } : null,
      status: "Open",
      createdAt: o.disputedAt || o.createdAt
    }));
}

export function normalizeEscrowStatus(status) {
  const s = String(status ?? "").trim().toLowerCase();
  if (!s) return ESCROW_STATUS.PENDING_PAYMENT;

  if (s === "pending_payment" || s === "pending" || s === "order_placed") {
    return ESCROW_STATUS.PENDING_PAYMENT;
  }
  if (s === "paid") return ESCROW_STATUS.PAID;
  if (s === "processing" || s === "confirmed") return ESCROW_STATUS.PROCESSING;
  if (s === "shipped" || s === "shipping") return ESCROW_STATUS.SHIPPED;
  if (s === "delivered") return ESCROW_STATUS.DELIVERED;
  if (s === "completed" || s === "complete") return ESCROW_STATUS.COMPLETED;
  if (s === "disputed") return ESCROW_STATUS.DISPUTED;
  if (s === "cancelled" || s === "canceled") return ESCROW_STATUS.CANCELLED;

  return ESCROW_STATUS.PENDING_PAYMENT;
}

export function computeEscrowOrderId(order, index) {
  const existing =
    order?.id ?? order?.orderId ?? order?.order_id ?? order?.orderID ?? order?.uuid ?? null;
  if (existing != null && String(existing).trim()) return String(existing);

  const productId = order?.productId ?? order?.product_id ?? "product";
  const date =
    order?.orderDate ??
    order?.order_date ??
    order?.created_at ??
    order?.timestamp ??
    "";

  // Matches older buyer-side computed IDs: `${productId}-${orderDate}-${index}`
  return `${productId}-${date}-${index}`;
}

export function normalizeEscrowOrder(order, index) {
  const statusRaw = order?.status ?? order?.orderStatus ?? "";
  const normalizedPrice = Number(
    order?.price ??
      order?.productPrice ??
      order?.total ??
      order?.amount ??
      0
  );
  const normalizedItemName =
    order?.itemName ??
    order?.productName ??
    order?.product_title ??
    order?.product_name ??
    order?.product?.title ??
    "Order";
  const rawImage =
    order?.image ??
    order?.productImage ??
    order?.product_image ??
    order?.image_url ??
    order?.product?.image_url ??
    "";
  const normalizedImage =
    typeof rawImage === "string" && rawImage.startsWith("/")
      ? `${MEDIA_BASE_URL}${rawImage}`
      : rawImage;
  const normalizedBuyerName =
    order?.buyerName ??
    order?.buyer_username ??
    order?.buyer_name ??
    order?.buyer?.username ??
    order?.buyer?.full_name ??
    "Buyer";
  const normalizedCreatedAt =
    order?.createdAt ??
    order?.created_at ??
    order?.orderDate ??
    order?.order_date ??
    order?.timestamp ??
    new Date().toISOString();

  return {
    ...order,
    id: computeEscrowOrderId(order, index),
    itemName: normalizedItemName,
    image: normalizedImage,
    buyerName: normalizedBuyerName,
    price: normalizedPrice,
    createdAt: normalizedCreatedAt,
    status: normalizeEscrowStatus(statusRaw)
  };
}

export function normalizeEscrowOrders(orders) {
  if (!Array.isArray(orders)) return [];
  return orders.map((o, idx) => normalizeEscrowOrder(o, idx));
}

export function getNextStatusForAction({ currentStatus, action }) {
  const from = normalizeEscrowStatus(currentStatus);

  switch (action) {
    case ESCROW_ACTIONS.BUYER_PAY:
      return from === ESCROW_STATUS.PENDING_PAYMENT ? ESCROW_STATUS.PAID : null;
    case ESCROW_ACTIONS.SELLER_PROCESSING:
    case ESCROW_ACTIONS.SELLER_CONFIRM:
      return from === ESCROW_STATUS.PAID ? ESCROW_STATUS.PROCESSING : null;
    case ESCROW_ACTIONS.SELLER_SHIP:
      return from === ESCROW_STATUS.PROCESSING ? ESCROW_STATUS.SHIPPED : null;
    case ESCROW_ACTIONS.SELLER_MARK_DELIVERED:
      return from === ESCROW_STATUS.SHIPPED || from === ESCROW_STATUS.PAID
        ? ESCROW_STATUS.DELIVERED
        : null;
    case ESCROW_ACTIONS.BUYER_CONFIRM_DELIVERY:
      return from === ESCROW_STATUS.DELIVERED ? ESCROW_STATUS.COMPLETED : null;
    case ESCROW_ACTIONS.BUYER_DISPUTE:
      return from === ESCROW_STATUS.DELIVERED ? ESCROW_STATUS.DISPUTED : null;
    default:
      return null;
  }
}

export function isEscrowTerminalStatus(status) {
  const s = normalizeEscrowStatus(status);
  return s === ESCROW_STATUS.COMPLETED || s === ESCROW_STATUS.DISPUTED;
}

export function getAllowedNextStatuses({ currentStatus, role }) {
  const s = normalizeEscrowStatus(currentStatus);

  if (role === "seller") {
    if (s === ESCROW_STATUS.PAID) return [ESCROW_STATUS.DELIVERED];
    return [];
  }

  if (role === "buyer") {
    if (s === ESCROW_STATUS.PENDING_PAYMENT) return [ESCROW_STATUS.PAID];
    if (s === ESCROW_STATUS.DELIVERED) return [ESCROW_STATUS.COMPLETED, ESCROW_STATUS.DISPUTED];
    return [];
  }

  return [];
}

export function getStatusBadgeStyle(status) {
  const s = normalizeEscrowStatus(status);

  switch (s) {
    case ESCROW_STATUS.PENDING_PAYMENT:
      return { bg: "#f59e0b" };
    case ESCROW_STATUS.PAID:
      return { bg: "#8b5cf6" };
    case ESCROW_STATUS.PROCESSING:
      return { bg: "#3b82f6" };
    case ESCROW_STATUS.SHIPPED:
      return { bg: "#0ea5e9" };
    case ESCROW_STATUS.DELIVERED:
      return { bg: "#06b6d4" };
    case ESCROW_STATUS.COMPLETED:
      return { bg: "#16a34a" };
    case ESCROW_STATUS.DISPUTED:
      return { bg: "#ef4444" };
    case ESCROW_STATUS.CANCELLED:
      return { bg: "#64748b" };
    default:
      return { bg: "#64748b" };
  }
}

