import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { formatDateTime } from "../../utils/messageStorage";

function ChatWindow({ conversation, onConversationUpdated, currentUserId, role, token, loadingConversation = false }) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);
  const scrollRef = useRef(null);
  const API_BASE = "http://127.0.0.1:8000/api/marketplace";

  const orderedMessages = useMemo(() => {
    const safe = Array.isArray(messages) ? messages : [];
    return [...safe].sort((a, b) => new Date(a?.timestamp).getTime() - new Date(b?.timestamp).getTime());
  }, [messages]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [orderedMessages.length, conversation?.id]);

  const otherUserId = conversation?.other_user_id;
  const primaryConversationId = conversation?.primary_conversation_id || conversation?.id;

  useEffect(() => {
    const load = async () => {
      if (!token) {
        setMessages([]);
        return;
      }

      const threadId = otherUserId || conversation?.id;
      if (!threadId) {
        setMessages([]);
        return;
      }

      try {
        const url = otherUserId
          ? `${API_BASE}/conversations/thread/${otherUserId}/messages/`
          : `${API_BASE}/conversations/${conversation.id}/messages/`;
        const { data } = await axios.get(url, {
          headers: { Authorization: `Token ${token}` }
        });
        setMessages(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("LOAD_MESSAGES_ERROR:", err.response?.status, err.response?.data || err.message);
      }
    };
    load();
  }, [otherUserId, conversation?.id, token]);

  useEffect(() => {
    if (!primaryConversationId || !token) return undefined;

    const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${wsProtocol}://127.0.0.1:8000/ws/chat/${primaryConversationId}/?token=${token}`);

    ws.onmessage = (event) => {
      try {
        const incoming = JSON.parse(event.data);
        setMessages((prev) => {
          const safePrev = Array.isArray(prev) ? prev : [];

          // If we previously appended an optimistic message, drop it once the server echo arrives.
          const next = safePrev.filter((m) => {
            if (!m?.__optimistic) return true;
            const sameText = String(m?.text || m?.message || "") === String(incoming?.text || incoming?.message || "");
            const sameSender =
              String(m?.sender ?? m?.sender_id ?? "") === String(incoming?.sender ?? incoming?.sender_id ?? "");
            if (!sameText || !sameSender) return true;

            const t1 = new Date(m?.timestamp || 0).getTime();
            const t2 = new Date(incoming?.timestamp || 0).getTime();
            if (!t1 || !t2) return false;
            return Math.abs(t2 - t1) > 3000;
          });

          return [...next, incoming];
        });
        onConversationUpdated?.(primaryConversationId);
      } catch (err) {
        console.error("WS_PARSE_ERROR:", err);
      }
    };

    ws.onerror = (err) => console.error("WS_ERROR:", err);
    setSocket(ws);

    return () => {
      ws.close();
      setSocket(null);
    };
  }, [primaryConversationId, token, onConversationUpdated]);

  const send = async () => {
    const text = draft.trim();
    if (!text) return;

    // Always clear draft immediately for "instant send" feel.
    setDraft("");

    // Optimistic UI: show the message instantly even before WS echo.
    const optimisticTimestamp = new Date().toISOString();
    if (conversation?.id) {
      const optimistic = {
        __optimistic: true,
        conversation: conversation.id,
        sender: currentUserId,
        sender_id: currentUserId,
        text,
        message: text,
        timestamp: optimisticTimestamp
      };
      setMessages((prev) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        return [...safePrev, optimistic];
      });
    }

    // Prefer WebSocket when ready, otherwise fallback to REST (same backend endpoint).
    if (primaryConversationId && socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ message: text }));
      return;
    }

    if (!token || (!conversation?.order && !otherUserId)) return;

    try {
      const { data } = await axios.post(
        `${API_BASE}/messages/chat/`,
        {
          order_id: conversation?.order,
          other_user_id: otherUserId,
          conversation_id: primaryConversationId,
          message: text,
        },
        { headers: { Authorization: `Token ${token}` } }
      );

      // Ensure persistence state: replace the optimistic message with the saved message.
      if (data?.id) {
        setMessages((prev) => {
          const safePrev = Array.isArray(prev) ? prev : [];
          const withoutOptimistic = safePrev.filter((m) => {
            if (!m?.__optimistic) return true;
            const sameText = String(m?.text || m?.message || "") === String(text);
            const sameSender = String(m?.sender ?? m?.sender_id ?? "") === String(currentUserId);
            const t1 = new Date(m?.timestamp || 0).getTime();
            const t2 = new Date(optimisticTimestamp || 0).getTime();
            if (!sameText || !sameSender) return true;
            if (!t1 || !t2) return false;
            return Math.abs(t1 - t2) > 3000;
          });
          return [...withoutOptimistic, data];
        });
      }
    } catch (err) {
      console.error("SEND_MESSAGE_ERROR:", err.response?.status, err.response?.data || err.message);
    }
  };

  if (!conversation) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", backgroundColor: "#efeae2" }}>
        <div
          style={{
            backgroundColor: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
            padding: "10px 14px",
            display: "grid",
            gridTemplateColumns: "42px 1fr",
            gap: "10px",
            alignItems: "center"
          }}
        >
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "50%",
              overflow: "hidden",
              backgroundColor: "#cbd5e1"
            }}
          />
          <div>
            <div style={{ color: "#0f172a", fontWeight: 700 }}>Messages</div>
            <div style={{ color: "#475569", fontSize: "12px" }}>Select a conversation to start chatting</div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "18px 16px" }}>
          <div style={{ color: "#64748b", textAlign: "center", marginTop: "20px" }}>
            Select a conversation to start chatting
          </div>
        </div>

        <div style={{ borderTop: "1px solid #e2e8f0", backgroundColor: "#f8fafc", padding: "10px", display: "flex", gap: "8px" }}>
          <button
            type="button"
            title="Attachment (coming soon)"
            style={{
              border: "1px solid #cbd5e1",
              backgroundColor: "#fff",
              borderRadius: "8px",
              width: "40px",
              cursor: "not-allowed",
              color: "#64748b"
            }}
          >
            📎
          </button>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a message"
            disabled
            style={{
              flex: 1,
              border: "1px solid #cbd5e1",
              borderRadius: "999px",
              padding: "10px 14px",
              outline: "none",
              backgroundColor: "#f1f5f9"
            }}
          />
          <button
            type="button"
            onClick={send}
            disabled
            style={{
              border: "none",
              backgroundColor: "#94a3b8",
              color: "#fff",
              borderRadius: "999px",
              padding: "0 14px",
              cursor: "not-allowed",
              fontWeight: 700
            }}
          >
            ➤
          </button>
        </div>
      </div>
    );
  }

  const avatarUrl =
    (role === "seller" ? conversation?.buyerAvatar : conversation?.sellerAvatar) ||
    conversation?.sellerAvatar ||
    conversation?.buyerAvatar ||
    "";

  const displayName =
    conversation?.other_user_name ||
    (role === "seller" ? conversation?.buyer_name : conversation?.seller_name);
  const displayInitial = (displayName || "S").slice(0, 1).toUpperCase();
  const lastActivity = conversation?.last_activity ? formatDateTime(conversation.last_activity) : "";

  const handleSend = (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (e?.stopPropagation) e.stopPropagation();
    send();
  };

  return (
    <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", backgroundColor: "#efeae2" }}>
      <div
        style={{
          flexShrink: 0,
          backgroundColor: "#f8fafc",
          borderBottom: "1px solid #e2e8f0",
          padding: "10px 14px",
          display: "grid",
          gridTemplateColumns: "42px 1fr",
          gap: "10px",
          alignItems: "center"
        }}
      >
        <div
          style={{
            width: "42px",
            height: "42px",
            borderRadius: "50%",
            overflow: "hidden",
            backgroundColor: "#cbd5e1",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#334155",
            fontWeight: 700
          }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={conversation?.seller_name || conversation?.sellerName || "Chat"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            displayInitial
          )}
        </div>
        <div>
          <div style={{ color: "#0f172a", fontWeight: 700 }}>{displayName || (role === "seller" ? "Buyer" : "Seller")}</div>
          <div style={{ color: "#475569", fontSize: "12px" }}>
            {(conversation?.order_name || "Order")} • {loadingConversation ? "Opening chat..." : `Last active: ${lastActivity}`}
          </div>
        </div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "18px 16px" }}>
        {orderedMessages.length === 0 ? (
          <div style={{ color: "#64748b", textAlign: "center", marginTop: "20px" }}>
            No messages yet. Say hello to the seller.
          </div>
        ) : (
          orderedMessages.map((message, index) => {
            const isMine = String(message?.sender) === String(currentUserId) || String(message?.sender_id) === String(currentUserId);
            const orderRef = message?.conversation_order_name || message?.order_name;
            return (
              <div
                key={`${message?.timestamp || "t"}-${index}`}
                style={{
                  display: "flex",
                  justifyContent: isMine ? "flex-end" : "flex-start",
                  marginBottom: "8px"
                }}
              >
                <div
                  style={{
                    maxWidth: "78%",
                    backgroundColor: isMine ? "#dcf8c6" : "#ffffff",
                    borderRadius: "10px",
                    padding: "8px 10px",
                    boxShadow: "0 1px 1px rgba(0,0,0,0.08)"
                  }}
                >
                  {orderRef && (
                    <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>Re: {orderRef}</div>
                  )}
                  <div style={{ color: "#0f172a", fontSize: "14px", lineHeight: 1.4 }}>{message?.text || message?.message || ""}</div>
                  <div style={{ color: "#64748b", fontSize: "10px", textAlign: "right", marginTop: "4px" }}>
                    {formatDateTime(message?.timestamp)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div style={{ flexShrink: 0, borderTop: "1px solid #e2e8f0", backgroundColor: "#f8fafc", padding: "10px", display: "flex", gap: "8px" }}>
        <button
          type="button"
          title="Attachment (coming soon)"
          style={{
            border: "1px solid #cbd5e1",
            backgroundColor: "#fff",
            borderRadius: "8px",
            width: "40px",
            cursor: "not-allowed",
            color: "#64748b"
          }}
        >
          📎
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend(e);
            }
          }}
          placeholder="Type a message"
          disabled={false}
          style={{
            flex: 1,
            border: "1px solid #cbd5e1",
            borderRadius: "999px",
            padding: "10px 14px",
            outline: "none",
            backgroundColor: "#fff",
            pointerEvents: "auto"
          }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={false}
          style={{
            border: "none",
            backgroundColor: "#22c55e",
            color: "#fff",
            borderRadius: "999px",
            padding: "0 14px",
            cursor: "pointer",
            fontWeight: 700,
            pointerEvents: "auto"
          }}
        >
          ➤
        </button>
      </div>
    </div>
  );
}

export default ChatWindow;
