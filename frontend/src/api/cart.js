import apiClient from "./client";

export async function fetchCart() {
  const { data } = await apiClient.get("/cart/");
  return data;
}

export async function addToCart(productId, quantity = 1) {
  const { data } = await apiClient.post("/cart/add/", {
    product_id: productId,
    quantity
  });
  return data;
}

export async function updateCartItem(itemId, quantity) {
  const { data } = await apiClient.patch(`/cart/items/${itemId}/`, { quantity });
  return data;
}

export async function removeCartItem(itemId) {
  const { data } = await apiClient.delete(`/cart/items/${itemId}/`);
  return data;
}

export async function clearCart() {
  const { data } = await apiClient.post("/cart/clear/");
  return data;
}
