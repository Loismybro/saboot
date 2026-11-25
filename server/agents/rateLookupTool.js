import { RepairRate } from "../models/RepairRate.js";

const DEFAULT_REPAIR_RATES_INR = {
  minor: 350,
  moderate: 900,
  severe: 2200,
  missing: 850,
};

const FALLBACK_SOURCE_LABEL = "Saboot standard default benchmark (2026)";

/**
 * Deterministically looks up repair rates in MongoDB `repair_rates` and calculates
 * itemized deductions, clamped totalDeduction, and refundToRenter in INR.
 */
export async function lookupRepairRatesAndCalculate({
  category = "general",
  depositAmount,
  newFindings = [],
}) {
  const normalizedCategory = String(category || "general").trim() || "general";
  const safeDeposit = Math.max(0, Number(depositAmount) || 0);
  const lineItems = [];

  for (const finding of newFindings) {
    const itemKeyword = String(finding.itemKeyword || "")
      .trim()
      .toLowerCase();
    const severity =
      finding.type === "missing_accessory"
        ? "missing"
        : String(finding.severity || "minor").trim().toLowerCase();

    let matchedRate = null;

    if (itemKeyword) {
      if (normalizedCategory !== "general") {
        matchedRate = await RepairRate.findOne({
          category: normalizedCategory,
          itemKeyword,
          severity,
        });
      }

      if (!matchedRate) {
        matchedRate = await RepairRate.findOne({
          category: "general",
          itemKeyword,
          severity,
        });
      }
    }

    const fallbackCost =
      DEFAULT_REPAIR_RATES_INR[severity] ?? DEFAULT_REPAIR_RATES_INR.minor;
    const deductionAmount = matchedRate
      ? Math.max(0, Number(matchedRate.costInr) || 0)
      : fallbackCost;

    lineItems.push({
      findingDescription: String(
        finding.description || `${severity} ${itemKeyword || "damage"}`
      ),
      type: String(finding.type || "damage"),
      severity,
      matchedRateId: matchedRate ? matchedRate._id : null,
      rateSourceLabel: matchedRate
        ? matchedRate.sourceLabel
        : FALLBACK_SOURCE_LABEL,
      deductionAmount,
    });
  }

  const rawTotal = lineItems.reduce(
    (sum, item) => sum + item.deductionAmount,
    0
  );
  const totalDeduction = Math.min(safeDeposit, Math.max(0, rawTotal));
  const refundToRenter = Math.max(
    0,
    Math.round((safeDeposit - totalDeduction) * 100) / 100
  );

  return {
    lineItems,
    totalDeduction,
    refundToRenter,
  };
}
