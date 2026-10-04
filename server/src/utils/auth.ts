import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Response } from "express";
import type { Role } from "../generated/prisma/enums";
import { AppError } from "./AppError";

const BCRYPT_COST = 12;
const ACCESS_TOKEN_TTL_SECONDS = 60 * 15;
const REFRESH_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export const REFRESH_COOKIE_NAME = "refreshToken";
const REFRESH_COOKIE_PATH = `${process.env.API_PREFIX ?? ""}/auth`;

export type AccessTokenPayload = {
  sub: string;
  role: Role;
};

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return secret;
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), {
    algorithm: "HS256",
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });

  if (typeof decoded === "string") {
    throw new AppError(401, "Invalid or expired token");
  }

  const { sub, role } = decoded;
  if (typeof sub !== "string" || (role !== "user" && role !== "admin")) {
    throw new AppError(401, "Invalid or expired token");
  }

  return { sub, role };
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString("hex");
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function refreshTokenExpiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: REFRESH_COOKIE_PATH,
  });
}
