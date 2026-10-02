import { Router, type Request, type Response } from "express";
import type Stripe from "stripe";
import prisma from "../../db";
import { getDbUserFromReq, requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireText, requireFound } from "../../utils/helpers";
import { AppError } from "../../utils/AppError";
import { ok } from "../../utils/envelope";
import logger from "../../utils/logger";
import { stripe, CHECKOUT_CURRENCY, toMinorUnits } from "../../utils/stripe";
import { createPendingOrder, finalizePaidOrder, prepareOrder } from "./checkout.helpers";

export const customerCheckoutRouter = Router();

customerCheckoutRouter.post(
  "/checkout/create-session",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await getDbUserFromReq(req);
    const addressId = String(req.body.addressId || "").trim();
    const promoCode = String(req.body.promoCode || "")
      .trim()
      .toUpperCase();

    requireText(addressId, "Address is required");

    const prepared = await prepareOrder(user.id, addressId, promoCode);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: toMinorUnits(prepared.totalAmount),
      currency: CHECKOUT_CURRENCY,
      automatic_payment_methods: { enabled: true },
      metadata: { userId: user.id },
    });

    const order = await createPendingOrder(user, prepared, {
      provider: "stripe",
      providerOrderId: paymentIntent.id,
    });

    res.json(
      ok({
        stripe: {
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
        },
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

customerCheckoutRouter.post(
  "/checkout/confirm",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await getDbUserFromReq(req);
    const orderId = String(req.body.orderId || "").trim();
    const paymentIntentId = String(req.body.paymentIntentId || "").trim();

    requireText(orderId, "Order id is required");
    requireText(paymentIntentId, "Payment id is required");

    const order = await prisma.order.findFirst({
      where: { id: orderId, userId: user.id },
    });
    const foundOrder = requireFound(order, "Order not found", 404);

    if (foundOrder.paymentStatus === "paid") {
      res.json(ok({ id: foundOrder.id }));
      return;
    }

    if (foundOrder.providerOrderId !== paymentIntentId) {
      throw new AppError(400, "Order id mismatch");
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
      throw new AppError(400, "Payment is not completed");
    }

    await finalizePaidOrder(foundOrder.id, paymentIntent.id);

    res.json(ok({ id: foundOrder.id }));
  }),
);

// Raw-body endpoint — mounted before the JSON parser in server.ts so the
// signature can be checked against the exact bytes Stripe sent.
export async function stripeWebhookHandler(req: Request, res: Response) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers["stripe-signature"];

  if (!secret || typeof signature !== "string") {
    res.status(400).send("Webhook not configured");
    return;
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, signature, secret);
  } catch {
    res.status(400).send("Invalid signature");
    return;
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    const order = await prisma.order.findFirst({
      where: { providerOrderId: paymentIntent.id, paymentProvider: "stripe" },
    });

    if (order) {
      try {
        await finalizePaidOrder(order.id, paymentIntent.id);
      } catch (error) {
        logger.error(error);
      }
    }
  }

  res.json({ received: true });
}
