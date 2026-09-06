import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";

type CloudinaryUploadResult = {
  url: string;
  publicId: string;
};

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export function uploadBufferToCloudinary(
  fileBuffer: Buffer,
  folder = "ecommerce/products",
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        if (!result) {
          return reject(new Error("Image upload failed"));
        }

        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );

    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
}

export function uploadBuffersToCloudinary(
  buffers: Buffer[],
  folder = "ecommerce/products",
): Promise<CloudinaryUploadResult[]> {
  return Promise.all(buffers.map((buffer) => uploadBufferToCloudinary(buffer, folder)));
}
