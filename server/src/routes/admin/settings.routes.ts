import { Router, type Request, type Response } from "express";
import multer from "multer";
import prisma from "../../db";
import { requireAuth, requireAdmin, getDbUserFromReq } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/envelope";
import { AppError } from "../../utils/AppError";
import { uploadBuffersToCloudinary } from "../../utils/cloudinary";
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
