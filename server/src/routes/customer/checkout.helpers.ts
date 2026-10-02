import prisma from "../../db";
import { AppError } from "../../utils/AppError";
import { requireFound } from "../../utils/helpers";

export type OrderLine = {
  productId: string;
  quantity: number;
};

export type PreparedOrder = {
  items: OrderLine[];
  totalItems: number;
  subTotal: number;
  discountAmount: number;
  totalAmount: number;
  appliedPromoCode: string;
  deliveryName: string;
  deliveryAddress: string;
};

function finalPriceOf(price: number, salePercentage: number) {
  return salePercentage ? Math.round(price - (price * salePercentage) / 100) : price;
}

// Validates the cart + address, recomputes the amount from server-side data
// (never trusts a client-supplied total) and applies a promo if one is given.
export async function prepareOrder(
  userId: string,
  addressId: string,
  promoCode: string,
): Promise<PreparedOrder> {
  const [address, cart] = await Promise.all([
    prisma.address.findFirst({ where: { id: addressId, userId } }),
    prisma.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } },
    }),
  ]);

  const selectedAddress = requireFound(address, "Address not found", 404);
  const foundCart = requireFound(cart, "Cart not found", 404);

  if (!foundCart.items.length) {
    throw new AppError(400, "Cart is empty");
  }

  let totalItems = 0;
  let subTotal = 0;

  const items = foundCart.items.map((cartItem) => {
    const product = cartItem.product;

    if (!product || product.status !== "active") {
      throw new AppError(400, "One or more cart items are not available");
    }

    if (product.stock < cartItem.quantity) {
      throw new AppError(400, "Cart items are out of stock");
    }

    const finalPrice = finalPriceOf(product.price, product.salePercentage);

    totalItems += cartItem.quantity;
    subTotal += finalPrice * cartItem.quantity;

    return { productId: product.id, quantity: cartItem.quantity };
  });

  let appliedPromoCode = "";
  let discountAmount = 0;

  if (promoCode) {
    const promo = await prisma.promo.findUnique({ where: { code: promoCode } });
    const foundPromo = requireFound(promo, "Promo not found", 404);
    const now = new Date();

    if (now < foundPromo.startsAt || now > foundPromo.endsAt || foundPromo.count < 1) {
      throw new AppError(400, "Promo code is not active");
    }

    if (subTotal < foundPromo.minimumOrderValue) {
      throw new AppError(
        400,
        `Minimum order value for this promo is ${foundPromo.minimumOrderValue}`,
      );
    }

    appliedPromoCode = foundPromo.code;
    discountAmount = Math.round((subTotal * foundPromo.percentage) / 100);
  }

  const totalAmount = Math.max(subTotal - discountAmount, 0);

  const deliveryAddress = [
    selectedAddress.address,
    selectedAddress.state,
    selectedAddress.postalCode,
  ]
    .filter(Boolean)
    .join(", ");

  return {
    items,
    totalItems,
    subTotal,
    discountAmount,
    totalAmount,
    appliedPromoCode,
    deliveryName: selectedAddress.fullName,
    deliveryAddress,
  };
}

// Applies the paid order effects (stock, promo, cart, order status) in a single
// transaction. Safe to run more than once for the same order — a client confirm
// and a webhook can both land, and only the first one takes effect.
export async function finalizePaidOrder(orderId: string, providerPaymentId: string) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order || order.paymentStatus === "paid") {
      return;
    }

    for (const item of order.items) {
      const updated = await tx.product.updateMany({
        where: { id: item.productId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });

      if (updated.count === 0) {
        throw new AppError(400, "One or more items are out of stock");
      }
    }

    if (order.promoCode) {
      await tx.promo.updateMany({
        where: { code: order.promoCode, count: { gt: 0 } },
        data: { count: { decrement: 1 } },
      });
    }

    await tx.cartItem.deleteMany({ where: { cart: { userId: order.userId } } });

    await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: "paid",
        providerPaymentId,
        paidAt: new Date(),
      },
    });
  });
}

export async function createPendingOrder(
  user: { id: string; name: string | null; email: string },
  prepared: PreparedOrder,
  payment: { provider: string; providerOrderId: string },
) {
  return prisma.order.create({
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
      paymentStatus: "pending",
      orderStatus: "placed",
      paymentProvider: payment.provider,
      providerOrderId: payment.providerOrderId,
      items: {
        create: prepared.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      },
    },
  });
}
