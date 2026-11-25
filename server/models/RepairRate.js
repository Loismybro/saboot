import mongoose from "mongoose";

const repairRateSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ["electronics", "camera", "bike_gear", "pg_room", "general"],
      required: true,
    },
    itemKeyword: { type: String, required: true, lowercase: true, trim: true },
    severity: {
      type: String,
      enum: ["minor", "moderate", "severe", "missing"],
      required: true,
    },
    costInr: { type: Number, required: true, min: 0 },
    sourceLabel: { type: String, required: true },
  },
  { timestamps: true }
);

repairRateSchema.index(
  { category: 1, itemKeyword: 1, severity: 1 },
  { unique: true }
);

export const RepairRate = mongoose.model("RepairRate", repairRateSchema);
