import apiClient from "./client";

export const fetchBuyerDisputes = () => apiClient.get("/disputes/buyer/");
export const fetchSellerDisputes = () => apiClient.get("/disputes/seller/");
export const fetchDisputeDetail = (id) => apiClient.get(`/disputes/${id}/`);
export const respondToDispute = (id, data) =>
  apiClient.post(`/disputes/${id}/respond/`, data);
export const postDisputeMessage = (id, data) =>
  apiClient.post(`/disputes/${id}/message/`, data);
export const uploadDisputeEvidence = (id, formData) =>
  apiClient.post(`/disputes/${id}/evidence/`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
