import { Router, type Request, type Response } from "express";
import prisma from "../../db";
import { getDbUserFromReq, requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/envelope";
import { requireFound, requireText } from "../../utils/helpers";
import { AppError } from "../../utils/AppError";

const RETURN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const customerOrderRouter = Router();

customerOrderRouter.use(requireAuth);

customerOrderRouter.get(
  "/orders",
  asyncHandler(async (req: Request, res: Response) => {
    const user = await getDbUserFromReq(req);

    const orders = await prisma.order.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        totalItems: true,
        totalAmount: true,
        paymentStatus: true,
        orderStatus: true,
        paidAt: true,
        deliveredAt: true,
        returnedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(
      ok({
        items: orders.map((order) => ({
          id: order.id,
          code: order.id.slice(-8).toUpperCase(),
          totalItems: order.totalItems,
          totalAmount: order.totalAmount,
          paymentStatus: order.paymentStatus,
          orderStatus: order.orderStatus,
          paidAt: order.paidAt,
          deliveredAt: order.deliveredAt,
          returnedAt: order.returnedAt,
          createdAt: order.createdAt,
        })),
      }),
    );
  }),
);

customerOrderRouter.patch(
  "/orders/:orderId/return",
  asyncHandler(async (req: Request, res: Response) => {
    const user = await getDbUserFromReq(req);
    const orderId = String(req.params.orderId || "").trim();

    requireText(orderId, "Order id is required");

    const order = await prisma.order.findFirst({
      where: { id: orderId, userId: user.id },
      include: { items: true },
    });
    const foundOrder = requireFound(order, "Order not found", 404);

    if (foundOrder.orderStatus !== "delivered" || !foundOrder.deliveredAt) {
      throw new AppError(400, "Only delivered orders can be returned");
    }

    if (Date.now() - foundOrder.deliveredAt.getTime() > RETURN_WINDOW_MS) {
      throw new AppError(400, "Return window expired");
    }

    const updated = await prisma.$transaction(async (tx) => {
      for (const item of foundOrder.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }

      await tx.user.update({
        where: { id: user.id },
        data: { points: { increment: foundOrder.totalAmount } },
      });

      return tx.order.update({
        where: { id: foundOrder.id },
        data: { orderStatus: "returned", returnedAt: new Date() },
        select: { id: true, orderStatus: true, returnedAt: true },
      });
    });

    res.json(ok(updated));
  }),
);
