import axios from "axios";

const API_ROOT = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";
const ADMIN_BASE = `${API_ROOT}/api/admin`;

const adminClient = axios.create({
  baseURL: ADMIN_BASE,
  headers: { "Content-Type": "application/json" },
});

adminClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("adminToken");
  const access = localStorage.getItem("adminAccessToken");
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  } else if (access) {
    config.headers.Authorization = `Bearer ${access}`;
  }
  return config;
});

adminClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const hadAdminAuth =
        localStorage.getItem("adminToken") || localStorage.getItem("adminAccessToken");
      if (hadAdminAuth) {
        localStorage.removeItem("adminToken");
        localStorage.removeItem("adminAccessToken");
        localStorage.removeItem("adminRefreshToken");
        localStorage.removeItem("adminUser");
      }
    }
    return Promise.reject(error);
  }
);

export const adminLogin = (identifier, password) =>
  adminClient.post("/login/", { identifier, password });

export const fetchAdminOverview = () => adminClient.get("/overview/");
export const fetchAdminUsers = () => adminClient.get("/users/");
export const banAdminUser = (userId) => adminClient.post(`/users/${userId}/ban/`);
export const deleteAdminUser = (userId) => adminClient.delete(`/users/${userId}/delete/`);
export const fetchAdminDisputes = () => adminClient.get("/disputes/");
export const disputeAdminAction = (disputeId, action, resolution_note = "") =>
  adminClient.post(`/disputes/${disputeId}/action/`, { action, resolution_note });
export const fetchAdminWithdrawals = () => adminClient.get("/withdrawals/");
export const withdrawalAdminAction = (withdrawalId, action, rejection_reason = "") =>
  adminClient.post(`/withdrawals/${withdrawalId}/action/`, { action, rejection_reason });

export default adminClient;
