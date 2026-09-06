import Stripe from "stripe";

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }

  return value;
}

export const stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"));

export const CHECKOUT_CURRENCY = "usd";

// prices are stored in whole units; Stripe expects the smallest currency unit
export function toMinorUnits(amount: number) {
  return Math.round(amount * 100);
}
