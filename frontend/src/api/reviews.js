import apiClient from "./client";

export const submitOrderReview = (orderId, { rating, review_text }) =>
  apiClient.post("/reviews/", {
    order: orderId,
    rating,
    review_text: review_text || "",
  });

export const fetchSellerReviews = () => apiClient.get("/reviews/seller/");

export const fetchUserReviews = (userId) => apiClient.get(`/reviews/user/${userId}/`);
