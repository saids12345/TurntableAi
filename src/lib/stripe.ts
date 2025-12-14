// src/lib/stripe.ts
import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) throw new Error("Missing STRIPE_SECRET_KEY");

export const stripe = new Stripe(secretKey, {
  // Use the version your Stripe SDK expects (your editor suggested this one)
  apiVersion: "2025-11-17.clover",
});
