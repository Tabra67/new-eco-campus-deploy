import { formatDateTime, getLastMessagePreview } from "../../utils/messageStorage";

function ConversationList({ conversations, selectedId, onSelect, role = "buyer" }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#ffffff",
        borderRight: "1px solid #e2e8f0",
        overflowY: "auto"
      }}
    >
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #e2e8f0", fontWeight: 700, color: "#0f172a" }}>
        Messages
      </div>

      {conversations.length === 0 ? (
        <div style={{ padding: "20px", color: "#64748b", fontSize: "14px" }}>
          No conversations yet.
        </div>
      ) : (
        conversations.map((conversation) => {
          const threadKey = conversation.thread_key || String(conversation.other_user_id || conversation.id);
          const active = String(selectedId) === String(threadKey);
          const displayName =
            role === "seller"
              ? conversation.other_user_name || conversation.buyer_name || "Buyer"
              : conversation.other_user_name || conversation.seller_name || "Seller";
          const initial = (displayName || "U").slice(0, 1).toUpperCase();
          const unread = Number(conversation.unread_count || 0);

          return (
            <button
              key={threadKey}
              type="button"
              onClick={() => onSelect(conversation)}
              style={{
                width: "100%",
                textAlign: "left",
                border: "none",
                borderBottom: "1px solid #f1f5f9",
                backgroundColor: active ? "#f1f5f9" : "#ffffff",
                cursor: "pointer",
                padding: "12px 14px",
                display: "grid",
                gridTemplateColumns: "48px 1fr",
                gap: "10px"
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
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
                {initial}
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", marginBottom: "4px" }}>
                  <div
                    style={{
                      fontWeight: 700,
                      color: "#0f172a",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis"
                    }}
                  >
                    {displayName}
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748b", whiteSpace: "nowrap" }}>
                    {formatDateTime(conversation.last_activity || conversation.lastActivity)}
                  </div>
                </div>
                <div
                  style={{
                    color: "#64748b",
                    fontSize: "12px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {conversation.last_message || getLastMessagePreview(conversation)}
                  </span>
                  {unread > 0 && (
                    <span
                      style={{
                        background: "#16a34a",
                        color: "#fff",
                        borderRadius: 999,
                        padding: "2px 7px",
                        fontSize: 11,
                        fontWeight: 700,
                        flexShrink: 0
                      }}
                    >
                      {unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}

export default ConversationList;
