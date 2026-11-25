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

const preExistingIgnoredSchema = new mongoose.Schema(
  {
    zone: String,
    description: String,
    reason: String,
  },
  { _id: false }
);

const newFindingSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["damage", "missing_accessory"], required: true },
    zone: String,
    itemKeyword: String,
    description: String,
    severity: {
      type: String,
      enum: ["minor", "moderate", "severe", "missing"],
    },
    evidenceNote: String,
  },
  { _id: false }
);

const agentTraceStepSchema = new mongoose.Schema(
  {
    step: String,
    status: { type: String, enum: ["PASS", "WARN", "FLAG", "ERROR"] },
    detail: String,
    durationMs: Number,
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const inspectionSchema = new mongoose.Schema(
  {
    rentalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rental",
      required: true,
    },
    hashIntegrityPassed: { type: Boolean, required: true },
    sameObjectConfirmed: { type: Boolean, default: true },
    qualityWarning: { type: String, default: null },
    checkoutImages: [imageSchema],
    preExistingIgnored: [preExistingIgnoredSchema],
    newFindings: [newFindingSchema],
    agentTrace: [agentTraceStepSchema],
  },
  { timestamps: true }
);

export const Inspection = mongoose.model("Inspection", inspectionSchema);
