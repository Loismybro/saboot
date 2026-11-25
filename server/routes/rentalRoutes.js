import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import { Rental } from "../models/Rental.js";
import { Inspection } from "../models/Inspection.js";
import { Settlement } from "../models/Settlement.js";
import { prepareImages } from "../utils/imagePrep.js";
import { computeBaselineSealHash, verifyRentalSeal } from "../utils/hash.js";
import { analyzeCheckIn } from "../agents/checkinAgent.js";

const router = express.Router();

const ALLOWED_CATEGORIES = new Set([
  "electronics",
  "camera",
  "bike_gear",
  "pg_room",
  "general",
]);

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const MAX_FILES = 4;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: MAX_FILES,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) {
      return cb(null, true);
    }
    const err = new Error(
      `Unsupported file type "${file.mimetype || "unknown"}" for "${file.originalname || "file"}". Only image files are allowed.`
    );
    err.status = 400;
    return cb(err);
  },
});

const uploadPhotoFields = upload.fields([
  { name: "photos", maxCount: MAX_FILES },
  { name: "photos[]", maxCount: MAX_FILES },
]);

function handlePhotoUpload(req, res, next) {
  uploadPhotoFields(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError || err.name === "MulterError") {
        err.status = 400;
      } else if (!err.status) {
        err.status = 400;
      }
      return next(err);
    }
    return next();
  });
}

function getUploadedFiles(req) {
  if (Array.isArray(req.files)) {
    return req.files;
  }
  return [
    ...(req.files?.photos || []),
    ...(req.files?.["photos[]"] || []),
  ];
}

function createBadRequestError(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function parseCheckInFields(body = {}) {
  const title = String(body.title || "").trim();
  const ownerName = String(body.ownerName || "").trim();
  const renterName = String(body.renterName || "").trim();
  const rawCategory = String(body.category || "general").trim();

  if (!title) {
    throw createBadRequestError("title is required.");
  }
  if (!ownerName) {
    throw createBadRequestError("ownerName is required.");
  }
  if (!renterName) {
    throw createBadRequestError("renterName is required.");
  }
  if (!ALLOWED_CATEGORIES.has(rawCategory)) {
    throw createBadRequestError(
      `Invalid category "${rawCategory}". Allowed: ${[...ALLOWED_CATEGORIES].join(", ")}.`
    );
  }

  const rawDeposit = body.depositAmount;
  if (
    rawDeposit === undefined ||
    rawDeposit === null ||
    String(rawDeposit).trim() === ""
  ) {
    throw createBadRequestError("depositAmount is required.");
  }
  const depositAmount = Number(rawDeposit);
  if (!Number.isFinite(depositAmount) || depositAmount < 0) {
    throw createBadRequestError(
      "depositAmount must be a valid non-negative number."
    );
  }

  const rawDueDate = body.dueDate;
  let dueDate;
  if (
    rawDueDate === undefined ||
    rawDueDate === null ||
    String(rawDueDate).trim() === ""
  ) {
    dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  } else {
    dueDate = new Date(rawDueDate);
    if (Number.isNaN(dueDate.getTime())) {
      throw createBadRequestError("dueDate must be a valid date.");
    }
  }

  return {
    title,
    category: rawCategory,
    ownerName,
    renterName,
    depositAmount,
    dueDate,
  };
}

function validateObjectIdOr400(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createBadRequestError(`Invalid rental ID "${id}".`);
  }
}

