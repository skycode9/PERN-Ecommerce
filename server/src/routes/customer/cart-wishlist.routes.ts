import { Router, type Request, type Response } from "express";
import prisma from "../../db";
import { getDbUserFromReq, requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/envelope";
import { requireFound, requireText } from "../../utils/helpers";
import { AppError } from "../../utils/AppError";
import { ProductSize } from "../../generated/prisma/enums";

export const customerCartWishlistRouter = Router();

type ProductImage = {
  url: string;
  isCover?: boolean;
};

type ProductPreview = {
  id: string;
  title: string;
  brand: string;
  price: number;
  salePercentage: number;
  images: unknown;
};

type SyncCartItemInput = {
  productId?: string;
  quantity?: number;
  color?: string;
  size?: string;
};

function formatProduct(product: ProductPreview) {
  const images = (product.images as ProductImage[]) || [];
  const image = images.find((item) => item.isCover)?.url || images[0]?.url || "";

  const finalPrice = product.salePercentage
    ? Math.round(product.price - (product.price * product.salePercentage) / 100)
    : product.price;

  return {
    productId: product.id,
    title: product.title,
    brand: product.brand,
    image,
    finalPrice,
  };
}

async function getCartResponse(userId: string) {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: { items: { include: { product: true } } },
  });

  const items = (cart?.items || []).map((cartItem) => ({
    ...formatProduct(cartItem.product),
    quantity: cartItem.quantity,
    color: cartItem.color ?? undefined,
    size: cartItem.size ?? undefined,
  }));

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  return { items, totalQuantity };
}

async function getWishlistResponse(userId: string) {
  const wishlist = await prisma.wishlist.findUnique({
    where: { userId },
    include: { products: true },
  });

  const items = (wishlist?.products || []).map(formatProduct);

  return { items };
}

function getSelectedVariant(
  product: { colors: string[]; sizes: ProductSize[] },
  colorValue: string,
  sizeValue: string,
) {
  let color: string | undefined;
  let size: ProductSize | undefined;

  if (product.colors.length > 0) {
    if (!colorValue) {
      throw new AppError(400, "Color is required");
    }
    if (!product.colors.includes(colorValue)) {
      throw new AppError(400, "Selected color is invalid");
    }
    color = colorValue;
  }

  if (product.sizes.length > 0) {
    if (!sizeValue) {
      throw new AppError(400, "Size is required");
    }
    if (!product.sizes.includes(sizeValue as ProductSize)) {
      throw new AppError(400, "Selected size is invalid");
    }
    size = sizeValue as ProductSize;
  }

  return { color, size };
}

customerCartWishlistRouter.use(requireAuth);

customerCartWishlistRouter.get(
  "/cart",
  asyncHandler(async (req: Request, res: Response) => {
    const user = await getDbUserFromReq(req);

    res.json(ok(await getCartResponse(user.id)));
  }),
);

customerCartWishlistRouter.post(
  "/cart/items",
  asyncHandler(async (req: Request, res: Response) => {
    const user = await getDbUserFromReq(req);

    const productId = String(req.body.productId || "").trim();
    const quantity = Number(req.body.quantity || 1);
    const colorValue = String(req.body.color || "").trim();
    const sizeValue = String(req.body.size || "").trim();

    requireText(productId, "Product id is required");

    if (Number.isNaN(quantity) || quantity < 1) {
      throw new AppError(400, "Quantity must be at least 1");
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, status: "active" },
    });
    const foundProduct = requireFound(product, "Product not found");

    const { color, size } = getSelectedVariant(foundProduct, colorValue, sizeValue);

    if (quantity > foundProduct.stock) {
      throw new AppError(400, "Quantity is more than the stock of this product");
    }

    const cart = await prisma.cart.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });

    const existingItem = await prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId: foundProduct.id,
        color: color ?? null,
        size: size ?? null,
      },
    });

    if (existingItem) {
      const nextQuantity = existingItem.quantity + quantity;

      if (nextQuantity > foundProduct.stock) {
        throw new AppError(400, "Quantity is more than the stock of this product");
      }

      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: nextQuantity },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: foundProduct.id,
          quantity,
          color: color ?? null,
          size: size ?? null,
        },
      });
    }

    res.json(ok(await getCartResponse(user.id)));
  }),
);

customerCartWishlistRouter.patch(
  "/cart/items/:productId/increase",
  asyncHandler(async (req: Request, res: Response) => {
    const user = await getDbUserFromReq(req);
    const productId = String(req.params.productId || "").trim();
    const colorValue = String(req.query.color || "").trim();
    const sizeValue = String(req.query.size || "").trim();

    requireText(productId, "Product id is required");

    const cart = await prisma.cart.findUnique({ where: { userId: user.id } });
    const foundCart = requireFound(cart, "Cart not found");

    const product = await prisma.product.findFirst({
      where: { id: productId, status: "active" },
    });
    const foundProduct = requireFound(product, "Product not found");

    const { color, size } = getSelectedVariant(foundProduct, colorValue, sizeValue);

    const item = await prisma.cartItem.findFirst({
      where: {
        cartId: foundCart.id,
        productId: foundProduct.id,
        color: color ?? null,
        size: size ?? null,
      },
    });

    if (!item) {
      throw new AppError(400, "Cart item not found here");
    }

    if (item.quantity + 1 > foundProduct.stock) {
      throw new AppError(400, "Quantity is more than the stock of this product");
    }

    await prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity: item.quantity + 1 },
    });

    res.json(ok(await getCartResponse(user.id)));
  }),
);

