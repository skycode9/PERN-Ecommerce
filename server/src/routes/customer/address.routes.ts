import { Router, type Request, type Response } from "express";
import prisma from "../../db";
import { getDbUserFromReq, requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireText } from "../../utils/helpers";
import { ok } from "../../utils/envelope";
import { AppError } from "../../utils/AppError";
import type { Address } from "../../generated/prisma/client";

function mapAddress(item: Address) {
  return {
    id: item.id,
    fullName: item.fullName,
    address: item.address,
    state: item.state,
    postalCode: item.postalCode,
    isDefault: item.isDefault,
  };
}

async function listAddresses(userId: string) {
  const addresses = await prisma.address.findMany({
    where: { userId },
    orderBy: { isDefault: "desc" },
  });

  return { items: addresses.map(mapAddress) };
}

export const customerAddressRouter = Router();

customerAddressRouter.use(requireAuth);

customerAddressRouter.get(
  "/addresses",
  asyncHandler(async (req: Request, res: Response) => {
    const user = await getDbUserFromReq(req);

    res.json(ok(await listAddresses(user.id)));
  }),
);

customerAddressRouter.post(
  "/addresses",
  asyncHandler(async (req: Request, res: Response) => {
    const user = await getDbUserFromReq(req);

    const fullName = String(req.body.fullName || "").trim();
    const address = String(req.body.address || "").trim();
    const state = String(req.body.state || "").trim();
    const postalCode = String(req.body.postalCode || "").trim();

    requireText(fullName, "Full name is required");
    requireText(address, "Address is required");
    requireText(state, "State is required");
    requireText(postalCode, "Postal code is required");

    const existingCount = await prisma.address.count({
      where: { userId: user.id },
    });

    const shouldMarkAsDefault = req.body.isDefault === true || existingCount === 0;

    if (shouldMarkAsDefault) {
      await prisma.address.updateMany({
        where: { userId: user.id },
        data: { isDefault: false },
      });
    }

    await prisma.address.create({
      data: {
        fullName,
        address,
        state,
        postalCode,
        isDefault: shouldMarkAsDefault,
        userId: user.id,
      },
    });

    res.json(ok(await listAddresses(user.id)));
  }),
);

customerAddressRouter.patch(
  "/addresses/:addressId",
  asyncHandler(async (req: Request, res: Response) => {
    const user = await getDbUserFromReq(req);
    const addressId = String(req.params.addressId || "").trim();

    requireText(addressId, "Address id is required");

    const fullName = String(req.body.fullName || "").trim();
    const address = String(req.body.address || "").trim();
    const state = String(req.body.state || "").trim();
    const postalCode = String(req.body.postalCode || "").trim();

    requireText(fullName, "Full name is required");
    requireText(address, "Address is required");
    requireText(state, "State is required");
    requireText(postalCode, "Postal code is required");

    const existing = await prisma.address.findFirst({
      where: { id: addressId, userId: user.id },
    });

    if (!existing) {
      throw new AppError(404, "Address not found");
    }

    const shouldMarkAsDefault = req.body.isDefault === true;

    if (shouldMarkAsDefault) {
      await prisma.address.updateMany({
        where: { userId: user.id },
        data: { isDefault: false },
      });
    }

    await prisma.address.update({
      where: { id: addressId },
      data: {
        fullName,
        address,
        state,
        postalCode,
        ...(shouldMarkAsDefault ? { isDefault: true } : {}),
      },
    });

    res.json(ok(await listAddresses(user.id)));
  }),
);

customerAddressRouter.delete(
  "/addresses/:addressId",
  asyncHandler(async (req: Request, res: Response) => {
    const user = await getDbUserFromReq(req);
    const addressId = String(req.params.addressId || "").trim();

    requireText(addressId, "Address id is required");

    const existing = await prisma.address.findFirst({
      where: { id: addressId, userId: user.id },
    });

    if (!existing) {
      throw new AppError(404, "Address not found");
    }

    await prisma.address.delete({ where: { id: addressId } });

    if (existing.isDefault) {
      const remaining = await prisma.address.findMany({
        where: { userId: user.id },
      });

      if (remaining.length > 0 && !remaining.some((item) => item.isDefault)) {
        await prisma.address.update({
          where: { id: remaining[0].id },
          data: { isDefault: true },
        });
      }
    }

    res.json(ok(await listAddresses(user.id)));
  }),
);