router.get("/", async (req, res, next) => {
  try {
    const rentals = await Rental.find(
      {},
      { checkinImages: { $slice: 1 } }
    )
      .sort({ createdAt: -1 })
      .lean();

    const formattedRentals = rentals.map((rental) => {
      const firstImg = rental.checkinImages?.[0] || null;
      const { checkinImages, tamperBackup, ...rest } = rental;

      return {
        ...rest,
        tamperActive: Boolean(tamperBackup),
        imageCount:
          rental.baselineSeal?.imageHashes?.length ||
          checkinImages?.length ||
          0,
        thumbnail: firstImg
          ? {
              label: firstImg.label,
              mimeType: firstImg.mimeType,
              base64: firstImg.base64,
              sha256: firstImg.sha256,
            }
          : null,
      };
    });

    res.json({
      ok: true,
      count: formattedRentals.length,
      rentals: formattedRentals,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    validateObjectIdOr400(req.params.id);

    const rental = await Rental.findById(req.params.id).lean();
    if (!rental) {
      return res.status(404).json({ ok: false, error: "Rental not found." });
    }

    const [inspection, settlement] = await Promise.all([
      Inspection.findOne({ rentalId: rental._id })
        .sort({ createdAt: -1 })
        .lean(),
      Settlement.findOne({ rentalId: rental._id })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const sealVerification = verifyRentalSeal(rental);

    res.json({
      ok: true,
      rental,
      inspection: inspection || null,
      settlement: settlement || null,
      sealVerification,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/checkin", handlePhotoUpload, async (req, res, next) => {
  try {
    const fields = parseCheckInFields(req.body);
    const uploadedFiles = getUploadedFiles(req);
    const preparedImages = await prepareImages(uploadedFiles);

    const analysis = await analyzeCheckIn({
      images: preparedImages,
      title: fields.title,
      category: fields.category,
    });

    const imageHashes = preparedImages.map((img) => img.sha256);
    const preExistingFlaws = analysis.preExistingFlaws || [];
    const accessoriesPresent = analysis.accessoriesPresent || [];

    const sha256Hash = computeBaselineSealHash({
      imageHashes,
      preExistingFlaws,
      accessoriesPresent,
    });

    const rental = await Rental.create({
      ...fields,
      status: "CHECKED_IN",
      checkinImages: preparedImages,
      baselineSeal: {
        sha256Hash,
        sealedAt: new Date(),
        imageHashes,
        preExistingFlaws,
        accessoriesPresent,
        summary: analysis.summary,
      },
    });

    const sealVerification = verifyRentalSeal(rental);

    res.status(201).json({
      ok: true,
      rental,
      sealVerification,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id/verify-hash", async (req, res, next) => {
  try {
    validateObjectIdOr400(req.params.id);

    const rental = await Rental.findById(req.params.id).lean();
    if (!rental) {
      return res.status(404).json({ ok: false, error: "Rental not found." });
    }

    const result = verifyRentalSeal(rental);

    res.json({
      ok: true,
      rentalId: rental._id,
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/simulate-tamper", async (req, res, next) => {
  try {
    validateObjectIdOr400(req.params.id);

    const rental = await Rental.findById(req.params.id);
    if (!rental) {
      return res.status(404).json({ ok: false, error: "Rental not found." });
    }
    if (!rental.baselineSeal) {
      throw createBadRequestError("Rental does not have a baselineSeal.");
    }

    const currentFlaws = rental.baselineSeal.preExistingFlaws || [];
    if (rental.tamperBackup === null || rental.tamperBackup === undefined) {
      rental.tamperBackup = currentFlaws.map((f) => ({
        zone: f.zone,
        description: f.description,
        severity: f.severity,
      }));
      rental.markModified("tamperBackup");
    }

    if (currentFlaws.length > 0) {
      const target = currentFlaws[0];
      if (!String(target.description || "").includes("[TAMPERED]")) {
        target.description = `${target.description} [TAMPERED: altered post-seal]`;
      }
    } else {
      rental.baselineSeal.preExistingFlaws.push({
        zone: "primary surface",
        description:
          "[TAMPERED] Synthetic pre-existing damage injected post-seal",
        severity: "severe",
      });
    }

    rental.markModified("baselineSeal.preExistingFlaws");
    await rental.save();

    const sealVerification = verifyRentalSeal(rental);

    res.json({
      ok: true,
      tampered: true,
      rental,
      sealVerification,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/restore-seal", async (req, res, next) => {
  try {
    validateObjectIdOr400(req.params.id);

    const rental = await Rental.findById(req.params.id);
    if (!rental) {
      return res.status(404).json({ ok: false, error: "Rental not found." });
    }
    if (!rental.baselineSeal) {
      throw createBadRequestError("Rental does not have a baselineSeal.");
    }

    const hasBackup =
      rental.tamperBackup !== null && rental.tamperBackup !== undefined;

    if (hasBackup && Array.isArray(rental.tamperBackup)) {
      rental.baselineSeal.preExistingFlaws = rental.tamperBackup.map((f) => ({
        zone: f.zone,
        description: f.description,
        severity: f.severity,
      }));
      rental.tamperBackup = null;
      rental.markModified("baselineSeal.preExistingFlaws");
      rental.markModified("tamperBackup");
      await rental.save();
    }

    const sealVerification = verifyRentalSeal(rental);

    res.json({
      ok: true,
      restored: hasBackup,
      rental,
      sealVerification,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
