import { Router, type Request, type Response } from "express";
import prisma from "../../db";
import { requireAdmin, requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireFound, requireText } from "../../utils/helpers";
import { AppError } from "../../utils/AppError";
import { ok } from "../../utils/envelope";
import type { Promo } from "../../generated/prisma/client";

export const adminPromoRouter = Router();

adminPromoRouter.use(requireAuth, requireAdmin);

function mapPromo(item: Promo) {
  return {
    id: item.id,
    code: item.code,
    percentage: item.percentage,
    count: item.count,
    minimumOrderValue: item.minimumOrderValue,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    createdAt: item.createdAt,
  };
}

async function listPromos() {
  const promos = await prisma.promo.findMany({ orderBy: { createdAt: "desc" } });

  return { items: promos.map(mapPromo) };
}

function parsePromoPayload(req: Request) {
  const code = String(req.body.code || "")
    .trim()
    .toUpperCase();
  const percentage = Number(req.body.percentage);
  const count = Number(req.body.count);
  const minimumOrderValue = Number(req.body.minimumOrderValue);
  const startsAt = new Date(req.body.startsAt);
  const endsAt = new Date(req.body.endsAt);

  requireText(code, "Promo code is required");

  if (Number.isNaN(percentage) || percentage < 1 || percentage > 100) {
    throw new AppError(400, "Percentage must be between 1 and 100");
  }

  if (!Number.isInteger(count) || count < 1) {
    throw new AppError(400, "Promo count must be at least 1");
  }

  if (Number.isNaN(minimumOrderValue) || minimumOrderValue < 0) {
    throw new AppError(400, "Minimum order value must be 0 or more");
  }

  if (Number.isNaN(startsAt.getTime())) {
    throw new AppError(400, "Valid start time is required");
  }

  if (Number.isNaN(endsAt.getTime())) {
    throw new AppError(400, "Valid end time is required");
  }

  if (endsAt <= startsAt) {
    throw new AppError(400, "End time should be after start time");
  }

  return { code, percentage, count, minimumOrderValue, startsAt, endsAt };
}

adminPromoRouter.get(
  "/promos",
  asyncHandler(async (_req: Request, res: Response) => {
    res.json(ok(await listPromos()));
  }),
);

adminPromoRouter.post(
  "/promos",
  asyncHandler(async (req: Request, res: Response) => {
    const payload = parsePromoPayload(req);

    const existing = await prisma.promo.findUnique({
      where: { code: payload.code },
    });

    if (existing) {
      throw new AppError(400, "Promo code already exists");
    }

    await prisma.promo.create({ data: payload });

    res.json(ok(await listPromos()));
  }),
);

adminPromoRouter.patch(
  "/promos/:promoId",
  asyncHandler(async (req: Request, res: Response) => {
    const promoId = String(req.params.promoId || "").trim();
    requireText(promoId, "Promo id is required");

    const payload = parsePromoPayload(req);

    const promo = await prisma.promo.findUnique({ where: { id: promoId } });
    requireFound(promo, "Promo not found", 404);

    const duplicate = await prisma.promo.findFirst({
      where: { code: payload.code, id: { not: promoId } },
    });

    if (duplicate) {
      throw new AppError(400, "Promo code already exists");
    }

    await prisma.promo.update({ where: { id: promoId }, data: payload });

    res.json(ok(await listPromos()));
  }),
);

adminPromoRouter.delete(
  "/promos/:promoId",
  asyncHandler(async (req: Request, res: Response) => {
    const promoId = String(req.params.promoId || "").trim();
    requireText(promoId, "Promo id is required");

    const promo = await prisma.promo.findUnique({ where: { id: promoId } });
    requireFound(promo, "Promo not found", 404);

    await prisma.promo.delete({ where: { id: promoId } });

    res.json(ok(await listPromos()));
  }),
);
