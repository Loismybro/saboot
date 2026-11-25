import mongoose from "mongoose";

const imageSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    mimeType: { type: String, default: "image/webp" },
    base64: { type: String, required: true },
    sha256: { type: String, required: true },
  },
  { _id: false }
);

const flawSchema = new mongoose.Schema(
  {
    zone: { type: String, required: true },
    description: { type: String, required: true },
    severity: {
      type: String,
      enum: ["minor", "moderate", "severe"],
      required: true,
    },
  },
  { _id: false }
);

const rentalSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ["electronics", "camera", "bike_gear", "pg_room", "general"],
      default: "general",
    },
    ownerName: { type: String, required: true, trim: true },
    renterName: { type: String, required: true, trim: true },
    depositAmount: { type: Number, required: true, min: 0 },
    dueDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["CHECKED_IN", "UNDER_REVIEW", "SETTLED", "DISPUTED"],
      default: "CHECKED_IN",
    },
    overdueAlert: {
      flagged: { type: Boolean, default: false },
      flaggedAt: { type: Date, default: null },
      note: { type: String, default: "" },
    },
    checkinImages: [imageSchema],
    baselineSeal: {
      sha256Hash: String,
      sealedAt: Date,
      imageHashes: [String],
      preExistingFlaws: [flawSchema],
      accessoriesPresent: [String],
      summary: String,
    },
    tamperBackup: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

export const Rental = mongoose.model("Rental", rentalSchema);
