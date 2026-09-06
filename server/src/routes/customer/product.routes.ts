import { Router, type Request, type Response } from "express";
import prisma from "../../db";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/envelope";
import { requireFound } from "../../utils/helpers";
import { ProductSize } from "../../generated/prisma/enums";
import type { Prisma } from "../../generated/prisma/client";

export const customerProductRouter = Router();

type ProductSort = "recent" | "price-low" | "price-high";

const productInclude = {
  category: { select: { id: true, name: true } },
} satisfies Prisma.ProductInclude;

customerProductRouter.get(
  "/categories",
  asyncHandler(async (_req: Request, res: Response) => {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
    });

    res.json(ok(categories));
  }),
);

customerProductRouter.get(
  "/products",
  asyncHandler(async (req: Request, res: Response) => {
    const category = String(req.query.category || "").trim();
    const brand = String(req.query.brand || "").trim();
    const color = String(req.query.color || "").trim();
    const size = String(req.query.size || "").trim();
    const sort = String(req.query.sort || "recent") as ProductSort;

    const where: Prisma.ProductWhereInput = { status: "active" };

    if (category) {
      where.categoryId = category;
    }
    if (brand) {
      where.brand = brand;
    }
    if (color) {
      where.colors = { has: color };
    }
    if (size && (Object.values(ProductSize) as string[]).includes(size)) {
      where.sizes = { has: size as ProductSize };
    }

    let orderBy: Prisma.ProductOrderByWithRelationInput = {
      createdAt: "desc",
    };

    if (sort === "price-low") {
      orderBy = { price: "asc" };
    }
    if (sort === "price-high") {
      orderBy = { price: "desc" };
    }

    const products = await prisma.product.findMany({
      where,
      include: productInclude,
      orderBy,
    });

    res.json(ok(products));
  }),
);

customerProductRouter.get(
  "/products/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const productId = req.params.id as string;

    const product = await prisma.product.findFirst({
      where: { id: productId, status: "active" },
      include: productInclude,
    });

    const foundProduct = requireFound(product, "Product not found");

    const relatedProducts = await prisma.product.findMany({
      where: {
        id: { not: foundProduct.id },
        categoryId: foundProduct.categoryId,
        status: "active",
      },
      include: productInclude,
      orderBy: { createdAt: "desc" },
      take: 4,
    });

    res.json(ok({ product: foundProduct, relatedProducts }));
  }),
);
