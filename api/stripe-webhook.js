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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const rawBody = await getRawBody(req);
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const customerEmail = session.customer_details?.email;

    if (!customerEmail) {
      console.error("Webhook: No customer email found in session", session.id);
      return res.json({ received: true, warning: "no_email" });
    }

    try {
      // Retrieve the session with line_items expanded (they're not included by default)
      const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ["line_items.data.price"],
      });
      const priceId = fullSession.line_items?.data?.[0]?.price?.id;
      const isLifetime = priceId === process.env.STRIPE_LIFETIME_PRICE_ID;
      const isAnnual = priceId === process.env.STRIPE_ANNUAL_PRICE_ID;
      const proType = isLifetime ? "lifetime" : isAnnual ? "annual" : "monthly";

      const { data: userData, error: listError } = await supabase.auth.admin.listUsers();
      if (listError) {
        console.error("Webhook: Failed to list users:", listError.message);
        return res.status(500).json({ error: "Failed to look up user" });
      }

      const user = userData?.users?.find(u => u.email === customerEmail);
      if (user) {
        const { error: updateError } = await supabase.from("profiles").update({
          is_pro: true,
          pro_type: proType,
          stripe_customer_id: session.customer,
        }).eq("id", user.id);

        if (updateError) {
          console.error("Webhook: Failed to update profile:", updateError.message);
          return res.status(500).json({ error: "Failed to update profile" });
        }
      } else {
        console.error("Webhook: No user found for email:", customerEmail);
      }
    } catch (err) {
      console.error("Webhook processing error:", err.message);
      return res.status(500).json({ error: "Webhook processing failed" });
    }
  }

  res.json({ received: true });
}
