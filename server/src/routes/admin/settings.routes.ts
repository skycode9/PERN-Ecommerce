import { Router, type Request, type Response } from "express";
import multer from "multer";
import prisma from "../../db";
import { requireAuth, requireAdmin, getDbUserFromReq } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/envelope";
import { AppError } from "../../utils/AppError";
import {
  deleteFromCloudinary,
  uploadBufferToCloudinary,
  uploadBuffersToCloudinary,
} from "../../utils/cloudinary";
import { requireFound } from "../../utils/helpers";
import logger from "../../utils/logger";
import type { Banner } from "../../generated/prisma/client";

const BANNER_FOLDER = "ecommerce/banners";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 10,
  },
});

function mapBanner(item: Banner) {
  return {
    id: item.id,
    imageUrl: item.imageUrl,
    imagePublicId: item.imagePublicId,
    createdAt: item.createdAt,
  };
}

// the banner is already gone from the db at this point, so a failed cleanup is only logged
async function removeBannerImage(publicId: string) {
  try {
    await deleteFromCloudinary(publicId);
  } catch (error) {
    logger.error(error);
  }
}

export const adminSettingsRouter = Router();

adminSettingsRouter.use(requireAuth, requireAdmin);

adminSettingsRouter.get(
  "/settings/banners",
  asyncHandler(async (_req: Request, res: Response) => {
    const banners = await prisma.banner.findMany({
      orderBy: { createdAt: "desc" },
    });

    res.json(ok({ items: banners.map(mapBanner) }));
  }),
);

adminSettingsRouter.post(
  "/settings/banners",
  upload.array("images", 10),
  asyncHandler(async (req: Request, res: Response) => {
    const user = await getDbUserFromReq(req);

    const files = (req.files as Express.Multer.File[]) || [];

    if (!files.length) {
      throw new AppError(400, "At least one image is required");
    }

    const uploaded = await uploadBuffersToCloudinary(
      files.map((file) => file.buffer),
      BANNER_FOLDER,
    );

    const banners = await prisma.banner.createManyAndReturn({
      data: uploaded.map((image) => ({
        imageUrl: image.url,
        imagePublicId: image.publicId,
        createdById: user.id,
      })),
    });

    res.status(201).json(ok({ items: banners.map(mapBanner) }));
  }),
);

adminSettingsRouter.put(
  "/settings/banners/:id",
  upload.single("image"),
  asyncHandler(async (req: Request, res: Response) => {
    const bannerId = String(req.params.id);

    const banner = await prisma.banner.findUnique({ where: { id: bannerId } });
    const foundBanner = requireFound(banner, "Banner not found", 404);

    if (!req.file) {
      throw new AppError(400, "Image is required");
    }

    const uploaded = await uploadBufferToCloudinary(req.file.buffer, BANNER_FOLDER);

    const updated = await prisma.banner.update({
      where: { id: foundBanner.id },
      data: { imageUrl: uploaded.url, imagePublicId: uploaded.publicId },
    });

    await removeBannerImage(foundBanner.imagePublicId);

    res.json(ok(mapBanner(updated)));
  }),
);

adminSettingsRouter.delete(
  "/settings/banners/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const bannerId = String(req.params.id);

    const banner = await prisma.banner.findUnique({ where: { id: bannerId } });
    const foundBanner = requireFound(banner, "Banner not found", 404);

    await prisma.banner.delete({ where: { id: foundBanner.id } });
    await removeBannerImage(foundBanner.imagePublicId);

    res.json(ok({ id: foundBanner.id }));
  }),
);
