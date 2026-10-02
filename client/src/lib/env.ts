export const env = {
  backendUrl: import.meta.env.VITE_BACKEND_URL || "http://localhost:8080",
  stripePublishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "",
  paypalClientId: import.meta.env.VITE_PAYPAL_CLIENT_ID ?? "",
  demoMode: import.meta.env.VITE_DEMO_MODE === "true",
};
