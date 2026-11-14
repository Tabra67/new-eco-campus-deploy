import { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { useNavigate, Link, useLocation } from "react-router-dom";
import MessagesPage from "./components/messages/MessagesPage";
import { API_BASE } from "./api/client";
import {
  fetchBuyerOrders,
  patchOrderAction,
  openOrderDispute,
  initiateMpesaStkPush,
  pollMpesaPayment
} from "./api/orders";
import {
  ESCROW_ACTIONS,
  ESCROW_ACTION_TO_API,
  ESCROW_STATUS,
  normalizeEscrowStatus,
  ordersToDisputes,
  ordersToPayments
} from "./utils/escrowOrders";
import { fetchBuyerDisputes } from "./api/disputes";
import { fetchSellerTrust } from "./api/trust";
import { submitOrderReview } from "./api/reviews";
import PaymentFormCard from "./components/PaymentFormCard";
import DisputeCard from "./components/DisputeCard";
import BuyerTrustPanel from "./components/trust/BuyerTrustPanel";
import TrustDetailModal from "./components/trust/TrustDetailModal";
import { fetchCart, addToCart } from "./api/cart";

function Dashboard({ defaultTab = "browse" }) {

  const [isShipping, setIsShipping] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [wishlist, setWishlist] = useState(new Set());
const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [trustModal, setTrustModal] = useState({ open: false, trust: null, loading: false, title: "", role: "seller" });
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [expandedDisputeId, setExpandedDisputeId] = useState(null);
  const [disputeModal, setDisputeModal] = useState({
    open: false,
    order: null,
    orderId: null
  });
  const [disputeForm, setDisputeForm] = useState({
    reason: "",
    description: "",
    evidence: null
  });

  const [paymentModal, setPaymentModal] = useState({
    open: false,
    order: null,
    orderId: null,
    submitting: false,
    phase: "idle"
  });
  const [paymentSuccess, setPaymentSuccess] = useState("");
  const [phone, setPhone] = useState("");
  const [apiDisputes, setApiDisputes] = useState([]);
  const [paymentSellerTrust, setPaymentSellerTrust] = useState(null);

  const [reviewModal, setReviewModal] = useState({
    open: false,
    orderId: null,
    rating: 5,
    comment: "",
    submitting: false,
    orderName: ""
  });
  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
  const [currentUser, setCurrentUser] = useState(storedUser);

  // Buyer-related
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [preferredCategories, setPreferredCategories] = useState([]);

  // Seller-related
  const [storeName, setStoreName] = useState('');
  const [sellerType, setSellerType] = useState('');
  const [mainCategory, setMainCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');

  // Payments
  const [payoutMethod, setPayoutMethod] = useState('');
  const [payoutDetails, setPayoutDetails] = useState('');

  // Security
  const [is2faEnabled, setIs2faEnabled] = useState(false);
  const [messagePreselectContext, setMessagePreselectContext] = useState(null);
  const [cartCount, setCartCount] = useState(0);
  const [addingProductId, setAddingProductId] = useState(null);
const navigate = useNavigate();
const location = useLocation();
const token = localStorage.getItem('authToken');
  const role = storedUser?.role;
  if (!role) {
    console.error("🚨 ROLE MISSING FROM BACKEND RESPONSE - localStorage.user:", storedUser);
  }
  console.log("🚀 DASHBOARD LOADED - USER:", storedUser, "ROLE:", role);



  const categories = ['All', 'Electronics', 'Books', 'Furniture', 'Services', 'Others'];

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    try {
      setOrdersLoading(true);
      const data = await fetchBuyerOrders();
      setOrders(data);
    } catch (err) {
      console.error("Failed to fetch orders:", err.response?.data || err.message);
      setError("Failed to load orders from server.");
    } finally {
      setOrdersLoading(false);
    }
  }, [token]);

  const disputes = useMemo(() => ordersToDisputes(orders), [orders]);
  const payments = useMemo(() => ordersToPayments(orders), [orders]);

  // Logout function
  const handleLogout = useCallback(() => {
    if (window.confirm("Are you sure you want to logout?")) {
      localStorage.removeItem("authToken");
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    if (defaultTab) setActiveTab(defaultTab);
  }, [defaultTab]);

  const openSellerTrustModal = async (order) => {
    const sellerId = order.sellerId ?? order.seller;
    if (!sellerId) return;
    setTrustModal({
      open: true,
      trust: null,
      loading: true,
      title: `Seller: ${order.sellerName || "Seller"}`,
      role: "seller"
    });
    try {
      const res = await fetchSellerTrust(sellerId);
      setTrustModal((m) => ({ ...m, trust: res.data, loading: false }));
    } catch {
      setTrustModal((m) => ({ ...m, loading: false }));
    }
  };

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
    console.log("DASHBOARD useEffect - role check:", role);
    setCurrentUser(storedUser);
    fetchProducts();
    fetchWishlist();
    fetchOrders();
    fetchCart()
      .then((data) => setCartCount(data.item_count || 0))
      .catch(() => setCartCount(0));
  }, [navigate, token, fetchOrders]);

  useEffect(() => {
    if (!token) return undefined;
    const interval = setInterval(() => {
      fetchOrders();
    }, 5000);
    return () => clearInterval(interval);
  }, [token, fetchOrders]);

  useEffect(() => {
    if (!location.state?.openMessages) return;

    if (location.state?.chatContext) {
      setMessagePreselectContext(location.state.chatContext);
    }
    setActiveTab("messages");
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (activeTab !== "disputes" || !token) return;
    fetchBuyerDisputes()
      .then((res) => setApiDisputes(res.data || []))
      .catch(() => setApiDisputes([]));
  }, [activeTab, token]);

  const fetchProducts = useCallback(async () => {
    try {
let url = `${API_BASE}/marketplace/products/`;
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedCategory && selectedCategory !== 'All') params.append('category', selectedCategory);
      if (params.toString()) url += `?${params}`;
      
      const { data } = await axios.get(url);
      setProducts(data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch products:', err);
      setLoading(false);
    }
  }, [searchTerm, selectedCategory]);

  const fetchWishlist = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/wishlist/`, {
        headers: { Authorization: `Token ${token}` }
      });
      const ids = new Set(data.map(item => item.product));
      setWishlist(ids);
    } catch (err) {
      console.error('Failed to fetch wishlist');
    }
  }, [token]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchProducts();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, selectedCategory]);

  const toggleWishlist = useCallback(async (productId) => {
    try {
      await axios.post(`${API_BASE}/wishlist/${productId}/toggle/`, {}, {
        headers: { Authorization: `Token ${token}` }
      });
      setWishlist(prev => {
        const newSet = new Set(prev);
        if (newSet.has(productId)) {
          newSet.delete(productId);
        } else {
          newSet.add(productId);
        }
        return newSet;
      });
    } catch (err) {
      console.error('Wishlist toggle failed');
    }
  }, [token]);

  const handleAddToCart = useCallback(async (productId) => {
    try {
      setAddingProductId(productId);
      const data = await addToCart(productId, 1);
      setCartCount(data.item_count || 0);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to add to cart.");
    } finally {
      setAddingProductId(null);
    }
  }, []);

  const orderTypeLabel = useCallback((order) => {
    if (order?.productType) return order.productType;
    if (order?.category) return order.category;
    return "Product";
  }, []);

  const openDisputeModal = useCallback((order, orderId) => {
    setDisputeModal({ open: true, order, orderId });
    setDisputeForm({
      reason: "",
      description: "",
      evidence: null
    });
  }, []);

  const closeDisputeModal = useCallback(() => {
    setDisputeModal({ open: false, order: null, orderId: null });
    setDisputeForm({
      reason: "",
      description: "",
      evidence: null
    });
  }, []);

  const handleEvidenceChange = useCallback((event) => {
    const file = event.target.files?.[0];
    setDisputeForm((prev) => ({ ...prev, evidence: file || null }));
  }, []);

  const performOrderAction = useCallback(
    async (orderId, action, extra = {}) => {
      const apiAction = ESCROW_ACTION_TO_API[action];
      if (!apiAction) return false;
      try {
        await patchOrderAction(orderId, apiAction, extra);
        await fetchOrders();
        setError("");
        return true;
      } catch (err) {
        const message =
          err.response?.data?.error ||
          err.response?.data?.detail ||
          "Could not update order. Please try again.";
        setError(message);
        return false;
      }
    },
    [fetchOrders]
  );

  const handlePayNow = useCallback((order, orderId) => {
    setPhone("");
    setPaymentSellerTrust(null);
    if (order?.sellerId) {
      fetchSellerTrust(order.sellerId).then((res) => setPaymentSellerTrust(res.data)).catch(() => {});
    }
    setPaymentModal({
      open: true,
      order,
      orderId: String(orderId),
      submitting: false,
      phase: "idle"
    });
  }, []);

  const closePaymentModal = useCallback(() => {
    setPhone("");
    setPaymentModal({
      open: false,
      order: null,
      orderId: null,
      submitting: false,
      phase: "idle"
    });
  }, []);

  const submitPayment = useCallback(async () => {
    if (!paymentModal.orderId || !paymentModal.order) return;
    if (!phone.trim()) return;

    setPaymentModal((prev) => ({ ...prev, submitting: true, phase: "initiating" }));
    setError("");

    try {
      const stk = await initiateMpesaStkPush({
        orderId: paymentModal.orderId,
        phone: phone.trim()
      });
      const checkoutId = stk.checkout_request_id;
      if (!checkoutId) {
        throw new Error("M-Pesa checkout could not be started.");
      }

      setPaymentModal((prev) => ({ ...prev, phase: "waiting" }));

      let attempts = 0;
      const waitForPayment = async () => {
        try {
          const status = await pollMpesaPayment(checkoutId);
          if (status.status === "completed") {
            await fetchOrders();
            setPaymentModal((prev) => ({ ...prev, phase: "success", submitting: false }));
            setPaymentSuccess(
              `Payment completed for ${paymentModal.order?.productName || "order"}. Funds are held in escrow.`
            );
            setTimeout(() => {
              closePaymentModal();
              setPaymentSuccess("");
            }, 2500);
            return;
          }
          if (
            status.status === "failed" ||
            status.status === "cancelled" ||
            status.status === "timeout"
          ) {
            setError(status.message || "Payment was not completed. Please try again.");
            setPaymentModal((prev) => ({ ...prev, phase: "failed", submitting: false }));
            return;
          }
          if (attempts >= 30) {
            setError("Payment is taking too long. If you paid, refresh orders in a moment.");
            setPaymentModal((prev) => ({ ...prev, phase: "failed", submitting: false }));
            return;
          }
          attempts += 1;
          setTimeout(waitForPayment, 2000);
        } catch (pollErr) {
          setError("Could not verify payment status. Please check your orders tab.");
          setPaymentModal((prev) => ({ ...prev, phase: "failed", submitting: false }));
        }
      };

      waitForPayment();
    } catch (err) {
      const apiError = err.response?.data?.error || err.message || "Failed to initiate M-Pesa payment.";
      const hint =
        typeof apiError === "string" && apiError.toLowerCase().includes("callback")
          ? " Set MPESA_CALLBACK_URL in backend/.env to your ngrok HTTPS URL and restart Django."
          : "";
      setError(`${apiError}${hint}`);
      setPaymentModal((prev) => ({ ...prev, phase: "failed", submitting: false }));
    }
  }, [closePaymentModal, fetchOrders, paymentModal, phone]);

  const handleConfirmDelivery = useCallback(
    async (orderId) => {
      await performOrderAction(orderId, ESCROW_ACTIONS.BUYER_CONFIRM_DELIVERY);
    },
    [performOrderAction]
  );

  const handleBuyerDispute = useCallback((order, orderId) => {
    openDisputeModal(order, orderId);
  }, [openDisputeModal]);

  const openReviewModal = useCallback((order, orderId) => {
    setReviewModal({
      open: true,
      orderId: String(orderId),
      rating: 5,
      comment: "",
      submitting: false,
      orderName: order?.productName || "Order"
    });
  }, []);

  const submitReview = useCallback(async () => {
    if (!reviewModal.orderId) return;
    if (!reviewModal.rating) return;

    setReviewModal((prev) => ({ ...prev, submitting: true }));

    try {
      await submitOrderReview(reviewModal.orderId, {
        rating: reviewModal.rating,
        review_text: reviewModal.comment || "",
      });
      await fetchOrders();
      setReviewModal({
        open: false,
        orderId: null,
        rating: 5,
        comment: "",
        submitting: false,
        orderName: "",
      });
    } catch (err) {
      setError(err.response?.data?.error || "Failed to submit review.");
      setReviewModal((prev) => ({ ...prev, submitting: false }));
    }
  }, [reviewModal, fetchOrders]);

  const handleOpenDispute = useCallback(async () => {
    if (!disputeModal.order || !disputeModal.orderId) return;

    if (!disputeForm.reason || !disputeForm.description.trim()) {
      setError("Please select a dispute reason and provide a description.");
      return;
    }

    try {
      await openOrderDispute(disputeModal.orderId, {
        reason: disputeForm.reason,
        description: disputeForm.description.trim(),
        evidenceFile: disputeForm.evidence
      });
      await fetchOrders();
      setExpandedDisputeId(`dispute-${disputeModal.orderId}`);
      setError("");
      closeDisputeModal();
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Failed to open dispute. Ensure the order is delivered and try again."
      );
    }
  }, [closeDisputeModal, disputeForm, disputeModal, fetchOrders]);

  const disputesByOrder = useMemo(() => {
    return disputes.reduce((acc, dispute) => {
      acc[dispute.orderId] = dispute;
      return acc;
    }, {});
  }, [disputes]);

  const totalSpent = useMemo(
    () => payments.reduce((sum, item) => sum + Number(item?.amount || 0), 0),
    [payments]
  );

  if (loading) {
    return (
      <div style={{ textAlign: "center", marginTop: "100px" }}>
        <p>Loading...</p>
      </div>
    );
  }

  // Strict role-based UI switching with BuyerUI, SellerUI, AdminUI
  if (role === 'seller') {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '30px 20px' }}>
        <div style={{
          padding: "12px",
          marginBottom: "15px",
          backgroundColor: "#d4edda",
          borderRadius: "8px",
          borderLeft: "4px solid #28a745"
        }}>
          <h3 style={{ margin: 0, color: "#155724" }}>
            🛍️ Seller Dashboard - Manage Your Store
          </h3>
          <p>Link to SellerDashboard.js or create seller-specific UI here</p>
          <Link to="/seller-dashboard" style={{ color: '#28a745', textDecoration: 'none' }}>
            Go to Seller Dashboard →
          </Link>
        </div>
      </div>
    );
  }
  
  if (role === 'admin') {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '30px 20px' }}>
        <div style={{
          padding: "12px",
          marginBottom: "15px",
          backgroundColor: "#cce5ff",
          borderRadius: "8px",
          borderLeft: "4px solid #007bff"
        }}>
          <h3 style={{ margin: 0, color: "#004085" }}>
            👑 Admin Dashboard - Platform Management
          </h3>
          <p>Admin panel placeholder - user management, analytics, moderation</p>
        </div>
      </div>
    );
  }

  // Default BuyerUI (existing marketplace)
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <header
        style={{
          position: "fixed",
          top: 0,
          left: "220px",
          right: 0,
          height: "56px",
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          zIndex: 1100,
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)"
        }}
      >
        <div style={{ fontWeight: 700, color: "#0f172a" }}>Buyer Dashboard</div>
        <button
          type="button"
          onClick={handleLogout}
          style={{
            padding: "8px 16px",
            backgroundColor: "#ef4444",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: 700,
            flexShrink: 0
          }}
        >
          Logout
        </button>
      </header>

      <div style={{ display: "flex", flex: 1, paddingTop: "56px" }}>
      <div
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: "220px",
          height: "100vh",
          backgroundColor: "#1e293b",
          color: "white",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          zIndex: 1000,
          overflowY: "auto"
        }}
      >
        <div>
          <button
            onClick={() => setActiveTab("browse")}
            style={{
              width: "100%",
              padding: "10px",
              marginBottom: "10px",
              backgroundColor: activeTab === "browse" ? "#475569" : "#334155",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer"
            }}
          >
            Browse
          </button>
          <button
            onClick={() => navigate("/buyer/cart")}
            style={{
              width: "100%",
              padding: "10px",
              marginBottom: "10px",
              backgroundColor: "#334155",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}
          >
            <span>🛒 Cart</span>
            {cartCount > 0 && (
              <span style={{ background: "#667eea", borderRadius: "999px", padding: "2px 8px", fontSize: "0.8rem" }}>
                {cartCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            style={{
              width: "100%",
              padding: "10px",
              marginBottom: "10px",
              backgroundColor: activeTab === "orders" ? "#475569" : "#334155",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer"
            }}
          >
            My Orders
          </button>
          <button
            onClick={() => setActiveTab("payments")}
            style={{
              width: "100%",
              padding: "10px",
              marginBottom: "10px",
              backgroundColor: activeTab === "payments" ? "#475569" : "#334155",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer"
            }}
          >
            Payments
          </button>
          <button
            onClick={() => setActiveTab("disputes")}
            style={{
              width: "100%",
              padding: "10px",
              marginBottom: "10px",
              backgroundColor: activeTab === "disputes" ? "#475569" : "#334155",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer"
            }}
          >
            Disputes
          </button>
          <button
            onClick={() => setActiveTab("trust")}
            style={{
              width: "100%",
              padding: "10px",
              marginBottom: "10px",
              backgroundColor: activeTab === "trust" ? "#475569" : "#334155",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer"
            }}
          >
            Trust Profile
          </button>
          <button
            onClick={() => setActiveTab("messages")}
            style={{
              width: "100%",
              padding: "10px",
              marginBottom: "10px",
              backgroundColor: activeTab === "messages" ? "#475569" : "#334155",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer"
            }}
          >
            Messages
          </button>
        </div>

        <div style={{ borderTop: "1px solid rgba(148,163,184,0.35)", paddingTop: "14px", marginTop: "16px" }}>
          <p style={{ margin: "0 0 4px 0", fontWeight: 700 }}>{currentUser?.username}</p>
          <p style={{ margin: "0 0 12px 0", color: "#94a3b8", fontSize: "14px" }}>Buyer</p>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              width: "100%",
              padding: "10px 12px",
              backgroundColor: "#ef4444",
              color: "white",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
              fontWeight: 700
            }}
          >
            Logout
          </button>
        </div>
      </div>

      <div style={{ marginLeft: "240px", padding: "20px", width: "100%", minWidth: 0 }}>
        {error && (
          <div style={{ padding: "15px", backgroundColor: "#f8d7da", color: "#721c24", marginBottom: "20px", borderRadius: "8px", borderLeft: "4px solid #dc3545" }}>
            {error}
          </div>
        )}
        {paymentSuccess && (
          <div style={{ padding: "15px", backgroundColor: "#d1fae5", color: "#065f46", marginBottom: "20px", borderRadius: "8px", borderLeft: "4px solid #10b981" }}>
            {paymentSuccess}
          </div>
        )}
        <div
          style={{
            padding: "16px",
            marginBottom: "15px",
            backgroundColor: "#d4edda",
            borderRadius: "12px",
            borderLeft: "4px solid #28a745"
          }}
        >
          <h2 style={{ margin: "0 0 6px 0", color: "#155724" }}>Eco-Campus Marketplace</h2>
          <h3 style={{ margin: "0 0 4px 0", color: "#155724" }}>
            Welcome back, {currentUser?.username}
          </h3>
          <h4 style={{ margin: 0, fontWeight: 500, color: "#155724" }}>Logged in as: Buyer</h4>
        </div>
        {activeTab === "browse" && (
          <>
            <div
              style={{
                width: "100%",
                padding: "16px 20px",
                marginBottom: "15px",
                backgroundColor: "#f1f5f9",
                borderRadius: "10px"
              }}
            >
              <h3 style={{ margin: 0, color: "#1e293b" }}>Browse Marketplace</h3>
            </div>

            {/* Search & Filters */}
            <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Search products and services"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  flex: 1, minWidth: '300px', padding: '15px 20px', border: '2px solid #ddd', borderRadius: '25px', fontSize: '16px'
                }}
              />
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {["All", "Products", "Services"].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat === selectedCategory ? '' : cat)}
                    style={{
                      padding: '12px 20px',
                      borderRadius: '25px',
                      border: selectedCategory === cat ? 'none' : '2px solid #ddd',
                      background: selectedCategory === cat ? '#667eea' : 'white',
                      color: selectedCategory === cat ? 'white' : '#333',
                      cursor: 'pointer',
                      fontWeight: 500
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Products Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '25px' }}>
              {products.map(product => (
                <div key={product.id} style={{
                  background: 'white',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                  transition: 'transform 0.3s ease'
                }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-8px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'} >
                  {product.image_url && (
                    <img src={product.image_url} alt={product.title} style={{ width: '100%', height: '220px', objectFit: 'cover' }} />
                  )}
                  <div style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#333' }}>{product.title}</h3>
                      <button
                        onClick={() => toggleWishlist(product.id)}
                        style={{
                          background: wishlist.has(product.id) ? '#ff6b6b' : '#f8f9fa',
                          border: 'none',
                          borderRadius: '50%',
                          width: '40px',
                          height: '40px',
                          cursor: 'pointer',
                          fontSize: '20px'
                        }}
                      >
                        ❤️
                      </button>
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#667eea', marginBottom: '10px' }}>
                      Ksh {product.price}
                    </div>
                    <div style={{ color: '#666', fontSize: '14px', marginBottom: '8px' }}>
                      {product.category} • {product.condition} • {product.location}
                    </div>
                    <div style={{ color: '#28a745', fontWeight: 500, marginBottom: '15px' }}>
                      By {product.seller_name}
                    </div>
                    <p style={{ color: '#555', lineHeight: 1.5, marginBottom: '15px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {product.description}
                    </p>
                    <button
                      onClick={() => navigate(`/marketplace/product/${product.id}`)}
                      style={{
                        width: '100%',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        border: 'none',
                        padding: '14px',
                        borderRadius: '12px',
                        fontSize: '16px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        marginBottom: '10px'
                      }}
                    >
                      View Details →
                    </button>
                    <button
                      onClick={() => handleAddToCart(product.id)}
                      disabled={(product.units_available ?? 1) <= 0 || addingProductId === product.id}
                      style={{
                        width: '100%',
                        background: (product.units_available ?? 1) <= 0 ? '#ccc' : 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                        color: 'white',
                        border: 'none',
                        padding: '12px',
                        borderRadius: '12px',
                        fontSize: '15px',
                        fontWeight: 600,
                        cursor: (product.units_available ?? 1) <= 0 ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {addingProductId === product.id ? 'Adding...' : '🛍️ Add to Cart'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {products.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: '80px', color: '#666' }}>
                <h2>No products found</h2>
                <p>Try adjusting your search or category filters</p>
              </div>
            )}
          </>
        )}

        {activeTab === "orders" && (
          <>
            <div
              style={{
                width: "100%",
                padding: "16px 20px",
                marginBottom: "15px",
                backgroundColor: "#f1f5f9",
                borderRadius: "10px"
              }}
            >
              <h3 style={{ margin: 0, color: "#1e293b" }}>My Orders</h3>
            </div>

            <div
              style={{
                display: "flex",
                gap: "20px",
                flexWrap: "wrap",
                padding: "16px",
                marginBottom: "20px",
                backgroundColor: "#ffffff",
                borderRadius: "10px",
                border: "1px solid #e2e8f0"
              }}
            >
              <div style={{ color: "#0f172a", fontWeight: 700 }}>
                Total Orders: {orders.length}
              </div>
            </div>

            {orders.length === 0 ? (
              <div style={{ padding: "24px", backgroundColor: "#f8fafc", borderRadius: "10px", color: "#334155" }}>
                <h3 style={{ margin: "0 0 8px 0" }}>No orders yet</h3>
                <p style={{ margin: 0 }}>Place an order from Browse to see it here.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: "16px" }}>
                {orders.map((order, index) => {
                  const orderId = order.id || `${order.productId}-${order.orderDate}-${index}`;
                  const currentStatus = normalizeEscrowStatus(order.status);
                  const isDisputed = currentStatus === ESCROW_STATUS.DISPUTED;
                  const isPendingPayment = currentStatus === ESCROW_STATUS.PENDING_PAYMENT;
                  const isDelivered = currentStatus === ESCROW_STATUS.DELIVERED;
                  const isCompleted = currentStatus === ESCROW_STATUS.COMPLETED;
                  const existingReview = order.buyerReview || order.buyer_review;
                  const sellerId = String(order.sellerId ?? order.seller ?? order.sellerName ?? "seller-unknown");
                  const statusColorMap = {
                    "Pending Payment": "#f59e0b",
                    Paid: "#8b5cf6",
                    Processing: "#3b82f6",
                    Shipped: "#0ea5e9",
                    Delivered: "#06b6d4",
                    Completed: "#16a34a",
                    Disputed: "#ef4444",
                    Cancelled: "#64748b"
                  };

                  return (
                    <div
                      key={orderId}
                      style={{
                        backgroundColor: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "12px",
                        padding: "16px"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "8px" }}>
                        <h4 style={{ margin: 0, color: "#0f172a" }}>{order.productName}</h4>
                        <div style={{ marginLeft: "auto", fontWeight: 800, color: "#0f172a", whiteSpace: "nowrap" }}>
                          Ksh {order.productPrice}
                        </div>
                      </div>
                      <p style={{ margin: "0 0 6px 0", color: "#334155" }}><strong>Type:</strong> {orderTypeLabel(order)}</p>
                      <p style={{ margin: "0 0 6px 0", color: "#334155" }}>
                        <strong>Seller:</strong>{" "}
                        <button
                          type="button"
                          onClick={() => openSellerTrustModal(order)}
                          style={{
                            border: "none",
                            background: "none",
                            color: "#2563eb",
                            cursor: "pointer",
                            fontWeight: 600,
                            padding: 0,
                            textDecoration: "underline"
                          }}
                        >
                          {order.sellerName}
                        </button>
                      </p>
                      <p style={{ margin: "0 0 8px 0", color: "#334155" }}>
                        <strong>Status:</strong>{" "}
                        <span
                          style={{
                            display: "inline-block",
                            marginLeft: "6px",
                            padding: "4px 10px",
                            borderRadius: "999px",
                            fontSize: "12px",
                            fontWeight: 700,
                            color: "white",
                            backgroundColor: statusColorMap[currentStatus] || "#64748b"
                          }}
                        >
                          {currentStatus}
                        </span>
                        {isCompleted && existingReview && (
                          <span style={{ marginLeft: "8px", color: "#f59e0b", fontWeight: 700 }}>
                            {"★".repeat(Math.min(5, Number(existingReview.rating || 0)))}
                            {existingReview.review_text ? ` — ${existingReview.review_text}` : ""}
                          </span>
                        )}
                      </p>
                      <div style={{ display: "flex", gap: "10px", margin: "12px 0 10px 0", flexWrap: "wrap" }}>
                        <button
                            type="button"
                            onClick={async () => {
                              const buyerId = String(currentUser?.id ?? currentUser?.userId ?? currentUser?.username ?? "buyer-anon");
                              try {
                                await axios.post(
                                  `${API_BASE}/conversations/ensure/`,
                                  {
                                    order_id: Number(orderId),
                                    buyer_id: buyerId,
                                    seller_id: sellerId
                                  },
                                  { headers: { Authorization: `Token ${token}` } }
                                );
                              } catch (err) {
                                console.error("ENSURE_CONVERSATION_ERROR:", err.response?.status, err.response?.data || err.message);
                              }

                              navigate(`/buyer/dashboard/messages?orderId=${orderId}&buyerId=${buyerId}&sellerId=${sellerId}`);
                            }}
                            style={{
                              border: "1px solid #cbd5e1",
                              backgroundColor: "#f8fafc",
                              color: "#334155",
                              borderRadius: "8px",
                              padding: "8px 10px",
                              cursor: "pointer",
                              fontWeight: 600
                            }}
                          >
                            💬
                          </button>

                        {isPendingPayment && !paymentModal.open && (
                          <button
                            type="button"
                            onClick={() => handlePayNow(order, orderId)}
                            style={{
                              border: "1px solid #bbf7d0",
                              backgroundColor: "#ecfdf5",
                              color: "#166534",
                              borderRadius: "8px",
                              padding: "8px 12px",
                              cursor: "pointer",
                              fontWeight: 800
                            }}
                          >
                            💳 Pay Now
                          </button>
                        )}

                        {isDelivered && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleConfirmDelivery(orderId)}
                              style={{
                                border: "1px solid #bbf7d0",
                                backgroundColor: "#ecfdf5",
                                color: "#166534",
                                borderRadius: "8px",
                                padding: "8px 12px",
                                cursor: "pointer",
                                fontWeight: 800
                              }}
                            >
                              ✅ Confirm Delivery
                            </button>
                            <button
                              type="button"
                              onClick={() => handleBuyerDispute(order, orderId)}
                              style={{
                                border: "1px solid #fecaca",
                                backgroundColor: "#fff1f2",
                                color: "#b91c1c",
                                borderRadius: "8px",
                                padding: "8px 12px",
                                cursor: "pointer",
                                fontWeight: 800
                              }}
                            >
                              ⚠️ Dispute
                            </button>
                          </>
                        )}

                        {isCompleted && !existingReview && (
                          <button
                            type="button"
                            onClick={() => openReviewModal(order, orderId)}
                            style={{
                              border: "1px solid #e9d5ff",
                              backgroundColor: "#faf5ff",
                              color: "#6d28d9",
                              borderRadius: "8px",
                              padding: "8px 12px",
                              cursor: "pointer",
                              fontWeight: 800
                            }}
                          >
                            ⭐ Leave Review
                          </button>
                        )}

                        {(disputesByOrder[orderId] || isDisputed) && (
                          <span style={{ alignSelf: "center", color: "#b91c1c", fontWeight: 800, fontSize: "13px" }}>
                            Dispute Open
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
                        <strong>Order Date:</strong> {new Date(order.orderDate).toLocaleString()}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {activeTab === "payments" && (
          <div style={{ display: "grid", gap: "16px" }}>
            <div
              style={{
                width: "100%",
                padding: "16px 20px",
                backgroundColor: "#f1f5f9",
                borderRadius: "10px"
              }}
            >
              <h3 style={{ margin: 0, color: "#1e293b" }}>Payments</h3>
            </div>

            <div
              style={{
                display: "flex",
                gap: "20px",
                flexWrap: "wrap",
                padding: "16px",
                backgroundColor: "#ffffff",
                borderRadius: "10px",
                border: "1px solid #e2e8f0"
              }}
            >
              <div style={{ color: "#0f172a", fontWeight: 700 }}>Total Spent: Ksh {totalSpent.toLocaleString()}</div>
              <div style={{ color: "#0f172a", fontWeight: 700 }}>Payments Count: {payments.length}</div>
            </div>

            <div style={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: "680px", borderCollapse: "separate", borderSpacing: 0 }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8fafc", textAlign: "left" }}>
                    <th style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>Payment ID</th>
                    <th style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>Order Name</th>
                    <th style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>Date</th>
                    <th style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: "20px 14px", color: "#64748b" }}>
                        No payments yet.
                      </td>
                    </tr>
                  ) : (
                    payments.map((payment) => (
                      <tr key={payment.id}>
                        <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", color: "#0f172a", fontWeight: 700 }}>
                          {payment.id}
                        </td>
                        <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", color: "#334155" }}>
                          {payment.orderName}
                        </td>
                        <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", color: "#334155" }}>
                          {new Date(payment.date).toLocaleString()}
                        </td>
                        <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", color: "#0f172a", fontWeight: 700 }}>
                          Ksh {Number(payment.amount || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "disputes" && (
          <div style={{ padding: "24px", backgroundColor: "#f8fafc", borderRadius: "10px", color: "#334155" }}>
            <h3 style={{ margin: "0 0 6px 0", color: "#0f172a", fontWeight: 800 }}>My Disputes</h3>
            <p style={{ margin: "0 0 16px", color: "#64748b" }}>Track open and resolved disputes.</p>
            {(apiDisputes.length ? apiDisputes : disputes).length === 0 ? (
              <p style={{ margin: 0 }}>No disputed orders yet.</p>
            ) : (
              <div style={{ display: "grid", gap: "14px" }}>
                {(apiDisputes.length
                  ? apiDisputes
                  : disputes.map((d) => ({
                      id: d.id,
                      reason: d.reason,
                      description: d.description,
                      status: "OPEN",
                      order_id: d.orderId,
                      seller_username: d.sellerName,
                      amount: d.price,
                      detailed_description: d.description,
                    }))
                ).map((dispute) => (
                  <DisputeCard key={dispute.id} dispute={dispute} view="buyer" />
                ))}
              </div>
            )}
          </div>
        )}

        {disputeModal.open && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(15, 23, 42, 0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2000,
              padding: "20px"
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "560px",
                backgroundColor: "#fff",
                borderRadius: "14px",
                padding: "22px",
                boxShadow: "0 20px 45px rgba(0,0,0,0.2)"
              }}
            >
              <h2 style={{ margin: "0 0 10px 0", color: "#0f172a", fontSize: "24px", fontWeight: 800 }}>
                RAISE A DISPUTE
              </h2>
              <p style={{ margin: "0 0 14px 0", color: "#334155" }}>
                For order: {disputeModal.order?.productName}, {orderTypeLabel(disputeModal.order)}, Ksh {disputeModal.order?.productPrice}
              </p>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: 700, color: "#0f172a" }}>Reason</label>
                <select
                  value={disputeForm.reason}
                  onChange={(e) => setDisputeForm((prev) => ({ ...prev, reason: e.target.value }))}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                >
                  <option value="">Select reason</option>
                  <option value="Item not received">Item not received</option>
                  <option value="Wrong item delivered">Wrong item delivered</option>
                  <option value="Damaged item">Damaged item</option>
                  <option value="Item not as described">Item not as described</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: 700, color: "#0f172a" }}>Description</label>
                <textarea
                  value={disputeForm.description}
                  onChange={(e) => setDisputeForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={5}
                  placeholder="Explain the issue in detail"
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", resize: "vertical" }}
                />
              </div>

              <div style={{ marginBottom: "18px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: 700, color: "#0f172a" }}>Evidence (Optional)</label>
                <input type="file" accept="image/*" onChange={handleEvidenceChange} />
                {disputeForm.evidence?.name && (
                  <p style={{ margin: "8px 0 0 0", color: "#475569", fontSize: "14px" }}>
                    Attached: {disputeForm.evidence.name}
                  </p>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={closeDisputeModal}
                  style={{
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#fff",
                    color: "#334155",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    cursor: "pointer",
                    fontWeight: 700
                  }}
                >
                  Cancel Dispute
                </button>
                <button
                  type="button"
                  onClick={handleOpenDispute}
                  style={{
                    border: "none",
                    backgroundColor: "#b91c1c",
                    color: "#fff",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    cursor: "pointer",
                    fontWeight: 700
                  }}
                >
                  Open Dispute
                </button>
              </div>
            </div>
          </div>
        )}

        {paymentModal.open && paymentModal.order && (
          <PaymentFormCard
            order={paymentModal.order}
            phone={phone}
            onPhoneChange={setPhone}
            onSubmit={submitPayment}
            onClose={closePaymentModal}
            onBack={() => {
              closePaymentModal();
              setActiveTab("orders");
            }}
            submitting={paymentModal.submitting}
            phase={paymentModal.phase}
            sellerTrust={paymentSellerTrust}
          />
        )}

        {reviewModal.open && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(15, 23, 42, 0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2000,
              padding: "20px"
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "560px",
                backgroundColor: "#fff",
                borderRadius: "14px",
                padding: "22px",
                boxShadow: "0 20px 45px rgba(0,0,0,0.2)"
              }}
            >
              <h2 style={{ margin: "0 0 10px 0", color: "#0f172a", fontSize: "24px", fontWeight: 800 }}>
                Leave a Review
              </h2>
              <p style={{ margin: "0 0 14px 0", color: "#334155" }}>
                Order: {reviewModal.orderName}
              </p>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: 700, color: "#0f172a" }}>
                  Rating
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setReviewModal((prev) => ({ ...prev, rating: n }))}
                      style={{
                        border: "1px solid #e5e7eb",
                        backgroundColor: reviewModal.rating >= n ? "#7c3aed" : "#f3f4f6",
                        color: reviewModal.rating >= n ? "#fff" : "#374151",
                        borderRadius: "10px",
                        padding: "10px 12px",
                        cursor: "pointer",
                        fontWeight: 900,
                        minWidth: "48px"
                      }}
                      aria-label={`${n} star${n === 1 ? "" : "s"}`}
                    >
                      {reviewModal.rating >= n ? "★" : "☆"}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: 700, color: "#0f172a" }}>
                  Comment (Optional)
                </label>
                <textarea
                  value={reviewModal.comment}
                  onChange={(e) => setReviewModal((prev) => ({ ...prev, comment: e.target.value }))}
                  rows={4}
                  placeholder="Share your experience..."
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", resize: "vertical" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() =>
                    setReviewModal({
                      open: false,
                      orderId: null,
                      rating: 5,
                      comment: "",
                      submitting: false,
                      orderName: ""
                    })
                  }
                  style={{
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#fff",
                    color: "#334155",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    cursor: "pointer",
                    fontWeight: 700
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitReview}
                  disabled={reviewModal.submitting}
                  style={{
                    border: "none",
                    backgroundColor: reviewModal.submitting ? "#94a3b8" : "#6d28d9",
                    color: "#fff",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    cursor: reviewModal.submitting ? "not-allowed" : "pointer",
                    fontWeight: 800
                  }}
                >
                  {reviewModal.submitting ? "Submitting..." : "Submit Review"}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "trust" && <BuyerTrustPanel />}

        {activeTab === "messages" && (
          <MessagesPage preselectContext={messagePreselectContext} role="buyer" />
        )}
      </div>
      </div>

      <TrustDetailModal
        open={trustModal.open}
        onClose={() => setTrustModal({ open: false, trust: null, loading: false, title: "", role: "seller" })}
        title={trustModal.title}
        trust={trustModal.trust}
        role={trustModal.role}
        loading={trustModal.loading}
      />
    </div>
  );
}

export default Dashboard;
