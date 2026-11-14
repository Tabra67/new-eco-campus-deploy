
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useLocation } from "react-router-dom";
import ConversationList from "./ConversationList";
import ChatWindow from "./ChatWindow";
import { getCurrentUser } from "../../utils/messageStorage";

const API_ROOT = (
  process.env.REACT_APP_API_URL ||
  "https://new-eco-campus-deploy.onrender.com"
).replace(/\/+$/, "");

const API_BASE = `${API_ROOT}/api/marketplace`;

function MessagesPage({ preselectContext, role = "buyer" }) {
  const [conversations, setConversations] = useState([]);
  const [selectedThreadKey, setSelectedThreadKey] = useState(null);
  const [loading, setLoading] = useState(true);

  const location = useLocation();
  const token = localStorage.getItem("authToken");
  const currentUser = getCurrentUser();

  const currentUserId = String(
    currentUser?.id ??
      currentUser?.userId ??
      currentUser?.username ??
      ""
  );

  const query = new URLSearchParams(location.search);
  const orderIdFromQuery = query.get("orderId");
  const buyerIdFromQuery = query.get("buyerId");
  const sellerIdFromQuery = query.get("sellerId");

  const contextOrderId = preselectContext?.orderId
    ? String(preselectContext.orderId)
    : null;

  const initialOrderId = orderIdFromQuery || contextOrderId;

  const fetchConversations = async () => {
    if (!token) return [];

    const { data } = await axios.get(`${API_BASE}/conversations/`, {
      headers: { Authorization: `Token ${token}` }
    });

    const safe = Array.isArray(data) ? data : [];
    setConversations(safe);

    return safe;
  };

  const threadKeyForConversation = (conv) =>
    String(
      conv?.thread_key ||
        conv?.other_user_id ||
        conv?.id ||
        ""
    );

  useEffect(() => {
    const sync = async () => {
      if (!token) return;

      setLoading(true);

      try {
        if (initialOrderId) {
          try {
            await axios.post(
              `${API_BASE}/conversations/ensure/`,
              {
                order_id: Number(initialOrderId),
                buyer_id:
                  buyerIdFromQuery ||
                  preselectContext?.buyerId ||
                  null,
                seller_id:
                  sellerIdFromQuery ||
                  preselectContext?.sellerId ||
                  null
              },
              {
                headers: { Authorization: `Token ${token}` }
              }
            );
          } catch (err) {
            console.error(
              "ENSURE_CONVERSATION_ERROR:",
              err.response?.status,
              err.response?.data || err.message
            );
          }
        }

        const latest = await fetchConversations();

        if (!latest?.length) return;

        if (initialOrderId) {
          const selected = latest.find(
            (c) => String(c.order) === String(initialOrderId)
          );

          if (selected) {
            setSelectedThreadKey(
              threadKeyForConversation(selected)
            );
            return;
          }
        }

        const otherFromContext =
          role === "seller"
            ? buyerIdFromQuery || preselectContext?.buyerId
            : sellerIdFromQuery || preselectContext?.sellerId;

        if (otherFromContext) {
          const byUser = latest.find(
            (c) =>
              String(c.other_user_id) === String(otherFromContext)
          );

          if (byUser) {
            setSelectedThreadKey(
              threadKeyForConversation(byUser)
            );
            return;
          }
        }

        setSelectedThreadKey(
          (prev) => prev || threadKeyForConversation(latest[0])
        );
      } catch (err) {
        console.error(
          "MESSAGES_SYNC_ERROR:",
          err.response?.status,
          err.response?.data || err.message
        );
      } finally {
        setLoading(false);
      }
    };

    sync();
  }, [
    initialOrderId,
    buyerIdFromQuery,
    sellerIdFromQuery,
    preselectContext,
    token,
    role
  ]);

  useEffect(() => {
    if (selectedThreadKey) return;
    if (!conversations.length) return;

    setSelectedThreadKey(
      threadKeyForConversation(conversations[0])
    );
  }, [conversations, selectedThreadKey]);

  const selectedConversation = useMemo(() => {
    if (!selectedThreadKey) return null;

    return (
      conversations.find(
        (item) =>
          threadKeyForConversation(item) ===
          String(selectedThreadKey)
      ) || null
    );
  }, [conversations, selectedThreadKey]);

  const fallbackConversation = useMemo(() => {
    if (selectedConversation) return selectedConversation;
    if (!initialOrderId) return null;

    const otherId =
      role === "seller"
        ? buyerIdFromQuery || preselectContext?.buyerId
        : sellerIdFromQuery || preselectContext?.sellerId;

    return {
      id: null,
      thread_key: otherId ? String(otherId) : "pending",
      other_user_id: otherId,
      order: Number(initialOrderId),
      buyer_name: preselectContext?.buyerName || "Buyer",
      seller_name: preselectContext?.sellerName || "Seller",
      other_user_name:
        role === "seller"
          ? preselectContext?.buyerName
          : preselectContext?.sellerName,
      order_name: preselectContext?.orderName || "Order",
      last_activity: new Date().toISOString()
    };
  }, [
    selectedConversation,
    initialOrderId,
    preselectContext,
    role,
    buyerIdFromQuery,
    sellerIdFromQuery
  ]);

  const handleSelect = (conversation) => {
    setSelectedThreadKey(
      threadKeyForConversation(conversation)
    );
  };

  const handleConversationUpdated = async () => {
    const latest = await fetchConversations();

    if (!selectedThreadKey && latest?.[0]) {
      setSelectedThreadKey(
        threadKeyForConversation(latest[0])
      );
    }
  };

  return (
    <div
      style={{
        height: "min(72vh, 720px)",
        minHeight: "420px",
        maxHeight: "calc(100vh - 220px)",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        overflow: "hidden",
        backgroundColor: "#fff",
        display: "flex",
        flexDirection: "row"
      }}
    >
      <div
        style={{
          width: "340px",
          minWidth: "260px",
          maxWidth: "40%",
          borderRight: "1px solid #e2e8f0",
          minHeight: 0,
          overflow: "hidden"
        }}
      >
        <ConversationList
          conversations={conversations}
          selectedId={selectedThreadKey}
          onSelect={handleSelect}
          role={role}
        />
      </div>

      <div
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: "flex",
          flexDirection: "column"
        }}
      >
        <ChatWindow
          conversation={fallbackConversation}
          onConversationUpdated={handleConversationUpdated}
          currentUserId={currentUserId}
          role={role}
          token={token}
          loadingConversation={loading}
        />
      </div>
    </div>
  );
}

export default MessagesPage;
