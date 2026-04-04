import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Map plan names to Stripe price IDs from environment variables
const PLAN_TO_PRICE = {
  monthly: process.env.STRIPE_MONTHLY_PRICE_ID,
  annual: process.env.STRIPE_ANNUAL_PRICE_ID,
  lifetime: process.env.STRIPE_LIFETIME_PRICE_ID,
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const body = JSON.parse(req.body);
    // Support both { plan, email } (new) and { priceId, email } (legacy)
    const email = body.email;
    const priceId = body.priceId || PLAN_TO_PRICE[body.plan];

    if (!priceId) {
      return res.status(400).json({ error: "Invalid plan. Use: monthly, annual, or lifetime." });
    }
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const isLifetime = priceId === process.env.STRIPE_LIFETIME_PRICE_ID;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: isLifetime ? "payment" : "subscription",
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.VITE_APP_URL || "https://dealclarity.vercel.app"}?upgraded=true`,
      cancel_url: `${process.env.VITE_APP_URL || "https://dealclarity.vercel.app"}`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Checkout error:", err.message);
    res.status(500).json({ error: "Failed to create checkout session. Please try again." });
  }
}
