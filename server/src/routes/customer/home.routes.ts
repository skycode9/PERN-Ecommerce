import { Router, type Request, type Response } from "express";
import prisma from "../../db";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/envelope";

type ProductImage = {
  url: string;
  isCover?: boolean;
};

function coverImage(images: unknown): string {
  const list = (images as ProductImage[]) || [];
  return list.find((item) => item.isCover)?.url || list[0]?.url || "";
}

function finalPrice(price: number, salePercentage: number): number {
  return salePercentage ? Math.round(price - (price * salePercentage) / 100) : price;
}

export const customerHomeRouter = Router();

customerHomeRouter.get(
  "/home",
  asyncHandler(async (_req: Request, res: Response) => {
    const now = new Date();

    const [banners, categories, recentProducts, promos] = await Promise.all([
      prisma.banner.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
      prisma.category.findMany({ orderBy: { name: "asc" } }),
      prisma.product.findMany({
        where: { status: "active" },
        orderBy: { createdAt: "desc" },
        take: 4,
        select: {
          id: true,
          title: true,
          brand: true,
          price: true,
          salePercentage: true,
          images: true,
          createdAt: true,
        },
      }),
      prisma.promo.findMany({
        where: {
          startsAt: { lte: now },
          endsAt: { gte: now },
          count: { gt: 0 },
        },
        orderBy: { createdAt: "desc" },
        take: 4,
      }),
    ]);

    res.json(
      ok({
        banners: banners.map((banner) => ({
          id: banner.id,
          imageUrl: banner.imageUrl,
          createdAt: banner.createdAt.toISOString(),
        })),
        categories: categories.map((category) => ({
          id: category.id,
          name: category.name,
        })),
        recentProducts: recentProducts.map((product) => ({
          id: product.id,
          title: product.title,
          brand: product.brand,
          image: coverImage(product.images),
          price: product.price,
          finalPrice: finalPrice(product.price, product.salePercentage),
          salePercentage: product.salePercentage,
          createdAt: product.createdAt.toISOString(),
        })),
        coupons: promos.map((promo) => ({
          id: promo.id,
          code: promo.code,
          percentage: promo.percentage,
          count: promo.count,
          minimumOrderValue: promo.minimumOrderValue,
          endsAt: promo.endsAt.toISOString(),
        })),
      }),
    );
  }),
);
