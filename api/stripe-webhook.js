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
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const customerEmail = session.customer_details?.email;
    const priceId = session.line_items?.data?.[0]?.price?.id;
    const isLifetime = priceId === process.env.STRIPE_LIFETIME_PRICE_ID;
    const isAnnual = priceId === process.env.STRIPE_ANNUAL_PRICE_ID;
    const proType = isLifetime ? "lifetime" : isAnnual ? "annual" : "monthly";
    if (customerEmail) {
      const { data: userData } = await supabase.auth.admin.listUsers();
      const user = userData?.users?.find(u => u.email === customerEmail);
      if (user) {
        await supabase.from("profiles").update({
          is_pro: true,
          pro_type: proType,
          stripe_customer_id: session.customer
        }).eq("id", user.id);
      }
    }
  }
  res.json({ received: true });
}