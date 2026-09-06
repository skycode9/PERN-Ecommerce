import "dotenv/config";
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

const app = express();

const isProd = process.env.NODE_ENV === "production";

const corsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(cors({ origin: corsOrigins, credentials: true }));
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
app.use(globalLimiter);

app.get("/health", (_req, res) => {
  res.json(ok({ uptime: process.uptime(), timestamp: new Date().toISOString() }));
});

app.use("/auth", authRouter);
app.use("/customer", customerHomeRouter);
app.use("/customer", customerProductRouter);
app.use("/customer", customerAddressRouter);
app.use("/customer", customerCartWishlistRouter);
app.use("/admin", adminProductRouter);

app.use(notFound);
app.use(errorHandler);

const port = process.env.PORT ?? 8080;

app.listen(port, () => {
  logger.info(`server listening on port ${port}`);
});

export default app;
