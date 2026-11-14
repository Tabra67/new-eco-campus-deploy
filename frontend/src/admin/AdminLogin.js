import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminLogin } from "../api/admin";
import "./AdminDashboard.css";

function AdminLogin() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await adminLogin(identifier.trim(), password);
      localStorage.setItem("adminToken", data.token);
      if (data.access) localStorage.setItem("adminAccessToken", data.access);
      if (data.refresh) localStorage.setItem("adminRefreshToken", data.refresh);
      localStorage.setItem("adminUser", JSON.stringify(data.user));
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      navigate("/admin-dashboard/", { replace: true });
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        "Invalid credentials or insufficient privileges.";
      setError(typeof msg === "string" ? msg : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <h1>Eco-Campus Admin Login</h1>
        <p style={{ textAlign: "center", color: "#64748b", marginBottom: 24 }}>
          Staff access only
        </p>
        {error && <div className="admin-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <label htmlFor="admin-identifier">Email or Username</label>
          <input
            id="admin-identifier"
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
            required
          />
          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <button type="submit" className="admin-login-submit" disabled={loading}>
            {loading ? "Signing in…" : "Login to Admin Panel"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AdminLogin;
