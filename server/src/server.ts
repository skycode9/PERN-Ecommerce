import "dotenv/config";
import express from "express";
import helmet from "helmet";
import hpp from "hpp";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import logger, { morganStream } from "./utils/logger";
import { ok } from "./utils/envelope";
import { notFound } from "./middleware/notFound";
import { errorHandler } from "./middleware/errorhandler";

const app = express();

const isProd = process.env.NODE_ENV === "production";

app.use(helmet());
app.use(express.json({ limit: "10kb" }));
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

app.use(notFound);
app.use(errorHandler);

const port = process.env.PORT ?? 8080;

app.listen(port, () => {
  logger.info(`server listening on port ${port}`);
});

export default app;
