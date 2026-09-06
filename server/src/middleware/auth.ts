import type { Request, Response, NextFunction } from "express";
import prisma from "../db";
import { AppError } from "../utils/AppError";
import { asyncHandler } from "../utils/asyncHandler";
import { verifyAccessToken, type AccessTokenPayload } from "../utils/auth";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return next(new AppError(401, "Authentication required"));
  }

  const token = header.slice("Bearer ".length).trim();

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(new AppError(401, "Invalid or expired token"));
  }
}

export async function getDbUserFromReq(req: Request) {
  if (!req.user) {
    throw new AppError(401, "Authentication required");
  }

  const dbUser = await prisma.user.findUnique({ where: { id: req.user.sub } });

  if (!dbUser) {
    throw new AppError(404, "User not found");
  }

  return dbUser;
}

export const requireAdmin = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== "admin") {
      throw new AppError(403, "Admin access only");
    }

    next();
  },
);
