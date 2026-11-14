const STORAGE_KEY = "conversations";

const safeParse = (value, fallback) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export const getCurrentUser = () => {
  const user = safeParse(localStorage.getItem("user") || "{}", {});
  return user || {};
};

export const getBuyerId = () => {
  const user = getCurrentUser();
  return String(user?.id ?? user?.userId ?? user?.username ?? "buyer-anon");
};

export const buildConversationId = ({ buyerId, sellerId, orderId, productId }) => {
  const safeBuyer = String(buyerId ?? "buyer-anon");
  const safeSeller = String(sellerId ?? "seller-unknown");
  const orderOrProduct = String(orderId ?? productId ?? "general");
  return `${safeBuyer}_${safeSeller}_${orderOrProduct}`;
};

export const getConversations = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = safeParse(raw || "[]", []);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((conversation) => ({
      ...conversation,
      messages: Array.isArray(conversation.messages)
        ? [...conversation.messages].sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          )
        : [],
      lastActivity: conversation.lastActivity || new Date(0).toISOString()
    }))
    .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
};

export const saveConversations = (conversations) => {
  const safeConversations = Array.isArray(conversations) ? conversations : [];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safeConversations));
  return safeConversations;
};

export const ensureConversation = (context) => {
  const buyerId = String(context?.buyerId ?? getBuyerId());
  const sellerId = String(context?.sellerId ?? "seller-unknown");
  const orderId = context?.orderId ?? null;
  const productId = context?.productId ?? null;

  const conversationId = buildConversationId({ buyerId, sellerId, orderId, productId });
  const existing = getConversations();
  const found = existing.find((c) => c.conversationId === conversationId);
  if (found) return found;

  const now = new Date().toISOString();
  const created = {
    conversationId,
    buyerId,
    sellerId,
    sellerName: context?.sellerName || "Seller",
    sellerAvatar: context?.sellerAvatar || "",
    orderId,
    productId,
    orderName: context?.orderName || context?.productName || "Untitled Order",
    orderType: context?.orderType || "Product",
    messages: [],
    lastActivity: now
  };

  const next = [created, ...existing];
  saveConversations(next);
  return created;
};

export const upsertConversation = (conversation) => {
  if (!conversation?.conversationId) return null;

  const existing = getConversations();
  const index = existing.findIndex((item) => item.conversationId === conversation.conversationId);

  const merged = {
    ...(index >= 0 ? existing[index] : {}),
    ...conversation,
    messages: Array.isArray(conversation.messages)
      ? [...conversation.messages].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      : Array.isArray(existing[index]?.messages)
        ? existing[index].messages
        : [],
    lastActivity:
      conversation.lastActivity ||
      existing[index]?.lastActivity ||
      new Date().toISOString()
  };

  let next;
  if (index === -1) {
    next = [merged, ...existing];
  } else {
    next = [...existing];
    next[index] = merged;
  }

  saveConversations(next);
  return merged;
};

export const appendMessage = (conversationId, message) => {
  const all = getConversations();
  const now = new Date().toISOString();
  const next = all.map((conversation) => {
    if (conversation.conversationId !== conversationId) return conversation;

    const updatedMessages = [...(conversation.messages || []), message].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return {
      ...conversation,
      messages: updatedMessages,
      lastActivity: message?.timestamp || now
    };
  });

  saveConversations(next);
  return next.find((c) => c.conversationId === conversationId) || null;
};

export const formatDateTime = (iso) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
};

export const getLastMessagePreview = (conversation) => {
  const messages = conversation?.messages || [];
  if (!messages.length) return "No messages yet";
  const last = messages[messages.length - 1];
  return last?.text || "No messages yet";
};
