import { Router, type Request, type Response } from "express";
import prisma from "../../db";
import { getDbUserFromReq, requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireText } from "../../utils/helpers";
import { AppError } from "../../utils/AppError";
import { ok } from "../../utils/envelope";
import { prepareOrder } from "./checkout.helpers";

export const customerCheckoutWithPointsRouter = Router();

customerCheckoutWithPointsRouter.use(requireAuth);

customerCheckoutWithPointsRouter.get(
  "/checkout/points",
  asyncHandler(async (req: Request, res: Response) => {
    const user = await getDbUserFromReq(req);

    res.json(ok({ points: user.points }));
  }),
);

customerCheckoutWithPointsRouter.post(
  "/checkout/pay-with-points",
  asyncHandler(async (req: Request, res: Response) => {
    const user = await getDbUserFromReq(req);
    const addressId = String(req.body.addressId || "").trim();
    const promoCode = String(req.body.promoCode || "")
      .trim()
      .toUpperCase();

    requireText(addressId, "Address is required");

    const prepared = await prepareOrder(user.id, addressId, promoCode);

    if (prepared.totalAmount > user.points) {
      throw new AppError(400, "Not enough points for this order");
    }

    // Everything runs in one transaction: if any step fails (e.g. a race on
    // stock) the point deduction rolls back automatically.
    const order = await prisma.$transaction(async (tx) => {
      const deducted = await tx.user.updateMany({
        where: { id: user.id, points: { gte: prepared.totalAmount } },
        data: { points: { decrement: prepared.totalAmount } },
      });

      if (deducted.count === 0) {
        throw new AppError(400, "Not enough points for this order");
      }

      for (const item of prepared.items) {
        const updated = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });

        if (updated.count === 0) {
          throw new AppError(400, "One or more items are out of stock");
        }
      }

      if (prepared.appliedPromoCode) {
        await tx.promo.updateMany({
          where: { code: prepared.appliedPromoCode, count: { gt: 0 } },
          data: { count: { decrement: 1 } },
        });
      }

      await tx.cartItem.deleteMany({ where: { cart: { userId: user.id } } });

      const paymentReference = `points_${Date.now()}`;

      return tx.order.create({
        data: {
          userId: user.id,
          customerName: user.name || prepared.deliveryName,
          customerEmail: user.email || "",
          totalItems: prepared.totalItems,
          deliveryName: prepared.deliveryName,
          deliveryAddress: prepared.deliveryAddress,
          promoCode: prepared.appliedPromoCode || null,
          discountAmount: prepared.discountAmount,
          totalAmount: prepared.totalAmount,
          paymentStatus: "paid",
          orderStatus: "placed",
          paymentProvider: "points",
          providerOrderId: paymentReference,
          providerPaymentId: paymentReference,
          paidAt: new Date(),
          items: {
            create: prepared.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
            })),
          },
        },
      });
    });

    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { points: true },
    });

    res.json(
      ok({
        id: order.id,
        totalPoints: updatedUser?.points ?? 0,
      }),
    );
  }),
);
