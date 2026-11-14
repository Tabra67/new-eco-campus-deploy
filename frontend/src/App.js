import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import Register from "./Register";
import VerifyEmail from "./VerifyEmail";
import Login from "./Login";
import ForgotPassword from "./ForgotPassword";
import VerifyResetOTP from "./VerifyResetOTP";
import ResetPassword from "./ResetPassword";
import Dashboard from "./Dashboard";
import Profile from "./Profile";
import MyAccount from "./MyAccount";
import SellerDashboard from "./SellerDashboard";
import SellerAccount from "./SellerAccount";
import MarketplacePage from "./MarketplacePage";
import ProductDetailPage from "./ProductDetailPage";
import RegisterRoleSelectionPage from "./RegisterRoleSelectionPage";
import BuyerRegister from "./BuyerRegister";
import SellerRegister from "./SellerRegister";
import AdminRegister from "./AdminRegister";
import MessagesRoutePage from "./MessagesRoutePage";
import AdminLogin from "./admin/AdminLogin";
import AdminDashboard from "./admin/AdminDashboard";
import AdminOverview from "./admin/AdminOverview";
import AdminUsers from "./admin/AdminUsers";
import AdminDisputes from "./admin/AdminDisputes";
import AdminWithdrawals from "./admin/AdminWithdrawals";
import AdminTrustRisk from "./admin/AdminTrustRisk";
import BuyerCartPage from "./BuyerCartPage";
import SellerDisputeDetailPage from "./pages/SellerDisputeDetailPage";

const ADMIN_ROLES = ["admin", "super_admin"];

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
}

function isAdminUser(user) {
  return ADMIN_ROLES.includes(user?.role) || user?.is_staff === true;
}

// Buyer/seller protected routes — blocks admin users
function ProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) {
      setIsAuthenticated(false);
      return;
    }
    const user = getStoredUser();
    if (isAdminUser(user)) {
      setIsAuthenticated(false);
      return;
    }
    setIsAuthenticated(true);
  }, []);

  if (isAuthenticated === null) {
    return (
      <div style={{ textAlign: "center", marginTop: "100px" }}>
        <p>Verifying authentication...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    const user = getStoredUser();
    if (localStorage.getItem("authToken") && isAdminUser(user)) {
      return <Navigate to="/admin-login/" replace />;
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

function AdminProtectedRoute({ children }) {
  const [ok, setOk] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      setOk(false);
      return;
    }
    const user = JSON.parse(localStorage.getItem("adminUser") || "{}");
    setOk(ADMIN_ROLES.includes(user.role));
  }, []);

  if (ok === null) {
    return (
      <div style={{ textAlign: "center", marginTop: "100px" }}>
        <p>Verifying admin access...</p>
      </div>
    );
  }

  if (!ok) {
    return <Navigate to="/admin-login/" state={{ from: location }} replace />;
  }

  return children;
}

// Public Route - redirect to dashboard if already logged in
function PublicRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    setIsAuthenticated(!!token);
  }, []);

  if (isAuthenticated === null) {
    return (
      <div style={{ textAlign: "center", marginTop: "100px" }}>
        <p>Verifying authentication...</p>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<MarketplacePage />} />
        <Route path="/register" element={<Navigate to="/register/role" replace />} />
        <Route 
          path="/register/role" 
          element={
            <PublicRoute>
              <RegisterRoleSelectionPage />
            </PublicRoute>
          } 
        />
        <Route 
          path="/register/buyer" 
          element={
            <PublicRoute>
              <BuyerRegister />
            </PublicRoute>
          } 
        />
        <Route 
          path="/register/seller" 
          element={
            <PublicRoute>
              <SellerRegister />
            </PublicRoute>
          } 
        />
        <Route 
          path="/register/admin" 
          element={
            <PublicRoute>
              <AdminRegister />
            </PublicRoute>
          } 
        />
        <Route path="/verify-email" element={<VerifyEmail />} />
        
        {/* Login - public for non-authenticated users */}
        <Route path="/admin-login/" element={<AdminLogin />} />
        <Route
          path="/admin-dashboard"
          element={
            <AdminProtectedRoute>
              <AdminDashboard />
            </AdminProtectedRoute>
          }
        >
          <Route index element={<AdminOverview />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="disputes" element={<AdminDisputes />} />
          <Route path="withdrawals" element={<AdminWithdrawals />} />
          <Route path="trust-risk" element={<AdminTrustRisk />} />
        </Route>

        <Route 
          path="/login" 
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          } 
        />
        
        {/* Password Reset Routes */}
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-reset-otp" element={<VerifyResetOTP />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        
        {/* Protected Routes - require authentication */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/profile" 
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/my-account" 
          element={
            <ProtectedRoute>
              <MyAccount />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/seller-account" 
          element={
            <ProtectedRoute>
              <SellerAccount />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/seller-dashboard" 
          element={
            <ProtectedRoute>
              <SellerAccount />
            </ProtectedRoute>
          } 
        />
        <Route path="/seller/disputes" element={<ProtectedRoute><SellerAccount defaultSection="disputes" /></ProtectedRoute>} />
        <Route path="/seller/disputes/:id" element={<ProtectedRoute><SellerAccount defaultSection="disputes" /></ProtectedRoute>} />
        <Route path="/seller/trust-center" element={<ProtectedRoute><SellerAccount defaultSection="trust" /></ProtectedRoute>} />
        <Route path="/buyer/trust-profile" element={<ProtectedRoute><Dashboard defaultTab="trust" /></ProtectedRoute>} />
        <Route
          path="/buyer/cart"
          element={
            <ProtectedRoute>
              <BuyerCartPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/buyer-dashboard/messages"
          element={
            <ProtectedRoute>
              <MessagesRoutePage role="buyer" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/buyer/dashboard/messages"
          element={
            <ProtectedRoute>
              <MessagesRoutePage role="buyer" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/seller-dashboard/messages"
          element={
            <ProtectedRoute>
              <MessagesRoutePage role="seller" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/seller/dashboard/messages"
          element={
            <ProtectedRoute>
              <MessagesRoutePage role="seller" />
            </ProtectedRoute>
          }
        />
        
        {/* PUBLIC Marketplace Routes */}
        <Route path="/marketplace" element={<MarketplacePage />} />
        <Route path="/marketplace/product/:id" element={<ProductDetailPage />} />
        
        {/* Catch all - redirect to marketplace */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;

