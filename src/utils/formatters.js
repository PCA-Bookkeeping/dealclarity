// ═══════════════════════════════════════════════════════════════
// DealClarity – Formatting & Utility Functions
// Extracted from App.jsx for modularity (Phase 1.6)
// ═══════════════════════════════════════════════════════════════

export const fmt = (n) =>
  n == null || isNaN(n)
    ? "$0"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(n);

export const fmtK = (n) =>
  n == null || isNaN(n)
    ? "$0"
    : Math.abs(n) >= 1000
    ? `$${(n / 1000).toFixed(0)}k`
    : fmt(n);

export const fp = (n) =>
  n == null || isNaN(n) ? "0%" : `${n.toFixed(1)}%`;

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// Input sanitizer — prevents negative values on financial fields
export const sanitizeNum = (v, allowNeg = false) => {
  const n = parseFloat(v);
  if (isNaN(n)) return 0;
  return allowNeg ? n : Math.max(0, n);
};
