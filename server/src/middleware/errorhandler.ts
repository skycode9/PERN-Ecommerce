import type { Request, Response, NextFunction } from "express";
import { MulterError } from "multer";
import { AppError } from "../utils/AppError";
import { fail } from "../utils/envelope";
import logger from "../utils/logger";

const uploadErrorMessages: Partial<Record<MulterError["code"], string>> = {
  LIMIT_FILE_SIZE: "Image is too large (max 5 MB)",
  LIMIT_FILE_COUNT: "Too many images in one upload",
  LIMIT_UNEXPECTED_FILE: "Unexpected upload field",
};

// some libraries (cloudinary for one) reject with plain objects instead of Error instances
function describeError(err: unknown) {
  if (err instanceof Error) return err.stack ?? err.message;

  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(fail(err.message, "APP_ERROR"));
  }

  if (err instanceof MulterError) {
    const message = uploadErrorMessages[err.code] ?? "Image upload failed";
    return res.status(400).json(fail(message, "UPLOAD_ERROR"));
  }

  logger.error(`${req.method} ${req.originalUrl} failed: ${describeError(err)}`);

  return res.status(500).json(fail("Internal server error", "INTERNAL"));
}
