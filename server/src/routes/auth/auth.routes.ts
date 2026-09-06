import { Router } from "express";
import type { Response } from "express";
import rateLimit from "express-rate-limit";
import { OAuth2Client } from "google-auth-library";
import prisma from "../../db";
import { AppError } from "../../utils/AppError";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok, fail } from "../../utils/envelope";
import { validate } from "../../utils/validate";
import { requireAuth, getDbUserFromReq } from "../../middleware/auth";
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiry,
  setRefreshCookie,
  clearRefreshCookie,
  REFRESH_COOKIE_NAME,
} from "../../utils/auth";
import { registerSchema, loginSchema, googleSchema } from "../../validators/auth";
import type { User } from "../../generated/prisma/client";

export const authRouter = Router();

const googleClient = new OAuth2Client();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json(fail("Too many attempts, please try again later.", "RATE_LIMITED"));
  },
});

function adminEmailSet() {
  return new Set(
    (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

function roleForEmail(email: string) {
  return adminEmailSet().has(email.toLowerCase()) ? "admin" : "user";
}

function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    points: user.points,
  };
}

async function issueSession(res: Response, user: User) {
  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashRefreshToken(refreshToken),
      userId: user.id,
      expiresAt: refreshTokenExpiry(),
    },
  });

  setRefreshCookie(res, refreshToken);
  return accessToken;
}

authRouter.post(
  "/register",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { name, email, password } = validate(registerSchema, req.body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError(409, "Email is already registered");
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        role: roleForEmail(email),
      },
    });

    const accessToken = await issueSession(res, user);
    res.status(201).json(ok({ accessToken, user: publicUser(user) }));
  }),
);

authRouter.post(
  "/login",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = validate(loginSchema, req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      throw new AppError(401, "Invalid email or password");
    }

    const passwordMatches = await verifyPassword(password, user.passwordHash);
    if (!passwordMatches) {
      throw new AppError(401, "Invalid email or password");
    }

    const accessToken = await issueSession(res, user);
    res.status(200).json(ok({ accessToken, user: publicUser(user) }));
  }),
);

authRouter.post(
  "/google",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { credential } = validate(googleSchema, req.body);

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email || !payload.sub) {
      throw new AppError(401, "Could not verify Google account");
    }

    const email = payload.email.toLowerCase();
    const googleId = payload.sub;

    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId }, { email }] },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          googleId,
          name: payload.name ?? null,
          role: roleForEmail(email),
        },
      });
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId },
      });
    }

    const accessToken = await issueSession(res, user);
    res.status(200).json(ok({ accessToken, user: publicUser(user) }));
  }),
);

authRouter.post(
  "/refresh",
  authLimiter,
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!token) {
      throw new AppError(401, "Authentication required");
    }

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(token) },
      include: { user: true },
    });

    if (!stored || stored.expiresAt.getTime() < Date.now()) {
      if (stored) {
        await prisma.refreshToken.delete({ where: { id: stored.id } });
      }
      clearRefreshCookie(res);
      throw new AppError(401, "Session expired, please log in again");
    }

    await prisma.refreshToken.delete({ where: { id: stored.id } });

    const accessToken = await issueSession(res, stored.user);
    res.status(200).json(ok({ accessToken, user: publicUser(stored.user) }));
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await getDbUserFromReq(req);
    res.status(200).json(ok({ user: publicUser(user) }));
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (token) {
      await prisma.refreshToken.deleteMany({
        where: { tokenHash: hashRefreshToken(token) },
      });
    }

    clearRefreshCookie(res);
    res.status(200).json(ok({ message: "Logged out" }));
  }),
);
