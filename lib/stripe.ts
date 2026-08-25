import Stripe from "stripe";

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it in Vercel project settings, not in code."
    );
  }
  return new Stripe(key, { apiVersion: "2025-02-24.acacia" });
}
