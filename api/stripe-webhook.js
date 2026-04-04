import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// Helper: find Supabase user by Stripe customer ID or email
async function findUser(stripeCustomerId, email) {
  // First try by stripe_customer_id in profiles (fastest)
  if (stripeCustomerId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("stripe_customer_id", stripeCustomerId)
      .single();
    if (profile) return profile.id;
  }
  // Fallback: look up by email in auth
  if (email) {
    const { data: userData } = await supabase.auth.admin.listUsers();
    const user = userData?.users?.find(u => u.email === email);
    if (user) return user.id;
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const rawBody = await getRawBody(req);
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook sig failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // ── CHECKOUT COMPLETED: New purchase ──
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const customerEmail = session.customer_details?.email;

      if (!customerEmail) {
        console.error("Webhook: No email in checkout session", session.id);
        return res.json({ received: true, warning: "no_email" });
      }

      const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ["line_items.data.price"],
      });
      const priceId = fullSession.line_items?.data?.[0]?.price?.id;
      const isLifetime = priceId === process.env.STRIPE_LIFETIME_PRICE_ID;
      const isAnnual = priceId === process.env.STRIPE_ANNUAL_PRICE_ID;
      const proType = isLifetime ? "lifetime" : isAnnual ? "annual" : "monthly";

      const userId = await findUser(session.customer, customerEmail);
      if (userId) {
        await supabase.from("profiles").update({
          is_pro: true,
          pro_type: proType,
          stripe_customer_id: session.customer,
        }).eq("id", userId);
      } else {
        console.error("Webhook: No user for email:", customerEmail);
      }
    }

    // ── SUBSCRIPTION UPDATED: Plan change, renewal, trial end ──
    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object;
      const stripeCustomerId = subscription.customer;

      const userId = await findUser(stripeCustomerId);
      if (userId) {
        const isActive = ["active", "trialing"].includes(subscription.status);
        const priceId = subscription.items?.data?.[0]?.price?.id;
        const isAnnual = priceId === process.env.STRIPE_ANNUAL_PRICE_ID;
        const proType = isAnnual ? "annual" : "monthly";

        await supabase.from("profiles").update({
          is_pro: isActive,
          pro_type: isActive ? proType : null,
        }).eq("id", userId);
      }
    }

    // ── SUBSCRIPTION DELETED: Cancellation or expiration ──
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const stripeCustomerId = subscription.customer;

      const userId = await findUser(stripeCustomerId);
      if (userId) {
        // Check if this user has a lifetime purchase (don't downgrade lifetime users)
        const { data: profile } = await supabase
          .from("profiles")
          .select("pro_type")
          .eq("id", userId)
          .single();

        if (profile?.pro_type !== "lifetime") {
          await supabase.from("profiles").update({
            is_pro: false,
            pro_type: null,
          }).eq("id", userId);
        }
      }
    }

    // ── INVOICE PAYMENT FAILED: Warn but don't immediately revoke ──
    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;
      console.error("Payment failed for customer:", invoice.customer, "amount:", invoice.amount_due);
      // Stripe will automatically retry. Pro status stays until subscription is actually deleted.
    }

  } catch (err) {
    console.error("Webhook processing error:", err.message);
    return res.status(500).json({ error: "Webhook processing failed" });
  }

  res.json({ received: true });
}
