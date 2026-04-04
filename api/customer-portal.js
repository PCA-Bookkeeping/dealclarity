import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { customerId, email } = body;

    if (!customerId && !email) {
      return res.status(400).json({ error: "Customer ID or email is required." });
    }

    // Look up customer by email if no customerId provided
    let stripeCustomerId = customerId;
    if (!stripeCustomerId && email) {
      const customers = await stripe.customers.list({ email, limit: 1 });
      if (customers.data.length === 0) {
        return res.status(404).json({ error: "No subscription found for this email." });
      }
      stripeCustomerId = customers.data[0].id;
    }

    // Create a Stripe Customer Portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${process.env.VITE_APP_URL || "https://dealclarity.vercel.app"}`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Customer portal error:", err.message);
    res.status(500).json({ error: "Failed to open subscription management. Please try again." });
  }
}
