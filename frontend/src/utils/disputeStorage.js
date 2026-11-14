const STORAGE_KEY = "buyerDisputes";

const safeParseArray = (raw) => {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const getDisputes = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  return safeParseArray(raw || "[]");
};

export const saveDisputes = (disputes) => {
  const safeDisputes = Array.isArray(disputes) ? disputes : [];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safeDisputes));
  return safeDisputes;
};

export const upsertDispute = (dispute) => {
  if (!dispute || !dispute.id) return getDisputes();

  const existing = getDisputes();
  const index = existing.findIndex((item) => item.id === dispute.id);

  let next;
  if (index === -1) {
    next = [dispute, ...existing];
  } else {
    next = [...existing];
    next[index] = { ...next[index], ...dispute };
  }

  return saveDisputes(next);
};

export const upsertDisputeByOrderId = (dispute) => {
  if (!dispute || !dispute.orderId) return getDisputes();

  const existing = getDisputes();
  const index = existing.findIndex((item) => item.orderId === dispute.orderId);

  let next;
  if (index === -1) {
    next = [dispute, ...existing];
  } else {
    next = [...existing];
    next[index] = { ...next[index], ...dispute };
  }

  return saveDisputes(next);
};
