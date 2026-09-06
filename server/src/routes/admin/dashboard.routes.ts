import { Router, type Request, type Response } from "express";
import prisma from "../../db";
import { requireAuth, requireAdmin } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/envelope";

export const adminDashboardRouter = Router();

adminDashboardRouter.use(requireAuth, requireAdmin);

adminDashboardRouter.get(
  "/dashboard/lite",
  asyncHandler(async (_req: Request, res: Response) => {
    const [totalProducts, totalCategories, totalOrders, totalReturnedOrders, sales] =
      await Promise.all([
        prisma.product.count(),
        prisma.category.count(),
        prisma.order.count(),
        prisma.order.count({ where: { orderStatus: "returned" } }),
        prisma.order.aggregate({
          where: { paymentStatus: "paid" },
          _sum: { totalAmount: true },
        }),
      ]);

    res.json(
      ok({
        totalProducts,
        totalCategories,
        totalSales: sales._sum.totalAmount || 0,
        totalOrders,
        totalReturnedOrders,
      }),
    );
  }),
);