customerCartWishlistRouter.patch(
  "/cart/items/:productId/decrease",
  asyncHandler(async (req: Request, res: Response) => {
    const user = await getDbUserFromReq(req);
    const productId = String(req.params.productId || "").trim();
    const colorValue = String(req.query.color || "").trim();
    const sizeValue = String(req.query.size || "").trim();

    requireText(productId, "Product id is required");

    const cart = await prisma.cart.findUnique({ where: { userId: user.id } });
    const foundCart = requireFound(cart, "Cart not found");

    const product = await prisma.product.findFirst({
      where: { id: productId, status: "active" },
    });
    const foundProduct = requireFound(product, "Product not found");

    const { color, size } = getSelectedVariant(foundProduct, colorValue, sizeValue);

    const item = await prisma.cartItem.findFirst({
      where: {
        cartId: foundCart.id,
        productId: foundProduct.id,
        color: color ?? null,
        size: size ?? null,
      },
    });

    if (!item) {
      throw new AppError(400, "Cart item not found here");
    }

    const nextQuantity = item.quantity - 1;

    if (nextQuantity <= 0) {
      await prisma.cartItem.delete({ where: { id: item.id } });
    } else {
      await prisma.cartItem.update({
        where: { id: item.id },
        data: { quantity: nextQuantity },
      });
    }

    res.json(ok(await getCartResponse(user.id)));
  }),
);

customerCartWishlistRouter.delete(
  "/cart/items/:productId",
  asyncHandler(async (req: Request, res: Response) => {
    const user = await getDbUserFromReq(req);
    const productId = String(req.params.productId || "").trim();
    const colorValue = String(req.query.color || "").trim();
    const sizeValue = String(req.query.size || "").trim();

    requireText(productId, "Product id is required");

    const cart = await prisma.cart.findUnique({ where: { userId: user.id } });

    if (!cart) {
      res.json(ok({ items: [], totalQuantity: 0 }));
      return;
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, status: "active" },
    });
    const foundProduct = requireFound(product, "Product not found");

    const { color, size } = getSelectedVariant(foundProduct, colorValue, sizeValue);

    await prisma.cartItem.deleteMany({
      where: {
        cartId: cart.id,
        productId: foundProduct.id,
        color: color ?? null,
        size: size ?? null,
      },
    });

    res.json(ok(await getCartResponse(user.id)));
  }),
);

customerCartWishlistRouter.post(
  "/cart/sync",
  asyncHandler(async (req: Request, res: Response) => {
    const user = await getDbUserFromReq(req);

    const incomingItems = Array.isArray(req.body.items)
      ? (req.body.items as SyncCartItemInput[])
      : [];

    const cart = await prisma.cart.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });

    for (const rawItem of incomingItems) {
      const productId = String(rawItem.productId || "").trim();
      const quantity = Number(rawItem.quantity || 0);
      const colorValue = String(rawItem.color || "").trim();
      const sizeValue = String(rawItem.size || "").trim();

      if (!productId || Number.isNaN(quantity) || quantity < 1) {
        continue;
      }

      const product = await prisma.product.findFirst({
        where: { id: productId, status: "active" },
      });

      if (!product || product.stock < 1) {
        continue;
      }

      try {
        const { color, size } = getSelectedVariant(product, colorValue, sizeValue);

        const existingItem = await prisma.cartItem.findFirst({
          where: {
            cartId: cart.id,
            productId: product.id,
            color: color ?? null,
            size: size ?? null,
          },
        });

        if (existingItem) {
          await prisma.cartItem.update({
            where: { id: existingItem.id },
            data: {
              quantity: Math.min(existingItem.quantity + quantity, product.stock),
            },
          });
        } else {
          await prisma.cartItem.create({
            data: {
              cartId: cart.id,
              productId: product.id,
              quantity: Math.min(quantity, product.stock),
              color: color ?? null,
              size: size ?? null,
            },
          });
        }
      } catch {
        continue;
      }
    }

    res.json(ok(await getCartResponse(user.id)));
  }),
);

customerCartWishlistRouter.get(
  "/wishlist",
  asyncHandler(async (req: Request, res: Response) => {
    const user = await getDbUserFromReq(req);

    res.json(ok(await getWishlistResponse(user.id)));
  }),
);

customerCartWishlistRouter.post(
  "/wishlist/items",
  asyncHandler(async (req: Request, res: Response) => {
    const user = await getDbUserFromReq(req);
    const productId = String(req.body.productId || "").trim();

    requireText(productId, "Product id is required");

    const product = await prisma.product.findFirst({
      where: { id: productId, status: "active" },
    });
    const foundProduct = requireFound(product, "Product not found");

    await prisma.wishlist.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        products: { connect: { id: foundProduct.id } },
      },
      update: {
        products: { connect: { id: foundProduct.id } },
      },
    });

    res.json(ok(await getWishlistResponse(user.id)));
  }),
);

customerCartWishlistRouter.delete(
  "/wishlist/items/:productId",
  asyncHandler(async (req: Request, res: Response) => {
    const user = await getDbUserFromReq(req);
    const productId = String(req.params.productId || "").trim();

    requireText(productId, "Product id is required");

    const wishlist = await prisma.wishlist.findUnique({
      where: { userId: user.id },
    });

    if (!wishlist) {
      res.json(ok({ items: [] }));
      return;
    }

    await prisma.wishlist.update({
      where: { userId: user.id },
      data: { products: { disconnect: { id: productId } } },
    });

    res.json(ok(await getWishlistResponse(user.id)));
  }),
);
