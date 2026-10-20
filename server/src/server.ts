import "dotenv/config";
import path from "node:path";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import hpp from "hpp";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import logger, { morganStream } from "./utils/logger";
import { ok } from "./utils/envelope";
import { notFound } from "./middleware/notFound";
import { errorHandler } from "./middleware/errorhandler";
import { authRouter } from "./routes/auth/auth.routes";
import { adminProductRouter } from "./routes/admin/product.routes";
import { customerHomeRouter } from "./routes/customer/home.routes";
import { customerProductRouter } from "./routes/customer/product.routes";
import { customerAddressRouter } from "./routes/customer/address.routes";
import { customerCartWishlistRouter } from "./routes/customer/cart-wishlist.routes";
import { customerCheckoutRouter, stripeWebhookHandler } from "./routes/customer/checkout.routes";
import { customerCheckoutWithPointsRouter } from "./routes/customer/checkout-with-points.routes";
import { customerCheckoutPaypalRouter } from "./routes/customer/checkout-paypal.routes";
import { customerPromoRouter } from "./routes/customer/promo.routes";
import { adminPromoRouter } from "./routes/admin/promo.routes";
import { adminOrderRouter } from "./routes/admin/orders.routes";
import { adminSettingsRouter } from "./routes/admin/settings.routes";
import { adminDashboardRouter } from "./routes/admin/dashboard.routes";
import { customerOrderRouter } from "./routes/customer/orders.routes";
import { startKeepAlive } from "./utils/keepAlive";

const app = express();

const isProd = process.env.NODE_ENV === "production";

// in the single image the api lives under /api and the react build is served from CLIENT_DIR
const apiPrefix = process.env.API_PREFIX ?? "";
const clientDir = process.env.CLIENT_DIR;

const corsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// behind nginx / a load balancer the client ip comes from X-Forwarded-For
app.set("trust proxy", Number(process.env.TRUST_PROXY) || 0);

app.use(
  helmet({
    // the storefront loads Stripe, PayPal and Google scripts and remote product images
    contentSecurityPolicy: false,
    // Google and PayPal sign-in open popups that need to talk back to the page
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  }),
);
app.use(cors({ origin: corsOrigins, credentials: true }));

// Stripe webhook needs the untouched request body to verify the signature, so
// it is mounted with a raw parser before the JSON body parser runs.
app.post(
  `${apiPrefix}/customer/checkout/webhook`,
  express.raw({ type: "application/json" }),
  stripeWebhookHandler,
);

app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());
app.use(hpp());
app.use(morgan(isProd ? "combined" : "dev", { stream: morganStream }));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

const api = express.Router();

// registered before the limiter: the platform health checker polls this from one ip
api.get("/health", (_req, res) => {
  res.json(ok({ uptime: process.uptime(), timestamp: new Date().toISOString() }));
});

api.use(globalLimiter);

api.use("/auth", authRouter);
api.use("/customer", customerHomeRouter);
api.use("/customer", customerProductRouter);
api.use("/customer", customerAddressRouter);
api.use("/customer", customerCartWishlistRouter);
api.use("/customer", customerCheckoutRouter);
api.use("/customer", customerCheckoutWithPointsRouter);
api.use("/customer", customerCheckoutPaypalRouter);
api.use("/customer", customerPromoRouter);
api.use("/customer", customerOrderRouter);
api.use("/admin", adminProductRouter);
api.use("/admin", adminPromoRouter);
api.use("/admin", adminOrderRouter);
api.use("/admin", adminSettingsRouter);
api.use("/admin", adminDashboardRouter);

app.use(apiPrefix || "/", api);

if (clientDir) {
  const indexHtml = path.join(clientDir, "index.html");

  app.use(
    "/assets",
    express.static(path.join(clientDir, "assets"), { immutable: true, maxAge: "1y" }),
  );
  app.use(express.static(clientDir, { index: false }));

  // every other GET is a client-side route, so it gets the react app
  app.get("/{*splat}", (req, res, next) => {
    if (apiPrefix && req.path.startsWith(`${apiPrefix}/`)) return next();
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(indexHtml);
  });
}

app.use(notFound);
app.use(errorHandler);

const port = process.env.PORT ?? 8080;

app.listen(port, () => {
  logger.info(`server listening on port ${port}`);
  startKeepAlive();
});

export default app;
