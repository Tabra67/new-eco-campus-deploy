import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import SellerDashboard from "./SellerDashboard";
import MessagesPage from "./components/messages/MessagesPage";
import { ensureConversation, appendMessage, formatDateTime, getConversations } from "./utils/messageStorage";
import { ESCROW_ACTIONS, ESCROW_ACTION_TO_API, ESCROW_STATUS, normalizeEscrowStatus, ordersToDisputes } from "./utils/escrowOrders";
import { fetchSellerOrders, patchOrderAction } from "./api/orders";
import { fetchSellerWallet, fetchWithdrawals } from "./api/wallet";
import { fetchBuyerTrust } from "./api/trust";
import { fetchSellerReviews } from "./api/reviews";
import { fetchSellerDisputes } from "./api/disputes";
import DisputeCard from "./components/DisputeCard";
import { formatKsh } from "./utils/currency";
import SellerTrustPanel from "./components/trust/SellerTrustPanel";
import TrustDetailModal from "./components/trust/TrustDetailModal";

function SellerAccount({ defaultSection = "overview" }) {
  const [activeSection, setActiveSection] = useState(defaultSection);
  const [trustModal, setTrustModal] = useState({ open: false, trust: null, loading: false, title: "", role: "buyer" });
  const [error, setError] = useState("");
  const [orders, setOrders] = useState([]);
  const [messages, setMessages] = useState([]);
  const [listings, setListings] = useState([]);
  const [activeOrderChat, setActiveOrderChat] = useState(null);
  const [chatDraft, setChatDraft] = useState("");
  const chatScrollRef = useRef(null);

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("BANK");
  const [bankAccount, setBankAccount] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [stripeId, setStripeId] = useState("");
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [withdrawErrors, setWithdrawErrors] = useState("");
  const [withdrawPhase, setWithdrawPhase] = useState("form");
  const [withdrawMessage, setWithdrawMessage] = useState("");
  const [wallet, setWallet] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [sellerReviews, setSellerReviews] = useState([]);
  const [apiDisputes, setApiDisputes] = useState([]);
  const [walletLoading, setWalletLoading] = useState(false);

  const navigate = useNavigate();
  const token = localStorage.getItem("authToken");
  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
  const API_BASE = "http://127.0.0.1:8000/api/marketplace";
  const MEDIA_BASE_URL = "http://127.0.0.1:8000";

  const username = storedUser?.username || storedUser?.full_name || "Seller";

  const navItems = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "add-listing", label: "Add Listing", icon: "➕" },
    { id: "orders", label: "Orders", icon: "📦" },
    { id: "earnings", label: "Earnings", icon: "💰" },
    { id: "disputes", label: "Disputes", icon: "⚖️" },
    { id: "reviews", label: "Reviews & Feedback", icon: "⭐" },
    { id: "trust", label: "Trust Center", icon: "🛡️" },
    { id: "messages", label: "Messages", icon: "💬" }
  ];

  const loadSellerOrders = async () => {
    try {
      const data = await fetchSellerOrders();
      setOrders(data);
    } catch (err) {
      console.error("FETCH_SELLER_ORDERS ERROR:", err.response?.data || err.message);
      setError("Failed to load orders from server.");
    }
  };

  const fetchMessages = async () => {
    if (!token) return;
    try {
      const { data } = await axios.get(`${API_BASE}/messages/`, {
        headers: { Authorization: `Token ${token}` }
      });
      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("FETCH_MESSAGES ERROR:", err.response?.status, err.response?.data || err.message);
      setError("Failed to load messages");
    }
  };

  const fetchListings = async () => {
    if (!token) return;
    try {
      const { data } = await axios.get(`${API_BASE}/products/`, {
        headers: { Authorization: `Token ${token}` }
      });
      setListings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("FETCH_LISTINGS ERROR:", err.response?.status, err.response?.data || err.message);
      setError("Failed to load listings");
    }
  };

  const loadWallet = async () => {
    try {
      setWalletLoading(true);
      const [walletData, withdrawalRows] = await Promise.all([
        fetchSellerWallet(),
        fetchWithdrawals()
      ]);
      setWallet(walletData);
      setWithdrawals(withdrawalRows);
    } catch (err) {
      console.error("WALLET_FETCH_ERROR:", err.response?.data || err.message);
    } finally {
      setWalletLoading(false);
    }
  };

  const loadSellerReviews = async () => {
    try {
      const res = await fetchSellerReviews();
      setSellerReviews(Array.isArray(res.data) ? res.data : []);
    } catch {
      setSellerReviews([]);
    }
  };

  const loadApiDisputes = async () => {
    try {
      const res = await fetchSellerDisputes();
      setApiDisputes(Array.isArray(res.data) ? res.data : []);
    } catch {
      setApiDisputes([]);
    }
  };

  const fetchAllSellerData = async () => {
    await Promise.all([
      fetchMessages(),
      fetchListings(),
      loadSellerOrders(),
      loadWallet(),
      loadSellerReviews(),
      loadApiDisputes(),
    ]);
  };

  useEffect(() => {
    if (defaultSection) setActiveSection(defaultSection);
  }, [defaultSection]);

  const openBuyerTrustModal = async (order) => {
    const buyerId = resolveBuyerId(order);
    if (!buyerId) return;
    setTrustModal({
      open: true,
      trust: null,
      loading: true,
      title: `Buyer: ${resolveBuyerName(order)}`,
      role: "buyer"
    });
    try {
      const res = await fetchBuyerTrust(buyerId);
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
    fetchAllSellerData();
  }, [token, navigate]);

  useEffect(() => {
    if (!token) return undefined;
    const interval = setInterval(() => {
      loadSellerOrders();
    }, 5000);
    return () => clearInterval(interval);
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const safeListings = Array.isArray(listings) ? listings : [];
// ✅ FIX: define helper BEFORE useMemo
const resolveOrderId = (order) => {
  if (!order) return null;
  return order.id ?? order.order_id ?? order.orderId ?? null;
};

const safeOrders = Array.isArray(orders) ? orders : [];
const safeDisputes = ordersToDisputes(safeOrders);

const sellerId = String(
  storedUser?.id ??
  storedUser?.userId ??
  storedUser?.username ??
  "seller-unknown"
);

const sellerName = String(
  storedUser?.username ??
  storedUser?.full_name ??
  username ??
  "Seller"
);

const disputesAgainstMe = useMemo(() => {
  if (!Array.isArray(safeDisputes)) return [];

  return safeDisputes
    .map((dispute) => {
      const linkedOrder = safeOrders.find((order) => {
        const orderId = String(resolveOrderId(order) ?? "");
        const disputeOrderId = String(
          dispute?.orderId ??
          dispute?.order?.id ??
          ""
        );
        return orderId && orderId === disputeOrderId;
      });

      const resolvedSellerId = String(
        dispute?.seller_id ??
        dispute?.sellerId ??
        dispute?.seller?.id ??
        linkedOrder?.seller_id ??
        linkedOrder?.sellerId ??
        linkedOrder?.seller?.id ??
        linkedOrder?.seller_name ??
        linkedOrder?.sellerName ??
        ""
      );

      const resolvedSellerName = String(
        dispute?.seller_name ??
        dispute?.sellerName ??
        dispute?.seller?.username ??
        dispute?.seller?.full_name ??
        linkedOrder?.seller_name ??
        linkedOrder?.sellerName ??
        linkedOrder?.seller?.username ??
        linkedOrder?.seller?.full_name ??
        ""
      );

      const belongsToSeller =
        (resolvedSellerId && resolvedSellerId === sellerId) ||
        (resolvedSellerName && resolvedSellerName === sellerName);

      if (!belongsToSeller) return null;

      return {
        ...dispute,
        reason: dispute?.reason || "Dispute raised",
        message:
          dispute?.message ||
          dispute?.description ||
          "No details provided.",
        status: dispute?.status || "Open",
        order: {
          id:
            dispute?.order?.id ??
            dispute?.orderId ??
            linkedOrder?.id ??
            linkedOrder?.order_id ??
            "N/A",
          price:
            dispute?.order?.price ??
            dispute?.price ??
            linkedOrder?.price ??
            linkedOrder?.productPrice ??
            0,
          buyer: {
            name:
              dispute?.order?.buyer?.name ??
              linkedOrder?.buyer?.name ??
              linkedOrder?.buyerName ??
              linkedOrder?.buyer_name ??
              linkedOrder?.buyer_username ??
              "Buyer"
          }
        }
      };
    })
    .filter(Boolean);
}, [safeDisputes, safeOrders, sellerId, sellerName]);

  const statValues = useMemo(() => {
    const normalizeStatus = (status) => String(status || "").toLowerCase();
    const resolveOrderAmount = (order) =>
      Number(order?.price ?? order?.productPrice ?? order?.total ?? order?.amount ?? 0);

    const totalOrders = safeOrders.length;
    const completedOrders = safeOrders.filter((o) => {
      const s = normalizeStatus(o.status);
      return s === "completed";
    }).length;

    return {
      totalOrders,
      completedOrders,
      availableBalance: Number(wallet?.available_balance ?? 0),
      inEscrow: Number(wallet?.pending_balance ?? 0),
      totalEarnings: Number(wallet?.total_earnings ?? 0),
      totalWithdrawn: Number(wallet?.total_withdrawn ?? 0)
    };
  }, [safeOrders, wallet]);

  const recentOrders = useMemo(() => {
    return [...safeOrders]
      .sort((a, b) => new Date(b.createdAt || b.created_at || b.orderDate || b.timestamp || 0) - new Date(a.createdAt || a.created_at || a.orderDate || a.timestamp || 0))
      .slice(0, 5);
  }, [safeOrders]);

  const normalizedChatMessages = useMemo(() => {
    const msgs = activeOrderChat?.messages || [];
    return [...msgs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [activeOrderChat]);

  useEffect(() => {
    if (!chatScrollRef.current) return;
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [normalizedChatMessages.length, activeOrderChat?.conversationId]);

  const resolveBuyerId = (order) =>
    String(
      order?.buyer_id ??
      order?.buyerId ??
      order?.buyer?.id ??
      order?.buyer_username ??
      order?.buyer_name ??
      order?.buyer ??
      "buyer-anon"
    );

  const resolveBuyerName = (order) =>
    order?.buyerName ||
    order?.buyer_username ||
    order?.buyer_name ||
    order?.buyer?.username ||
    order?.buyer?.full_name ||
    "Buyer";


  const resolveProductName = (order) =>
    order?.itemName || order?.productName || order?.product_title || order?.product_name || order?.product?.title || "Order";

  const resolveProductImage = (order) =>
    (() => {
      // Match listing image behavior and apply the same URL safety for relative media paths.
      const rawImage =
        order?.image ||
        order?.image_url ||
        order?.product_image ||
        order?.productImage ||
        order?.product?.image ||
        order?.product?.image_url ||
        order?.product?.product_image ||
        order?.thumbnail ||
        order?.product?.thumbnail ||
        "";

      if (typeof rawImage !== "string" || !rawImage) return "";
      return rawImage.startsWith("/") ? `${MEDIA_BASE_URL}${rawImage}` : rawImage;
    })();

  const mapStatusTone = (status) => {
    const s = normalizeEscrowStatus(status);
    if (s === ESCROW_STATUS.COMPLETED) return { bg: "#dcfce7", color: "#166534", border: "#bbf7d0", label: "Completed" };
    if (s === ESCROW_STATUS.SHIPPING) return { bg: "#e0f2fe", color: "#0369a1", border: "#bae6fd", label: "Shipping" };
    if (s === ESCROW_STATUS.PAID) return { bg: "#f3e8ff", color: "#6d28d9", border: "#ddd6fe", label: "Paid" };
    if (s === ESCROW_STATUS.CONFIRMED) return { bg: "#dbeafe", color: "#1d4ed8", border: "#bfdbfe", label: "Confirmed" };
    if (s === ESCROW_STATUS.DISPUTED) return { bg: "#fee2e2", color: "#b91c1c", border: "#fecaca", label: "Disputed" };
    return { bg: "#fef3c7", color: "#92400e", border: "#fde68a", label: "Pending" };
  };

  const openOrderChat = (order) => {
    const buyerId = resolveBuyerId(order);
    const buyerName = resolveBuyerName(order);
    const orderId = resolveOrderId(order);
    const orderName = resolveProductName(order);

    const sellerId = String(storedUser?.id ?? storedUser?.userId ?? storedUser?.username ?? "seller-unknown");
    const sellerName = username;

    const conversation = ensureConversation({
      buyerId,
      sellerId,
      orderId,
      productId: order?.product ?? order?.product_id ?? order?.productId ?? null,
      sellerName,
      sellerAvatar: storedUser?.profile_picture || storedUser?.avatar || "",
      orderName,
      orderType: "Order"
    });

    const all = getConversations();
    const latest = all.find((c) => c.conversationId === conversation.conversationId) || conversation;

    setActiveOrderChat({
      ...latest,
      buyerName,
      orderId
    });
    setChatDraft("");
  };

  const navigateToMessages = async (order) => {
    const buyerId = resolveBuyerId(order);
    const orderId = resolveOrderId(order);
    const sellerId = String(storedUser?.id ?? storedUser?.userId ?? storedUser?.username ?? "seller-unknown");

    if (!token || !orderId) {
      navigate(`/seller/dashboard/messages?orderId=${orderId || ""}&buyerId=${buyerId}&sellerId=${sellerId}`);
      return;
    }

    try {
      await axios.post(
        `${API_BASE}/conversations/ensure/`,
        { order_id: Number(orderId) },
        { headers: { Authorization: `Token ${token}` } }
      );
    } catch (err) {
      console.error("ENSURE_CONVERSATION_ERROR:", err.response?.status, err.response?.data || err.message);
    }

    navigate(`/seller/dashboard/messages?orderId=${orderId}&buyerId=${buyerId}&sellerId=${sellerId}`);
  };

  const closeOrderChat = () => {
    setActiveOrderChat(null);
    setChatDraft("");
  };

  const sendSellerMessage = () => {
    if (!activeOrderChat?.conversationId) return;
    const text = chatDraft.trim();
    if (!text) return;

    const updated = appendMessage(activeOrderChat.conversationId, {
      sender: "seller",
      text,
      timestamp: new Date().toISOString()
    });

    if (updated) {
      setActiveOrderChat((prev) => ({
        ...(prev || {}),
        ...updated,
        buyerName: prev?.buyerName || "Buyer"
      }));
    }
    setChatDraft("");
  };

  const handleOrderStatusChange = async (order, nextStatus) => {
    const orderId = resolveOrderId(order);
    if (!orderId) return;

    const target = normalizeEscrowStatus(nextStatus);
    let action = null;

    if (target === ESCROW_STATUS.PROCESSING) action = ESCROW_ACTIONS.SELLER_PROCESSING;
    if (target === ESCROW_STATUS.SHIPPED) action = ESCROW_ACTIONS.SELLER_SHIP;
    if (target === ESCROW_STATUS.DELIVERED) action = ESCROW_ACTIONS.SELLER_MARK_DELIVERED;
    if (!action) return;

    const apiAction = ESCROW_ACTION_TO_API[action];
    if (!apiAction) return;

    try {
      await patchOrderAction(orderId, apiAction);
      await loadSellerOrders();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update order status.");
    }
  };

  const renderOverview = () => {
    const completedOrders = safeOrders.filter((o) => normalizeEscrowStatus(o?.status) === ESCROW_STATUS.COMPLETED).length;
    const overviewOrders = recentOrders;

    const getOverviewStatusTone = (status) => {
      const s = normalizeEscrowStatus(status);
      if (s === ESCROW_STATUS.COMPLETED) return { bg: "#dcfce7", color: "#166534", border: "#bbf7d0", label: "Completed" };
      if (s === ESCROW_STATUS.SHIPPED) return { bg: "#e0f2fe", color: "#0369a1", border: "#bae6fd", label: "Shipped" };
      if (s === ESCROW_STATUS.DELIVERED) return { bg: "#cffafe", color: "#0e7490", border: "#a5f3fc", label: "Delivered" };
      if (s === ESCROW_STATUS.PAID) return { bg: "#dbeafe", color: "#1d4ed8", border: "#bfdbfe", label: "Paid" };
      if (s === ESCROW_STATUS.PROCESSING) return { bg: "#dbeafe", color: "#1d4ed8", border: "#bfdbfe", label: "Processing" };
      if (s === ESCROW_STATUS.DISPUTED) return { bg: "#fee2e2", color: "#b91c1c", border: "#fecaca", label: "Disputed" };
      return { bg: "#f3f4f6", color: "#4b5563", border: "#e5e7eb", label: "Pending" };
    };

    const getListingImage = (listing) => {
      const rawImage =
        listing?.image ||
        listing?.image_url ||
        listing?.product_image ||
        listing?.thumbnail ||
        "";

      if (typeof rawImage === "string" && rawImage.startsWith("/")) {
        return `${MEDIA_BASE_URL}${rawImage}`;
      }
      return rawImage || "https://via.placeholder.com/640x360?text=Listing";
    };

    const getOrderImage = (order) => resolveProductImage(order) || "https://via.placeholder.com/120x120?text=Item";

    return (
      <div
        style={{
          background: "#f9fafb",
          borderRadius: "16px",
          padding: "24px",
          border: "1px solid #e5e7eb",
          display: "grid",
          gap: "24px"
        }}
      >
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            padding: "20px 22px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap"
          }}
        >
          <div>
            <h2 style={{ margin: "0 0 8px", color: "#111827", fontSize: "28px", lineHeight: 1.2 }}>Welcome, {username}</h2>
            <p style={{ margin: 0, color: "#6b7280", fontSize: "14px" }}>
              You have <strong style={{ color: "#111827" }}>{safeListings.length}</strong> active listings
            </p>
          </div>

          <button
            onClick={() => setActiveSection("add-listing")}
            style={{
              border: "1px solid #16a34a",
              background: "#16a34a",
              color: "#ffffff",
              borderRadius: "10px",
              padding: "10px 16px",
              fontWeight: 700,
              fontSize: "14px",
              cursor: "pointer"
            }}
          >
            + Add listing
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px"
          }}
        >
          {[
            { icon: "📦", label: "Total orders", value: safeOrders.length },
            { icon: "✅", label: "Completed", value: completedOrders },
            { icon: "💰", label: "Available Balance", value: formatCurrency(statValues.availableBalance) },
            { icon: "🔒", label: "In Escrow", value: formatCurrency(statValues.inEscrow) }
          ].map((metric) => (
            <div
              key={metric.label}
              style={{
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                padding: "16px",
                minHeight: "116px",
                display: "grid",
                alignContent: "space-between",
                gap: "10px"
              }}
            >
              <div style={{ fontSize: "20px" }}>{metric.icon}</div>
              <div style={{ color: "#6b7280", fontSize: "13px", fontWeight: 500 }}>{metric.label}</div>
              <div style={{ color: "#111827", fontSize: "26px", lineHeight: 1.2, fontWeight: 800 }}>{metric.value}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            padding: "20px"
          }}
        >
          <h3 style={{ margin: "0 0 16px", color: "#111827", fontSize: "18px" }}>Recent orders</h3>
          {overviewOrders.length === 0 ? (
            <p style={{ margin: 0, color: "#6b7280" }}>No orders yet — keep selling!</p>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {overviewOrders.map((order, index) => {
                const statusTone = getOverviewStatusTone(order?.status);
                const title = resolveProductName(order);
                const buyerName = resolveBuyerName(order);
                const price = formatCurrency(order?.price ?? order?.productPrice ?? order?.total ?? order?.amount ?? 0);
                const image = getOrderImage(order);
                const rowKey = resolveOrderId(order) || `overview-order-${index}`;

                return (
                  <div
                    key={rowKey}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: "10px",
                      padding: "12px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                      flexWrap: "wrap"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: "220px", flex: 1 }}>
                      <img
                        src={image}
                        alt={title}
                        style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "10px",
                          objectFit: "cover",
                          border: "1px solid #e5e7eb",
                          background: "#f3f4f6"
                        }}
                      />
                      <div>
                        <div style={{ fontWeight: 700, color: "#111827", fontSize: "14px" }}>{title}</div>
                        <div style={{ color: "#6b7280", fontSize: "13px", marginTop: "2px" }}>Buyer: {buyerName}</div>
                      </div>
                    </div>

                    <div style={{ textAlign: "right", marginLeft: "auto" }}>
                      <div style={{ fontWeight: 800, color: "#111827", fontSize: "15px", marginBottom: "6px" }}>{price}</div>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          borderRadius: "999px",
                          border: `1px solid ${statusTone.border}`,
                          background: statusTone.bg,
                          color: statusTone.color,
                          padding: "4px 10px",
                          fontSize: "12px",
                          fontWeight: 700
                        }}
                      >
                        {statusTone.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            padding: "20px"
          }}
        >
          <h3 style={{ margin: "0 0 16px", color: "#111827", fontSize: "18px" }}>My listings</h3>

          {safeListings.length === 0 ? (
            <div>
              <p style={{ margin: "0 0 12px", color: "#6b7280" }}>No listings yet. Create your first →</p>
              <button
                onClick={() => setActiveSection("add-listing")}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#16a34a",
                  cursor: "pointer",
                  padding: 0,
                  fontWeight: 700
                }}
              >
                + Add listing
              </button>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "14px"
              }}
            >
              {safeListings.slice(0, 6).map((listing, index) => {
                const listingTitle = listing?.title || listing?.name || "Untitled listing";
                const category = listing?.category || "General";
                const type = listing?.type || listing?.condition || "Listing";
                const image = getListingImage(listing);
                const key = listing?.id || `listing-${index}`;

                return (
                  <div
                    key={key}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: "12px",
                      overflow: "hidden",
                      background: "#ffffff"
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        height: "180px",
                        background: "#f3f4f6"
                      }}
                    >
                      <img
                        src={image}
                        alt={listingTitle}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                    <div style={{ padding: "12px" }}>
                      <div style={{ color: "#6b7280", fontSize: "12px", marginBottom: "6px" }}>
                        {category} - {type}
                      </div>
                      <div style={{ color: "#111827", fontWeight: 700, fontSize: "15px", lineHeight: 1.3 }}>{listingTitle}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderOrders = () => {
    const ordersList = Array.isArray(orders) ? orders : [];

    return (
      <div
        style={{
          background: "white",
          borderRadius: "16px",
          padding: "20px",
          boxShadow: "0 10px 28px rgba(15, 23, 42, 0.08)",
          border: "1px solid #eef2f7"
        }}
      >
        <div style={{ marginBottom: "14px" }}>
          <h2 style={{ margin: 0, color: "#0f172a" }}>Incoming Orders</h2>
          <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: "14px" }}>
            Manage orders and communicate with buyers from one place.
          </p>
        </div>

        {ordersList.length === 0 ? (
          <p style={{ color: "#64748b" }}>No incoming orders yet.</p>
        ) : (
          <div style={{ width: "100%", overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: "12px" }}>
            <table style={{ width: "100%", minWidth: "760px", borderCollapse: "separate", borderSpacing: 0, background: "#fff" }}>
              <thead>
                <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                  <th style={{ padding: "14px 16px", color: "#475569", fontSize: "13px", fontWeight: 700, borderBottom: "1px solid #e2e8f0" }}>Item</th>
                  <th style={{ padding: "14px 16px", color: "#475569", fontSize: "13px", fontWeight: 700, borderBottom: "1px solid #e2e8f0" }}>Buyer</th>
                  <th style={{ padding: "14px 16px", color: "#475569", fontSize: "13px", fontWeight: 700, borderBottom: "1px solid #e2e8f0" }}>Amount</th>
                  <th style={{ padding: "14px 16px", color: "#475569", fontSize: "13px", fontWeight: 700, borderBottom: "1px solid #e2e8f0" }}>Status</th>
                  <th style={{ padding: "14px 16px", color: "#475569", fontSize: "13px", fontWeight: 700, borderBottom: "1px solid #e2e8f0", textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {ordersList.map((order) => {
                  const orderId = resolveOrderId(order) || Math.random();
                  const statusTone = mapStatusTone(order.status);
                  const currentStatus = normalizeEscrowStatus(order.status);
                  const sellerNextStatus =
                    currentStatus === ESCROW_STATUS.PAID ? ESCROW_STATUS.DELIVERED : null;

                  const sellerActionLabel =
                    sellerNextStatus === ESCROW_STATUS.DELIVERED ? "Mark Delivered" : "";

                  const existingReview = order.buyerReview || order.buyer_review;
                  const thumb = resolveProductImage(order);
                  const itemName = resolveProductName(order);
                  const buyerName = resolveBuyerName(order);
                  const amount = formatKsh(order.price ?? order.productPrice ?? order.total ?? order.amount ?? 0);

                  return (
                    <tr key={orderId}>
                      <td style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div
                            style={{
                              width: "44px",
                              height: "44px",
                              borderRadius: "10px",
                              overflow: "hidden",
                              background: "#f1f5f9",
                              border: "1px solid #e2e8f0",
                              flexShrink: 0
                            }}
                          >
                            {thumb ? (
                              <img src={thumb} alt={itemName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "12px" }}>
                                IMG
                              </div>
                            )}
                          </div>
                          <div style={{ color: "#0f172a", fontWeight: 600 }}>{itemName}</div>
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9", color: "#1e293b", fontWeight: 500 }}>
                        <button
                          type="button"
                          onClick={() => openBuyerTrustModal(order)}
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
                          {buyerName}
                        </button>
                      </td>
                      <td style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9", color: "#0f172a", fontWeight: 700 }}>
                        Ksh {amount}
                      </td>
                      <td style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                          <span
                            style={{
                              background: statusTone.bg,
                              color: statusTone.color,
                              border: `1px solid ${statusTone.border}`,
                              borderRadius: "999px",
                              padding: "4px 10px",
                              fontSize: "12px",
                              fontWeight: 700
                            }}
                          >
                            {statusTone.label}
                          </span>
                          {currentStatus === ESCROW_STATUS.COMPLETED && existingReview && (
                            <span style={{ fontSize: "12px", color: "#f59e0b", fontWeight: 700 }}>
                              {"★".repeat(Math.min(5, Number(existingReview.rating || 0)))}
                              {existingReview.review_text ? ` — ${existingReview.review_text}` : ""}
                            </span>
                          )}
                          {sellerNextStatus && (
                            <button
                              type="button"
                              onClick={() => handleOrderStatusChange(order, sellerNextStatus)}
                              style={{
                                border: "1px solid #cbd5e1",
                                borderRadius: "8px",
                                padding: "7px 10px",
                                fontSize: "13px",
                                background: "#fff",
                                color: "#0f172a",
                                cursor: "pointer",
                                fontWeight: 800
                              }}
                            >
                              {sellerActionLabel}
                            </button>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9", textAlign: "center" }}>
                        <button
                            type="button"
                            onClick={() => navigateToMessages(order)}
                            title="Open chat"
                            style={{
                              border: "1px solid #cbd5e1",
                              background: "#ffffff",
                              borderRadius: "10px",
                              width: "38px",
                              height: "38px",
                              cursor: "pointer",
                              fontSize: "18px"
                            }}
                          >
                            💬
                          </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeOrderChat && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "14px",
              zIndex: 2000
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "760px",
                height: "min(86vh, 680px)",
                background: "#efeae2",
                borderRadius: "16px",
                overflow: "hidden",
                boxShadow: "0 24px 50px rgba(2, 6, 23, 0.32)",
                display: "flex",
                flexDirection: "column"
              }}
            >
              <div
                style={{
                  background: "#f8fafc",
                  borderBottom: "1px solid #e2e8f0",
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px"
                }}
              >
                <div>
                  <div style={{ color: "#0f172a", fontWeight: 700 }}>{activeOrderChat.buyerName || "Buyer"}</div>
                  <div style={{ color: "#64748b", fontSize: "12px" }}>
                    {activeOrderChat.orderName || "Order"} • Order chat
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeOrderChat}
                  style={{
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                    borderRadius: "10px",
                    padding: "6px 10px",
                    cursor: "pointer",
                    color: "#334155",
                    fontWeight: 700
                  }}
                >
                  ✕
                </button>
              </div>

              <div ref={chatScrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
                {normalizedChatMessages.length === 0 ? (
                  <div style={{ textAlign: "center", marginTop: "28px", color: "#64748b" }}>
                    No messages yet. Start the conversation.
                  </div>
                ) : (
                  normalizedChatMessages.map((message, index) => {
                    const isSeller = message.sender === "seller";
                    return (
                      <div
                        key={`${message.timestamp}-${index}`}
                        style={{
                          display: "flex",
                          justifyContent: isSeller ? "flex-end" : "flex-start",
                          marginBottom: "10px"
                        }}
                      >
                        <div
                          style={{
                            maxWidth: "78%",
                            borderRadius: "12px",
                            padding: "8px 10px",
                            background: isSeller ? "#dcf8c6" : "#ffffff",
                            boxShadow: "0 1px 1px rgba(0,0,0,0.1)"
                          }}
                        >
                          <div style={{ color: "#0f172a", fontSize: "14px", lineHeight: 1.42 }}>{message.text}</div>
                          <div style={{ color: "#64748b", fontSize: "10px", marginTop: "4px", textAlign: "right" }}>
                            {formatDateTime(message.timestamp)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div
                style={{
                  borderTop: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  padding: "10px",
                  display: "flex",
                  gap: "8px"
                }}
              >
                <input
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendSellerMessage();
                    }
                  }}
                  placeholder="Type a message"
                  style={{
                    flex: 1,
                    border: "1px solid #cbd5e1",
                    borderRadius: "999px",
                    padding: "10px 14px",
                    outline: "none",
                    fontSize: "14px"
                  }}
                />
                <button
                  type="button"
                  onClick={sendSellerMessage}
                  style={{
                    border: "none",
                    background: "#22c55e",
                    color: "#fff",
                    borderRadius: "999px",
                    padding: "0 16px",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const formatCurrency = formatKsh;

  const formatDate = (date) => {
    if (!date) return "—";
    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString();
  };

  useEffect(() => {
    if (showWithdrawModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [showWithdrawModal]);

  const resetWithdrawForm = () => {
    setAmount("");
    setMethod("BANK");
    setBankAccount("");
    setPaypalEmail("");
    setStripeId("");
    setMpesaPhone("");
    setWithdrawErrors("");
    setWithdrawPhase("form");
    setWithdrawMessage("");
  };

  const closeWithdrawModal = () => {
    setShowWithdrawModal(false);
    resetWithdrawForm();
  };

  const handleWithdraw = () => {
    setWithdrawErrors("");
    setShowWithdrawModal(true);
  };

  const handleWithdrawSubmit = (e) => {
    e.preventDefault();
    setWithdrawErrors("");

    const parsedAmount = Number(amount);
    const available = Number(statValues.availableBalance || 0);

    if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setWithdrawErrors("Please enter a valid withdrawal amount greater than 0.");
      return;
    }

    if (parsedAmount > available) {
      setWithdrawErrors("Amount exceeds available balance.");
      return;
    }

    if (!method) {
      setWithdrawErrors("Please select a payout method.");
      return;
    }

    if (method === "BANK" && !bankAccount.trim()) {
      setWithdrawErrors("Bank account / IBAN is required.");
      return;
    }

    if (method === "PAYPAL" && !paypalEmail.trim()) {
      setWithdrawErrors("PayPal Email is required.");
      return;
    }

    if (method === "STRIPE" && !stripeId.trim()) {
      setWithdrawErrors("Stripe Account ID is required.");
      return;
    }

    if (method === "MPESA") {
      const phone = mpesaPhone.trim().replace(/\s+/g, "");
      if (!/^(\+254|254|0)?[17]\d{8}$/.test(phone)) {
        setWithdrawErrors("Enter a valid M-Pesa phone number (e.g. 0712345678).");
        return;
      }
    }

    const details = {
      bankAccount: method === "BANK" ? bankAccount.trim() : "",
      paypalEmail: method === "PAYPAL" ? paypalEmail.trim() : "",
      stripeId: method === "STRIPE" ? stripeId.trim() : "",
      mpesaPhone: method === "MPESA" ? mpesaPhone.trim() : ""
    };

    const payoutDetails =
      method === "BANK"
        ? details.bankAccount
        : method === "PAYPAL"
          ? details.paypalEmail
          : method === "MPESA"
            ? details.mpesaPhone
            : details.stripeId;

    const token = localStorage.getItem("authToken");
    const apiRoot = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";
    fetch(`${apiRoot}/api/wallet/withdraw/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Token ${token}` : "",
      },
      body: JSON.stringify({
        amount: parsedAmount,
        payout_method: method,
        payout_details: payoutDetails,
        phone_number: method === "MPESA" ? mpesaPhone.trim() : "",
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Withdrawal request failed.");
        }
        const data = await res.json();
        const withdrawalId = data?.withdrawal?.id;
        setWithdrawPhase("processing");
        setWithdrawMessage("Processing withdrawal...");
        loadWallet();

        const poll = async (attempts = 0) => {
          if (attempts > 20) {
            setWithdrawPhase("failed");
            setWithdrawMessage("Withdrawal timed out. Check withdrawal history.");
            return;
          }
          const rows = await fetchWithdrawals();
          setWithdrawals(rows);
          const current = rows.find((w) => w.id === withdrawalId) || rows[0];
          if (current?.status === "completed") {
            setWithdrawPhase("success");
            setWithdrawMessage(`Withdrawal successful. Reference: ${current.reference_id || current.mpesa_receipt || "—"}`);
            loadWallet();
            return;
          }
          if (current?.status === "failed") {
            setWithdrawPhase("failed");
            setWithdrawMessage(current.failed_reason || "Withdrawal failed.");
            loadWallet();
            return;
          }
          setTimeout(() => poll(attempts + 1), 1000);
        };
        poll();
      })
      .catch((err) => {
        setWithdrawErrors(err.message || "Withdrawal request failed.");
      });
  };

  const renderEarnings = () => {
    const escrowOrders = safeOrders.filter((order) => {
      const s = normalizeEscrowStatus(order?.status);
      return [ESCROW_STATUS.PAID, ESCROW_STATUS.PROCESSING, ESCROW_STATUS.SHIPPED, ESCROW_STATUS.DELIVERED].includes(s);
    });

    return (
      <div style={{ display: "grid", gap: "18px" }}>
        <div
          style={{
            background: "#ffffff",
            borderRadius: "14px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
            padding: "18px"
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "14px",
              flexWrap: "wrap"
            }}
          >
            <div>
              <h1 style={{ margin: 0, color: "#0f172a", fontSize: "28px", lineHeight: 1.2 }}>Seller Dashboard</h1>
              <h2 style={{ margin: "6px 0 8px", color: "#1e293b", fontSize: "20px" }}>Earnings</h2>
              <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
                Funds are held in escrow until buyers confirm delivery.
              </p>
            </div>

            <button
              type="button"
              onClick={handleWithdraw}
              style={{
                border: "none",
                borderRadius: "10px",
                background: "#16a34a",
                color: "#ffffff",
                padding: "11px 16px",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 10px 20px rgba(22,163,74,0.25)",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              <span aria-hidden="true">👛</span>
              <span>Withdraw funds</span>
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "16px"
          }}
        >
          <div
            style={{
              borderRadius: "12px",
              padding: "18px",
              background: "linear-gradient(135deg, #0d9488 0%, #2563eb 100%)",
              color: "#ffffff",
              boxShadow: "0 14px 28px rgba(37,99,235,0.25)"
            }}
          >
            <div style={{ fontSize: "22px", marginBottom: "10px" }}>👛</div>
            <div style={{ fontSize: "14px", opacity: 0.95, marginBottom: "8px" }}>Available balance</div>
            <div style={{ fontSize: "32px", fontWeight: 800, lineHeight: 1.15 }}>
              {formatCurrency(statValues.availableBalance)}
            </div>
            <div style={{ marginTop: "12px", fontSize: "13px", opacity: 0.95 }}>
              Released, ready to withdraw
            </div>
          </div>

          <div
            style={{
              borderRadius: "12px",
              padding: "18px",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              boxShadow: "0 8px 22px rgba(15, 23, 42, 0.06)"
            }}
          >
            <div style={{ fontSize: "22px", marginBottom: "10px" }}>🔒</div>
            <div style={{ fontSize: "14px", color: "#64748b", marginBottom: "8px" }}>Escrow balance</div>
            <div style={{ fontSize: "32px", fontWeight: 800, color: "#0f172a", lineHeight: 1.15 }}>
              {formatCurrency(statValues.inEscrow)}
            </div>
            <div style={{ marginTop: "12px", fontSize: "13px", color: "#64748b" }}>
              Held until buyers confirm delivery
            </div>
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 8px 22px rgba(15, 23, 42, 0.06)",
            padding: "18px"
          }}
        >
          <h3 style={{ margin: "0 0 12px", color: "#0f172a" }}>Withdrawal History</h3>
          {withdrawals.length === 0 ? (
            <div
              style={{
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                padding: "22px",
                textAlign: "center",
                color: "#64748b"
              }}
            >
              {walletLoading ? "Loading..." : "No withdrawal requests yet"}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                    <th style={{ padding: "10px", borderBottom: "1px solid #e2e8f0" }}>Date</th>
                    <th style={{ padding: "10px", borderBottom: "1px solid #e2e8f0" }}>Amount</th>
                    <th style={{ padding: "10px", borderBottom: "1px solid #e2e8f0" }}>Method</th>
                    <th style={{ padding: "10px", borderBottom: "1px solid #e2e8f0" }}>Status</th>
                    <th style={{ padding: "10px", borderBottom: "1px solid #e2e8f0" }}>Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((w) => (
                    <tr key={w.id}>
                      <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9" }}>{formatDate(w.created_at)}</td>
                      <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9" }}>{formatKsh(w.amount)}</td>
                      <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9" }}>
                        {w.payout_method || w.method || "—"}
                      </td>
                      <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9" }}>
                        {w.display_status || w.status}
                      </td>
                      <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9" }}>
                        {w.reference_id || w.mpesa_receipt || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div
          style={{
            background: "#ffffff",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 8px 22px rgba(15, 23, 42, 0.06)",
            padding: "18px"
          }}
        >
          <h3 style={{ margin: "0 0 12px", color: "#0f172a" }}>Escrow Transactions</h3>

          {escrowOrders.length === 0 ? (
            <div
              style={{
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                padding: "20px",
                color: "#64748b",
                textAlign: "center"
              }}
            >
              No escrow transactions.
            </div>
          ) : (
            <div style={{ display: "grid", gap: "10px" }}>
              {escrowOrders.map((order, index) => {
                const orderId = resolveOrderId(order) || `escrow-${index}`;
                const orderTitle = resolveProductName(order);
                const orderDate = order?.createdAt || order?.created_at || order?.timestamp || order?.orderDate || "";
                const orderAmount = Number(order?.price ?? order?.productPrice ?? order?.total ?? order?.amount ?? 0);

                return (
                  <div
                    key={orderId}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      padding: "12px 14px",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "12px",
                      alignItems: "center",
                      flexWrap: "wrap"
                    }}
                  >
                    <div style={{ minWidth: "180px" }}>
                      <div style={{ marginBottom: "6px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            borderRadius: "999px",
                            border: "1px solid #d1d5db",
                            background: "#f3f4f6",
                            color: "#374151",
                            fontSize: "11px",
                            letterSpacing: "0.04em",
                            fontWeight: 800,
                            padding: "3px 9px"
                          }}
                        >
                          HOLD
                        </span>
                      </div>
                      <div style={{ color: "#0f172a", fontWeight: 700 }}>{orderTitle}</div>
                      <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "2px" }}>
                        {formatDate(orderDate)}
                      </div>
                    </div>

                    <div style={{ marginLeft: "auto", color: "#0f172a", fontWeight: 800, fontSize: "16px" }}>
                      {formatCurrency(orderAmount)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDisputes = () => (
    <div
      style={{
        background: "white",
        borderRadius: "16px",
        padding: "20px",
        boxShadow: "0 10px 28px rgba(15, 23, 42, 0.08)",
        border: "1px solid #eef2f7"
      }}
    >
      <h2 style={{ margin: 0, color: "#0f172a" }}>My Disputes</h2>
      <p style={{ margin: "6px 0 20px", color: "#64748b", fontSize: "14px" }}>
        Track open and resolved disputes. Funds stay locked until resolution.
      </p>
      <div style={{ display: "grid", gap: 14 }}>
        {apiDisputes.length === 0 ? (
          <p style={{ color: "#64748b", margin: 0 }}>No disputes found.</p>
        ) : (
          apiDisputes.map((d) => (
            <DisputeCard key={d.id} dispute={d} view="seller" detailLink={`/seller/disputes/${d.id}`} />
          ))
        )}
      </div>
    </div>
  );

  const renderReviews = () => {
    const avg =
      sellerReviews.length > 0
        ? (sellerReviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / sellerReviews.length).toFixed(1)
        : "—";

    return (
      <div
        style={{
          background: "white",
          borderRadius: "16px",
          padding: "20px",
          boxShadow: "0 10px 28px rgba(15, 23, 42, 0.08)",
          border: "1px solid #eef2f7"
        }}
      >
        <h2 style={{ margin: 0, color: "#0f172a" }}>Reviews & Feedback</h2>
        <p style={{ margin: "6px 0 16px", color: "#64748b", fontSize: "14px" }}>
          Buyer reviews for your store.
        </p>
        <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ padding: "14px 18px", background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Average Rating</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#0f172a" }}>{avg}</div>
          </div>
          <div style={{ padding: "14px 18px", background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Total Reviews</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#0f172a" }}>{sellerReviews.length}</div>
          </div>
        </div>
        {sellerReviews.length === 0 ? (
          <p style={{ color: "#64748b", margin: 0 }}>No reviews yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {sellerReviews.map((review) => (
              <div
                key={review.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: 14,
                  background: "#fafafa"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <strong style={{ color: "#0f172a" }}>
                    {"★".repeat(Math.min(5, Number(review.rating || 0)))} {review.buyer_username || "Buyer"}
                  </strong>
                  <span style={{ color: "#64748b", fontSize: "0.85rem" }}>
                    {review.created_at ? new Date(review.created_at).toLocaleDateString() : ""}
                  </span>
                </div>
                <p style={{ margin: "8px 0 4px", color: "#334155" }}>{review.review_text || "No comment."}</p>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "#94a3b8" }}>
                  Order #{review.order_id} • {review.product_title || "Order"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderMessages = () => <MessagesPage role="seller" />;

  const renderSection = () => {
    switch (activeSection) {
      case "overview":
        return renderOverview();
      case "add-listing":
        return <SellerDashboard />;
      case "orders":
        return renderOrders();
      case "earnings":
        return renderEarnings();
      case "disputes":
        return renderDisputes();
      case "reviews":
        return renderReviews();
      case "messages":
        return renderMessages();
      case "trust":
        return <SellerTrustPanel />;
      default:
        return renderOverview();
    }
  };

  const payoutMethods = ["BANK", "PAYPAL", "STRIPE", "MPESA"];

  const renderWithdrawDetailField = () => {
    const commonInputStyle = {
      width: "100%",
      border: "1px solid #d1d5db",
      borderRadius: "10px",
      padding: "11px 12px",
      background: "#f9fafb",
      fontSize: "14px",
      color: "#111827",
      outline: "none",
      boxSizing: "border-box"
    };

    if (method === "BANK") {
      return (
        <div style={{ display: "grid", gap: "6px" }}>
          <label style={{ fontSize: "13px", color: "#374151", fontWeight: 600 }}>Bank account / IBAN</label>
          <input
            value={bankAccount}
            onChange={(e) => setBankAccount(e.target.value)}
            placeholder="Enter bank account or IBAN"
            style={commonInputStyle}
          />
        </div>
      );
    }

    if (method === "PAYPAL") {
      return (
        <div style={{ display: "grid", gap: "6px" }}>
          <label style={{ fontSize: "13px", color: "#374151", fontWeight: 600 }}>PayPal Email</label>
          <input
            value={paypalEmail}
            onChange={(e) => setPaypalEmail(e.target.value)}
            placeholder="name@example.com"
            style={commonInputStyle}
          />
        </div>
      );
    }

    if (method === "STRIPE") {
      return (
        <div style={{ display: "grid", gap: "6px" }}>
          <label style={{ fontSize: "13px", color: "#374151", fontWeight: 600 }}>Stripe Account ID</label>
          <input
            value={stripeId}
            onChange={(e) => setStripeId(e.target.value)}
            placeholder="acct_**************"
            style={commonInputStyle}
          />
        </div>
      );
    }

    if (method === "MPESA") {
      return (
        <div style={{ display: "grid", gap: "6px" }}>
          <label style={{ fontSize: "13px", color: "#374151", fontWeight: 600 }}>M-Pesa Phone Number</label>
          <input
            value={mpesaPhone}
            onChange={(e) => setMpesaPhone(e.target.value)}
            placeholder="0712345678"
            style={commonInputStyle}
          />
        </div>
      );
    }

    return null;
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>
      <div style={{ maxWidth: "1440px", margin: "0 auto", padding: "20px" }}>
        <div style={{ display: "flex", gap: "20px" }}>
          <aside
            style={{
              width: "260px",
              minHeight: "calc(100vh - 40px)",
              background: "#0f172a",
              borderRadius: "18px",
              padding: "20px 14px",
              position: "sticky",
              top: "20px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between"
            }}
          >
            <div>
              <h3 style={{ color: "white", margin: "4px 10px 18px" }}>Seller Workspace</h3>
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => (item.route ? navigate(item.route) : setActiveSection(item.id))}
                  style={{
                    width: "100%",
                    border: "none",
                    borderRadius: "12px",
                    padding: "12px 14px",
                    marginBottom: "8px",
                    textAlign: "left",
                    cursor: "pointer",
                    color: activeSection === item.id ? "#0f172a" : "#cbd5e1",
                    background: activeSection === item.id ? "#bbf7d0" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    fontWeight: 600
                  }}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            <div style={{ borderTop: "1px solid rgba(148,163,184,0.35)", paddingTop: "14px", marginTop: "16px" }}>
              <p style={{ margin: "0 0 4px 0", color: "white", fontWeight: 700, wordBreak: "break-word" }}>{username}</p>
              <p style={{ margin: "0 0 12px 0", color: "#94a3b8", fontSize: "14px" }}>Seller</p>
              <button
                onClick={handleLogout}
                style={{
                  width: "100%",
                  border: "none",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  background: "#ef4444",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 700
                }}
              >
                Logout
              </button>
            </div>
          </aside>

          <main style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Link
                  to="/dashboard"
                  style={{
                    textDecoration: "none",
                    background: "#475569",
                    color: "white",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    fontWeight: 600
                  }}
                >
                  ← Dashboard
                </Link>
                <button
                  onClick={() => setActiveSection("add-listing")}
                  style={{
                    border: "none",
                    background: "#16a34a",
                    color: "white",
                    padding: "12px 18px",
                    borderRadius: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 8px 20px rgba(22,163,74,0.25)"
                  }}
                >
                  Add Listing
                </button>
              </div>

              <div style={{ fontWeight: 700, color: "#0f172a" }}>{username}</div>
            </div>

            {error && (
              <div
                style={{
                  background: "#fee2e2",
                  color: "#991b1b",
                  border: "1px solid #fecaca",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  marginBottom: "12px"
                }}
              >
                {error}
              </div>
            )}

            {renderSection()}
          </main>
        </div>
      </div>

      {showWithdrawModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "18px",
            zIndex: 3000
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "560px",
              background: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 30px 70px rgba(2, 6, 23, 0.35)",
              padding: "24px",
              maxHeight: "92vh",
              overflowY: "auto"
            }}
          >
            <button
              type="button"
              onClick={closeWithdrawModal}
              style={{
                border: "none",
                background: "transparent",
                color: "#16a34a",
                fontWeight: 700,
                cursor: "pointer",
                padding: 0,
                marginBottom: "14px",
                fontSize: "14px"
              }}
            >
              ← Back to earnings
            </button>

            <h2 style={{ margin: "0 0 6px", color: "#0f172a", fontSize: "28px", lineHeight: 1.2 }}>Withdraw funds</h2>
            <p style={{ margin: "0 0 18px", color: "#64748b", fontSize: "14px" }}>
              Available to withdraw: {formatCurrency(statValues.availableBalance)}
            </p>

            {withdrawPhase !== "form" ? (
              <div style={{ textAlign: "center", padding: "24px 12px" }}>
                <p
                  style={{
                    fontSize: "16px",
                    fontWeight: 600,
                    color:
                      withdrawPhase === "success"
                        ? "#166534"
                        : withdrawPhase === "failed"
                          ? "#b91c1c"
                          : "#1e40af",
                    marginBottom: "16px"
                  }}
                >
                  {withdrawMessage}
                </p>
                {(withdrawPhase === "success" || withdrawPhase === "failed") && (
                  <button
                    type="button"
                    onClick={closeWithdrawModal}
                    style={{
                      border: "none",
                      background: "#16a34a",
                      color: "#ffffff",
                      borderRadius: "10px",
                      padding: "10px 16px",
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    Done
                  </button>
                )}
              </div>
            ) : (
            <form onSubmit={handleWithdrawSubmit} style={{ display: "grid", gap: "14px" }}>
              <div style={{ display: "grid", gap: "6px" }}>
                <label style={{ fontSize: "13px", color: "#374151", fontWeight: 600 }}>Amount (Ksh)</label>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  type="number"
                  min="0"
                  step="0.01"
                  style={{
                    width: "100%",
                    border: "1px solid #d1d5db",
                    borderRadius: "10px",
                    padding: "11px 12px",
                    background: "#f9fafb",
                    fontSize: "14px",
                    color: "#111827",
                    outline: "none",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              <div style={{ display: "grid", gap: "8px" }}>
                <div style={{ fontSize: "13px", color: "#374151", fontWeight: 600 }}>Payout method</div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {payoutMethods.map((option) => {
                    const isActive = method === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setMethod(option)}
                        style={{
                          border: isActive ? "1px solid #16a34a" : "1px solid #d1d5db",
                          background: isActive ? "#dcfce7" : "#ffffff",
                          color: isActive ? "#15803d" : "#475569",
                          borderRadius: "999px",
                          padding: "8px 12px",
                          fontSize: "13px",
                          fontWeight: 700,
                          cursor: "pointer"
                        }}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>

              {renderWithdrawDetailField()}

              {withdrawErrors && (
                <div
                  style={{
                    borderRadius: "10px",
                    background: "#fee2e2",
                    border: "1px solid #fecaca",
                    color: "#991b1b",
                    padding: "10px 12px",
                    fontSize: "13px"
                  }}
                >
                  {withdrawErrors}
                </div>
              )}

              <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#6b7280", lineHeight: 1.5 }}>
                Funds in escrow are not eligible for withdrawal until released by the buyer.
              </p>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={closeWithdrawModal}
                  style={{
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    color: "#334155",
                    borderRadius: "10px",
                    padding: "10px 14px",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    border: "none",
                    background: "#16a34a",
                    color: "#ffffff",
                    borderRadius: "10px",
                    padding: "10px 16px",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 10px 22px rgba(22,163,74,0.25)"
                  }}
                >
                  Request Withdrawal
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}

      <TrustDetailModal
        open={trustModal.open}
        onClose={() => setTrustModal({ open: false, trust: null, loading: false, title: "", role: "buyer" })}
        title={trustModal.title}
        trust={trustModal.trust}
        role={trustModal.role}
        loading={trustModal.loading}
      />
    </div>
  );
}

export default SellerAccount;
