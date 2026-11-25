import mongoose from "mongoose";

const lineItemSchema = new mongoose.Schema(
  {
    findingDescription: { type: String, required: true },
    type: { type: String, required: true },
    severity: { type: String, required: true },
    matchedRateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RepairRate",
      default: null,
    },
    rateSourceLabel: { type: String, default: "" },
    deductionAmount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const settlementSchema = new mongoose.Schema(
  {
    rentalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rental",
      required: true,
    },
    inspectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inspection",
      required: true,
    },
    depositAmount: { type: Number, required: true, min: 0 },
    lineItems: [lineItemSchema],
    totalDeduction: { type: Number, required: true, min: 0 },
    refundToRenter: { type: Number, required: true, min: 0 },
    reviewerGate: {
      verdict: { type: String, enum: ["PASS", "FLAG"], required: true },
      confidence: { type: Number, min: 0, max: 100 },
      flags: [String],
      auditReasoning: String,
    },
    hitlStatus: {
      type: String,
      enum: ["PENDING_APPROVAL", "APPROVED", "EDITED", "DISPUTED"],
      default: "PENDING_APPROVAL",
    },
    overrideTotalDeduction: { type: Number, default: null },
    finalOverrideNote: { type: String, default: "" },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Settlement = mongoose.model("Settlement", settlementSchema);
