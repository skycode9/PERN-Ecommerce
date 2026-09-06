import { Router, type Request, type Response } from "express";
import multer from "multer";
import prisma from "../../db";
import { requireAuth, requireAdmin, getDbUserFromReq } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";
import { ok } from "../../utils/envelope";
import { requireFound, requireNumber, requireText } from "../../utils/helpers";
import { uploadBuffersToCloudinary } from "../../utils/cloudinary";
import { ProductSize, ProductStatus } from "../../generated/prisma/enums";
import type { Prisma } from "../../generated/prisma/client";

type ProductImage = {
  url: string;
  publicId: string;
  isCover: boolean;
};

export const adminProductRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 10,
  },
});

adminProductRouter.use(requireAuth, requireAdmin);

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }

  return [];
}

function toSizes(value: unknown): ProductSize[] {
  const allowed = Object.values(ProductSize) as string[];

  return toStringArray(value).filter((item): item is ProductSize => allowed.includes(item));
}

function toStatus(value: unknown): ProductStatus {
  return value === "inactive" ? "inactive" : "active";
}

// categories

adminProductRouter.get(
  "/categories",
  asyncHandler(async (_req: Request, res: Response) => {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
    });

    res.json(ok(categories));
  }),
);

adminProductRouter.post(
  "/categories",
  asyncHandler(async (req: Request, res: Response) => {
    const name = String(req.body.name || "").trim();

    requireText(name, "Category name is needed");

    const category = await prisma.category.create({ data: { name } });

    res.status(201).json(ok(category));
  }),
);

adminProductRouter.put(
  "/categories/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const categoryId = req.params.id as string;
    const name = String(req.body.name || "").trim();

    requireText(name, "Category name is needed");

    const existing = await prisma.category.findUnique({
      where: { id: categoryId },
    });
    requireFound(existing, "Category not found");

    const category = await prisma.category.update({
      where: { id: categoryId },
      data: { name },
    });

    res.json(ok(category));
  }),
);

// products

adminProductRouter.get(
  "/products",
  asyncHandler(async (req: Request, res: Response) => {
    const search = String(req.query.search || "").trim();

    const products = await prisma.product.findMany({
      where: search ? { title: { contains: search, mode: "insensitive" } } : undefined,
      include: { category: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.json(ok(products));
  }),
);

adminProductRouter.get(
  "/products/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const productId = req.params.id as string;

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { category: { select: { name: true } } },
    });
    requireFound(product, "Product not found");

    res.json(ok(product));
  }),
);

adminProductRouter.post(
  "/products",
  upload.array("images", 10),
  asyncHandler(async (req: Request, res: Response) => {
    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim();
    const categoryId = String(req.body.category || "").trim();
    const brand = String(req.body.brand || "").trim();
    const price = Number(req.body.price);
    const salePercentage = Number(req.body.salePercentage || 0);
    const stock = Number(req.body.stock);
    const status = toStatus(req.body.status);
    const colors = toStringArray(req.body.colors);
    const sizes = toSizes(req.body.sizes);

    requireText(title, "Title is required");
    requireText(description, "Description is required");
    requireText(categoryId, "Category is required");
    requireText(brand, "Brand is required");

    requireNumber(price, "Price is required");
    requireNumber(salePercentage, "Sale Percentage is required");
    requireNumber(stock, "Stock is required");

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });
    requireFound(category, "Category not found");

    const files = (req.files as Express.Multer.File[]) || [];

    if (!files.length) {
      throw new AppError(400, "At least one image is needed");
    }

    const uploaded = await uploadBuffersToCloudinary(files.map((file) => file.buffer));

    const images: ProductImage[] = uploaded.map((image, index) => ({
      url: image.url,
      publicId: image.publicId,
      isCover: index === 0,
    }));

    const user = await getDbUserFromReq(req);

    const product = await prisma.product.create({
      data: {
        title,
        description,
        brand,
        price,
        salePercentage,
        stock,
        status,
        colors,
        sizes,
        images: images as unknown as Prisma.InputJsonValue,
        categoryId,
        createdById: user.id,
      },
      include: { category: { select: { name: true } } },
    });

    res.status(201).json(ok(product));
  }),
);

adminProductRouter.put(
  "/products/:id",
  upload.array("images", 10),
  asyncHandler(async (req: Request, res: Response) => {
    const productId = req.params.id as string;
    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim();
    const categoryId = String(req.body.category || "").trim();
    const brand = String(req.body.brand || "").trim();
    const price = Number(req.body.price);
    const salePercentage = Number(req.body.salePercentage || 0);
    const stock = Number(req.body.stock);
    const status = toStatus(req.body.status);
    const colors = toStringArray(req.body.colors);
    const sizes = toSizes(req.body.sizes);
    const coverImagePublicId = String(req.body.coverImagePublicId || "").trim();

    requireText(title, "Title is required");
    requireText(description, "Description is required");
    requireText(categoryId, "Category is required");
    requireText(brand, "Brand is required");

    requireNumber(price, "Price is required");
    requireNumber(salePercentage, "Sale Percentage is required");
    requireNumber(stock, "Stock is required");

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });
    requireFound(category, "Category not found");

    const existingProduct = await prisma.product.findUnique({
      where: { id: productId },
    });
    const product = requireFound(existingProduct, "Product not found");

    const files = (req.files as Express.Multer.File[]) || [];

    const uploaded = await uploadBuffersToCloudinary(files.map((file) => file.buffer));

    const newImages: ProductImage[] = uploaded.map((image) => ({
      url: image.url,
      publicId: image.publicId,
      isCover: false,
    }));

    const existingImages = (product.images as unknown as ProductImage[]) ?? [];
    const mergedImages = [...existingImages, ...newImages];

    if (!mergedImages.length) {
      throw new AppError(400, "At least one image is needed");
    }

    const finalImages: ProductImage[] = mergedImages.map((image, index) => ({
      url: image.url,
      publicId: image.publicId,
      isCover: coverImagePublicId ? image.publicId === coverImagePublicId : index === 0,
    }));

    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        title,
        description,
        brand,
        price,
        salePercentage,
        stock,
        status,
        colors,
        sizes,
        images: finalImages as unknown as Prisma.InputJsonValue,
        categoryId,
      },
      include: { category: { select: { name: true } } },
    });

    res.json(ok(updated));
  }),
);
