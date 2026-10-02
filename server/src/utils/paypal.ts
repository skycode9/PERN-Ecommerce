import { Client, Environment, OrdersController } from "@paypal/paypal-server-sdk";

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }

  return value;
}

const client = new Client({
  clientCredentialsAuthCredentials: {
    oAuthClientId: requireEnv("PAYPAL_CLIENT_ID"),
    oAuthClientSecret: requireEnv("PAYPAL_CLIENT_SECRET"),
  },
  environment: process.env.PAYPAL_ENV === "live" ? Environment.Production : Environment.Sandbox,
});

export const paypalOrders = new OrdersController(client);

export const PAYPAL_CURRENCY = "USD";

// PayPal takes amounts as decimal strings, e.g. "49.00"
export function toPaypalAmount(amount: number) {
  return amount.toFixed(2);
}
