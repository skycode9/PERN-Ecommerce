import { Router, type Request, type Response } from "express";
import { ApiError, CheckoutPaymentIntent } from "@paypal/paypal-server-sdk";
import prisma from "../../db";
import { getDbUserFromReq, requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireFound, requireText } from "../../utils/helpers";
import { AppError } from "../../utils/AppError";
import { ok } from "../../utils/envelope";
import logger from "../../utils/logger";
import { paypalOrders, PAYPAL_CURRENCY, toPaypalAmount } from "../../utils/paypal";
import { createPendingOrder, finalizePaidOrder, prepareOrder } from "./checkout.helpers";

export const customerCheckoutPaypalRouter = Router();

async function captureWithPaypal(paypalOrderId: string, orderId: string) {
  try {
    const { result } = await paypalOrders.captureOrder({
      id: paypalOrderId,
      prefer: "return=representation",
    });

    return result;
  } catch (error) {
    if (error instanceof ApiError) {
      logger.error(`paypal capture failed for order ${orderId}: ${error.statusCode}`);
      throw new AppError(400, "PayPal payment could not be completed");
    }

    throw error;
  }
}

customerCheckoutPaypalRouter.post(
  "/checkout/paypal/create-order",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await getDbUserFromReq(req);
    const addressId = String(req.body.addressId || "").trim();
    const promoCode = String(req.body.promoCode || "")
      .trim()
      .toUpperCase();

    requireText(addressId, "Address is required");

    const prepared = await prepareOrder(user.id, addressId, promoCode);

    if (prepared.totalAmount <= 0) {
      throw new AppError(400, "Order total must be greater than zero");
    }

    const { result: paypalOrder } = await paypalOrders.createOrder({
      body: {
        intent: CheckoutPaymentIntent.Capture,
        purchaseUnits: [
          {
            customId: user.id,
            amount: {
              currencyCode: PAYPAL_CURRENCY,
              value: toPaypalAmount(prepared.totalAmount),
            },
          },
        ],
      },
      prefer: "return=minimal",
    });

    if (!paypalOrder.id) {
      throw new AppError(502, "Could not start PayPal checkout");
    }

    const order = await createPendingOrder(user, prepared, {
      provider: "paypal",
      providerOrderId: paypalOrder.id,
    });

    res.json(
      ok({
        paypal: { orderId: paypalOrder.id },
        order: {
          id: order.id,
          totalItems: prepared.totalItems,
          discountAmount: prepared.discountAmount,
          totalAmount: prepared.totalAmount,
        },
      }),
    );
  }),
);

customerCheckoutPaypalRouter.post(
  "/checkout/paypal/capture",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await getDbUserFromReq(req);
    const orderId = String(req.body.orderId || "").trim();

    requireText(orderId, "Order id is required");

    const order = await prisma.order.findFirst({
      where: { id: orderId, userId: user.id, paymentProvider: "paypal" },
    });
    const foundOrder = requireFound(order, "Order not found", 404);

    if (foundOrder.paymentStatus === "paid") {
      res.json(ok({ id: foundOrder.id }));
      return;
    }

    const paypalOrderId = requireFound(foundOrder.providerOrderId, "Order not found", 404);

    const capturedOrder = await captureWithPaypal(paypalOrderId, foundOrder.id);

    const capture = capturedOrder.purchaseUnits?.[0]?.payments?.captures?.[0];

    if (String(capturedOrder.status) !== "COMPLETED" || !capture?.id) {
      throw new AppError(400, "Payment is not completed");
    }

    // the captured amount has to match what we computed when the order was created
    if (capture.amount?.value !== toPaypalAmount(foundOrder.totalAmount)) {
      logger.error(`paypal amount mismatch for order ${foundOrder.id}`);
      throw new AppError(400, "Payment amount mismatch");
    }

    await finalizePaidOrder(foundOrder.id, capture.id);

    res.json(ok({ id: foundOrder.id }));
  }),
);
