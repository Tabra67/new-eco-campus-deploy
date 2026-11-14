import apiClient from "./client";
import adminClient from "./admin";

export const fetchMyTrustProfile = () => apiClient.get("/trust/me/");
export const fetchTrustProfile = (userId) => apiClient.get(`/trust/${userId}/`);
export const fetchSellerTrust = (userId) => apiClient.get(`/trust/seller/${userId}/`);
export const fetchBuyerTrust = (userId) => apiClient.get(`/trust/buyer/${userId}/`);

export const fetchAdminTrustDashboard = () => adminClient.get("/trust/dashboard/");
export const fetchAdminFlaggedUsers = (risk = "all") =>
  adminClient.get("/trust/flagged/", { params: { risk } });
