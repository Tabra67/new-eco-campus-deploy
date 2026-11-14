import axios from "axios";

const API_ROOT = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";
export const API_BASE = `${API_ROOT}/api/marketplace`;
export const MEDIA_BASE_URL = API_ROOT;

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" }
});

apiClient.interceptors.request.use((config) => {
  const access = localStorage.getItem("accessToken");
  const token = localStorage.getItem("authToken");
  if (access) {
    config.headers.Authorization = `Bearer ${access}`;
  } else if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const hadAuth =
        localStorage.getItem("authToken") || localStorage.getItem("accessToken");
      if (hadAuth) {
        localStorage.removeItem("authToken");
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
