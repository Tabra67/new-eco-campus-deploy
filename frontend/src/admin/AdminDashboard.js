import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import "./AdminDashboard.css";

function AdminDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const adminUser = JSON.parse(localStorage.getItem("adminUser") || "{}");
  const letter = (adminUser.username || adminUser.email || "A").charAt(0).toUpperCase();

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      navigate("/admin-login/", { replace: true });
      return;
    }
    const role = adminUser.role;
    if (role && role !== "admin" && role !== "super_admin") {
      navigate("/login/", { replace: true });
    }
  }, [navigate, adminUser.role]);

  const logout = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminAccessToken");
    localStorage.removeItem("adminRefreshToken");
    localStorage.removeItem("adminUser");
    navigate("/admin-login/", { replace: true });
  };

  const navClass = ({ isActive }) => (isActive ? "active" : "");

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <button
          type="button"
          className="admin-hamburger"
          onClick={() => setSidebarOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          ☰
        </button>
        <h1>Admin Dashboard</h1>
        <div className="admin-avatar">{letter}</div>
      </header>
      <div className="admin-body">
        <aside className={`admin-sidebar ${sidebarOpen ? "" : "collapsed"}`}>
          <div className="admin-brand">
            <span>🛡️</span>
            <span>Eco-Campus</span>
          </div>
          <nav className="admin-nav">
            <NavLink to="/admin-dashboard/" end className={navClass}>
              Overview
            </NavLink>
            <NavLink to="/admin-dashboard/users" className={navClass}>
              Users
            </NavLink>
            <NavLink to="/admin-dashboard/disputes" className={navClass}>
              Disputes
            </NavLink>
            <NavLink to="/admin-dashboard/withdrawals" className={navClass}>
              Withdrawals
            </NavLink>
            <NavLink to="/admin-dashboard/trust-risk" className={navClass}>
              Trust & Risk
            </NavLink>
          </nav>
          <div className="admin-sidebar-footer">
            <div>Signed in as:</div>
            <div>{adminUser.email}</div>
            <div className="role-badge">Admin</div>
            <button type="button" className="admin-logout" onClick={logout}>
              Logout
            </button>
          </div>
        </aside>
        <main className="admin-main">
          <Outlet key={location.pathname} />
        </main>
      </div>
    </div>
  );
}

export default AdminDashboard;
