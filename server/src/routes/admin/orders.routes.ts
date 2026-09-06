import { Router, type Request, type Response } from "express";
import prisma from "../../db";
import { requireAuth, requireAdmin } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/envelope";
import { requireFound, requireText } from "../../utils/helpers";
import { AppError } from "../../utils/AppError";
import type { OrderStatus } from "../../generated/prisma/enums";

const ALLOWED_ORDER_STATUSES: OrderStatus[] = ["placed", "shipped", "delivered", "returned"];

export const adminOrderRouter = Router();

adminOrderRouter.use(requireAuth, requireAdmin);

adminOrderRouter.get(
  "/orders",
  asyncHandler(async (_req: Request, res: Response) => {
    const orders = await prisma.order.findMany({
      select: {
        id: true,
        customerName: true,
        customerEmail: true,
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
          customerName: order.customerName,
          customerEmail: order.customerEmail,
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

adminOrderRouter.patch(
  "/orders/:orderId/status",
  asyncHandler(async (req: Request, res: Response) => {
    const orderId = String(req.params.orderId || "").trim();
    const orderStatus = String(req.body.orderStatus || "").trim() as OrderStatus;

    requireText(orderId, "Order id is required");
    requireText(orderStatus, "orderStatus is required");

    if (!ALLOWED_ORDER_STATUSES.includes(orderStatus)) {
      throw new AppError(400, "Invalid order status");
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    const foundOrder = requireFound(order, "Order not found", 404);

    const updated = await prisma.$transaction(async (tx) => {
      // returning an order puts its stock back
      if (orderStatus === "returned" && foundOrder.orderStatus !== "returned") {
        for (const item of foundOrder.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }

      return tx.order.update({
        where: { id: foundOrder.id },
        data: {
          orderStatus,
          deliveredAt:
            orderStatus === "delivered" && !foundOrder.deliveredAt
              ? new Date()
              : foundOrder.deliveredAt,
        },
        select: {
          id: true,
          orderStatus: true,
          deliveredAt: true,
          returnedAt: true,
        },
      });
    });

    res.json(ok(updated));
  }),
);
