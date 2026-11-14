/**
 * Kenyan Shilling formatting for Eco-Campus marketplace.
 */
export function formatKsh(value, { compact = false } = {}) {
  const num = Number(value || 0);
  if (compact && num >= 1000) {
    return `Ksh ${num.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
  }
  return `Ksh ${num.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatKES(value) {
  const num = Number(value || 0);
  return `KES ${num.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

/** @deprecated Use formatKsh */
export function formatCurrency(value) {
  return formatKsh(value);
}
