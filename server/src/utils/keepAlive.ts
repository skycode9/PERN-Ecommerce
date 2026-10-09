import logger from "./logger";

const DEFAULT_INTERVAL_MS = 14 * 60 * 1000 + 59 * 1000;

// free hosting puts the service to sleep after 15 minutes without traffic, so the app
// requests its own public url before that happens
export function startKeepAlive(): void {
  const url = process.env.KEEP_ALIVE_URL;
  if (!url) return;

  const intervalMs = Number(process.env.KEEP_ALIVE_INTERVAL_MS) || DEFAULT_INTERVAL_MS;

  setInterval(() => {
    fetch(url, { method: "HEAD", signal: AbortSignal.timeout(30_000) })
      .then((res) => {
        if (!res.ok) logger.warn(`keep-alive got ${res.status} from ${url}`);
      })
      .catch((error: unknown) => {
        logger.warn(`keep-alive request failed: ${String(error)}`);
      });
  }, intervalMs);

  logger.info(`keep-alive pinging ${url} every ${Math.round(intervalMs / 1000)}s`);
}
