import apiClient from "./client";

export async function fetchSellerWallet() {
  const { data } = await apiClient.get("/wallet/balance/");
  return data;
}

export async function fetchWithdrawals() {
  const { data } = await apiClient.get("/wallet/withdrawals/");
  return Array.isArray(data) ? data : [];
}

export async function requestWithdrawal({ amount, phone_number }) {
  const { data } = await apiClient.post("/wallet/withdraw/", {
    amount,
    phone_number
  });
  return data;
}

export async function fetchEscrowHistory() {
  const { data } = await apiClient.get("/escrow/history/");
  return Array.isArray(data) ? data : [];
}

export async function initiateCheckout({ productId, quantity, phone }) {
  const { data } = await apiClient.post("/mpesa/checkout/", {
    product_id: productId,
    quantity: quantity || 1,
    phone
  });
  return data;
}
