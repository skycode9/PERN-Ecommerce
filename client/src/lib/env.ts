export const env = {
  backendUrl: import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8080",
  stripePublishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "",
};
