import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { priceId, email } = JSON.parse(req.body);
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: priceId === process.env.STRIPE_LIFETIME_PRICE_ID ? "payment" : "subscription",
    customer_email: email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.VITE_APP_URL || "https://dealclarity.vercel.app"}?upgraded=true`,
    cancel_url: `${process.env.VITE_APP_URL || "https://dealclarity.vercel.app"}`,
  });
  res.json({ url: session.url });
}