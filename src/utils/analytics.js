// ═══════════════════════════════════════════════════════════════
// DealClarity – Analytics Event Tracking
// Phase 1.7: Lightweight event system for Vercel Analytics
// ═══════════════════════════════════════════════════════════════

// Safely fire custom events — no-ops if Vercel Analytics isn't loaded
export function trackEvent(name, data = {}) {
  try {
    // Vercel Web Analytics custom events
    if (typeof window !== "undefined" && window.va) {
      window.va("event", { name, ...data });
    }
    // Also log to console in dev for debugging
    if (import.meta.env.DEV) {
      console.log(`[DC Analytics] ${name}`, data);
    }
  } catch {
    // Silently fail — analytics should never break the app
  }
}

// Pre-defined event names for consistency
export const EVENTS = {
  DEAL_CALCULATED: "deal_calculated",
  DEAL_SAVED: "deal_saved",
  DEAL_REMOVED: "deal_removed",
  PDF_EXPORTED: "pdf_exported",
  PRO_MODAL_OPENED: "pro_modal_opened",
  CHECKOUT_STARTED: "checkout_started",
  PRO_ACTIVATED: "pro_activated",
  LANGUAGE_TOGGLED: "language_toggled",
  PAGE_VIEWED: "page_viewed",
  AUTH_SIGNUP: "auth_signup",
  AUTH_SIGNIN: "auth_signin",
  COMPARE_USED: "compare_used",
  SENSITIVITY_RUN: "sensitivity_run",
  SPLITS_CALCULATED: "splits_calculated",
  TEMPLATE_LOADED: "template_loaded",
};
