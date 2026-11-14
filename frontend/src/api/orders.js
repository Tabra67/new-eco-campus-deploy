import apiClient from "./client";
import { mapApiOrderToUi } from "../utils/escrowOrders";

export async function fetchBuyerOrders() {
  const { data } = await apiClient.get("/orders/");
  const rows = Array.isArray(data) ? data : data?.results || [];
  return rows.map((order, index) => mapApiOrderToUi(order, index));
}

export async function fetchSellerOrders() {
  const { data } = await apiClient.get("/orders-seller/");
  const rows = Array.isArray(data) ? data : data?.results || [];
  return rows.map((order, index) => mapApiOrderToUi(order, index));
}

export async function createOrder({ productId, price }) {
  const { data } = await apiClient.post("/orders/", {
    product: productId,
    price
  });
  return mapApiOrderToUi(data, 0);
}

export async function patchOrderAction(orderId, action, payload = {}) {
  const { data } = await apiClient.patch(`/orders/${orderId}/actions/`, {
    action,
    ...payload
  });
  return mapApiOrderToUi(data, 0);
}

export async function openOrderDispute(orderId, { reason, description, evidenceFile }) {
  const formData = new FormData();
  formData.append("action", "buyer_dispute");
  formData.append("dispute_reason", reason);
  formData.append("dispute_description", description);
  if (evidenceFile) {
    formData.append("dispute_evidence_image", evidenceFile);
  }
  const { data } = await apiClient.patch(`/orders/${orderId}/actions/`, formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return mapApiOrderToUi(data, 0);
}

export async function initiateMpesaStkPush({ orderId, phone }) {
  const { data } = await apiClient.post("/mpesa/stk-push/", {
    order_id: orderId,
    phone
  });
  return data;
}

export async function initiateMpesaCheckout({ productId, quantity, phone }) {
  const { data } = await apiClient.post("/mpesa/checkout/", {
    product_id: productId,
    quantity: quantity || 1,
    phone
  });
  return data;
}

export async function pollMpesaPayment(checkoutRequestId) {
  const { data } = await apiClient.get(`/mpesa/status/${checkoutRequestId}/`);
  return data;
}
