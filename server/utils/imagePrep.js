import sharp from "sharp";
import { sha256Buffer } from "./hash.js";

const MAX_IMAGES = 4;
const MAX_DIMENSION = 1024;
const WEBP_QUALITY = 78;

function createBadRequestError(message, cause) {
  const err = new Error(message);
  err.status = 400;
  err.statusCode = 400;
  if (cause) {
    err.cause = cause;
  }
  return err;
}

/**
 * Validates, EXIF-rotates, resizes (max 1024px), converts to WebP, and hashes
 * up to 4 uploaded multer image files from memoryStorage.
 */
export async function prepareImages(files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw createBadRequestError("At least one image file is required.");
  }

  if (files.length > MAX_IMAGES) {
    throw createBadRequestError(
      `Too many files uploaded (${files.length}). Maximum allowed is ${MAX_IMAGES}.`
    );
  }

  const prepared = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const label = file?.originalname || `photo-${i + 1}.webp`;

    if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
      throw createBadRequestError(
        `Missing or empty image buffer for "${label}".`
      );
    }

    if (file.mimetype && !file.mimetype.startsWith("image/")) {
      throw createBadRequestError(
        `Unsupported file type "${file.mimetype}" for "${label}". Only image files are allowed.`
      );
    }

    try {
      const buf = await sharp(file.buffer)
        .rotate()
        .resize({
          width: MAX_DIMENSION,
          height: MAX_DIMENSION,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();

      const sha256 = sha256Buffer(buf);

      prepared.push({
        label,
        mimeType: "image/webp",
        base64: buf.toString("base64"),
        sha256,
      });
    } catch (err) {
      throw createBadRequestError(
        `Unsupported or corrupt image "${label}": ${err.message}`,
        err
      );
    }
  }

  return prepared;
}
