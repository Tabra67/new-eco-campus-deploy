import apiClient from "../api/client";

/**
 * Open a chat with a user (buyer/seller/admin) and return navigation path + thread id.
 */
export async function openChatWithUser({ userId, productId, orderId, role = "buyer" }) {
  const { data } = await apiClient.post("/support/threads/", {
    user_id: userId,
    product_id: productId || undefined,
    order_id: orderId || undefined
  });
  const threadId = data?.id;
  const base =
    role === "seller"
      ? "/seller/dashboard/messages"
      : role === "admin"
        ? "/admin-dashboard"
        : "/buyer/dashboard/messages";
  const params = new URLSearchParams();
  if (threadId) params.set("threadId", String(threadId));
  if (orderId) params.set("orderId", String(orderId));
  if (userId) params.set("peerId", String(userId));
  if (productId) params.set("productId", String(productId));
  return `${base}?${params.toString()}`;
}
