import { generateStructured } from "../utils/geminiClient.js";
import { ForensicDiffSchema } from "./schemas.js";

const FORENSIC_DIFF_SYSTEM_INSTRUCTION = `You are Saboot's forensic visual-diff inspector for peer-to-peer rental returns.
Compare the sealed CHECK-IN BASELINE PHOTOS (and recorded baseline flaws/accessories) against the CHECK-OUT RETURN PHOTOS.

Rules:
1. First verify "sameObjectConfirmed": confirm the Check-Out photos show the same physical item/scene as Check-In and are clear enough to inspect. If Check-Out shows a different item or is too dark, blurry, or obstructed to verify, set "sameObjectConfirmed" to false, explain why in "qualityWarning", and do NOT invent damage deductions ("newFindings": []). If it is the same item but image quality has minor issues (glare/partial angle), keep "sameObjectConfirmed" true and note it in "qualityWarning"; otherwise set "qualityWarning" to null.
2. Protect the renter from unfair charges: match every visible pre-existing flaw against the Check-In baseline "preExistingFlaws" list first, and record each matched pre-existing defect in "preExistingIgnored" with { zone, description, reason }. Never include a pre-existing flaw in "newFindings".
3. Ignore harmless lighting glare, reflections, shadows, minor dust, and camera angle differences.
4. Report in "newFindings" ONLY:
   - Genuinely NEW physical damage clearly visible in Check-Out that was absent in Check-In ("type": "damage", "severity": "minor" | "moderate" | "severe"), OR
   - Items listed in Check-In "accessoriesPresent" that are clearly MISSING from the Check-Out photos ("type": "missing_accessory", "severity": "missing").
5. Normalize "itemKeyword" to a simple lowercase term from this vocabulary whenever applicable:
   "scratch", "mark", "crack", "dent", "charger", "cable", "lens cap", "visor", "strap", "battery", "key", "mouse", "bag", "filter", "remote".`;

/**
 * Compares Check-In baseline photos and sealed metadata against Check-Out photos
 * using Gemini multimodal structured output to isolate only genuinely new findings.
 */
export async function runForensicDiff({ rental, checkoutImages }) {
  if (!rental) {
    const err = new Error("Rental record is required for forensic diff.");
    err.status = 400;
    throw err;
  }

  if (!Array.isArray(checkoutImages) || checkoutImages.length === 0) {
    const err = new Error("At least one prepared check-out image is required.");
    err.status = 400;
    throw err;
  }

  const checkinImages = rental.checkinImages || [];
  const baselineFlaws = (rental.baselineSeal?.preExistingFlaws || []).map(
    (flaw) => ({
      zone: String(flaw.zone || ""),
      description: String(flaw.description || ""),
      severity: String(flaw.severity || "minor"),
    })
  );
  const accessoriesPresent = (rental.baselineSeal?.accessoriesPresent || []).map(
    String
  );

  const parts = [
    {
      text: `Rental Item Title: ${rental.title || "Untitled"}\nCategory: ${rental.category || "general"}\nBaseline Summary: ${rental.baselineSeal?.summary || "N/A"}`,
    },
    {
      text: "--- CHECK-IN BASELINE PHOTOS ---",
    },
  ];

  for (let i = 0; i < checkinImages.length; i++) {
    const img = checkinImages[i];
    parts.push({
      text: `Check-In Photo ${i + 1} (${img.label || `checkin-${i + 1}.webp`}):`,
    });
    parts.push({
      inlineData: {
        mimeType: img.mimeType || "image/webp",
        data: img.base64,
      },
    });
  }

  parts.push({
    text: `Sealed Check-In Baseline Metadata (JSON):\n${JSON.stringify(
      {
        preExistingFlaws: baselineFlaws,
        accessoriesPresent,
      },
      null,
      2
    )}`,
  });

  parts.push({
    text: "--- CHECK-OUT RETURN PHOTOS ---",
  });

  for (let i = 0; i < checkoutImages.length; i++) {
    const img = checkoutImages[i];
    parts.push({
      text: `Check-Out Photo ${i + 1} (${img.label || `checkout-${i + 1}.webp`}):`,
    });
    parts.push({
      inlineData: {
        mimeType: img.mimeType || "image/webp",
        data: img.base64,
      },
    });
  }

  const modelOverride =
    process.env.GEMINI_DIFF_MODEL || process.env.GEMINI_MODEL;

  const result = await generateStructured({
    parts,
    schema: ForensicDiffSchema,
    systemInstruction: FORENSIC_DIFF_SYSTEM_INSTRUCTION,
    modelOverride,
  });

  return {
    sameObjectConfirmed: Boolean(result.sameObjectConfirmed),
    qualityWarning: result.qualityWarning ? result.qualityWarning.trim() : null,
    preExistingIgnored: (result.preExistingIgnored || []).map((item) => ({
      zone: item.zone.trim(),
      description: item.description.trim(),
      reason: item.reason.trim(),
    })),
    newFindings: (result.newFindings || []).map((finding) => ({
      type: finding.type,
      zone: finding.zone.trim(),
      itemKeyword: finding.itemKeyword.trim().toLowerCase(),
      description: finding.description.trim(),
      severity:
        finding.type === "missing_accessory" ? "missing" : finding.severity,
      evidenceNote: finding.evidenceNote.trim(),
    })),
  };
}
