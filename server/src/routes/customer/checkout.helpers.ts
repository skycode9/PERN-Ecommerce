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
