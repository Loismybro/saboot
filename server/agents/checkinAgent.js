import { generateStructured } from "../utils/geminiClient.js";
import { CheckInSchema } from "./schemas.js";

const CHECKIN_SYSTEM_INSTRUCTION = `You are Saboot's forensic rental Check-In inspector.
Analyze all Check-In baseline photos of the rented item and produce a strictly accurate baseline condition record.

Rules:
1. Identify ONLY genuine physical pre-existing flaws clearly visible in the photos (scratches, scuffs, dents, cracks, chips, stains, tears, adhesive residue, peeling).
2. Ignore normal lighting reflections, camera glare, harmless shadows, and minor dust unless it is an obvious physical mark or stain.
3. For each flaw, provide:
   - "zone": specific location on the item (e.g. "top-left lid corner", "front lens rim", "screen center").
   - "description": concise, factual description of the flaw.
   - "severity": "minor" | "moderate" | "severe".
4. If the item appears clean with no visible physical damage, return an empty array for "preExistingFlaws".
5. List all clearly visible included accessories or detachable parts in "accessoriesPresent" as short lowercase terms (e.g. "charger", "usb-c cable", "lens cap", "battery", "carry strap", "helmet visor", "key", "remote", "mouse"). Return [] if no accessories are visible.
6. Write a concise 1-2 sentence "summary" describing the item's overall check-in condition and visible accessories.`;

/**
 * Runs the Gemini multimodal Check-In agent against prepared WebP baseline photos
 * to extract pre-existing flaws, accessories present, and an overall summary.
 */
export async function analyzeCheckIn({
  images,
  title,
  category = "general",
}) {
  if (!Array.isArray(images) || images.length === 0) {
    const err = new Error("At least one prepared check-in image is required.");
    err.status = 400;
    throw err;
  }

  const parts = [
    {
      text: `Rental Item Title: ${title}\nCategory: ${category}\nTotal Check-In Photos: ${images.length}\nInspect all photos below to extract the baseline condition record.`,
    },
  ];

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    parts.push({
      text: `Photo ${i + 1} (${img.label || `photo-${i + 1}.webp`}):`,
    });
    parts.push({
      inlineData: {
        mimeType: img.mimeType,
        data: img.base64,
      },
    });
  }

  const result = await generateStructured({
    parts,
    schema: CheckInSchema,
    systemInstruction: CHECKIN_SYSTEM_INSTRUCTION,
  });

  return {
    summary: result.summary.trim(),
    preExistingFlaws: result.preExistingFlaws.map((flaw) => ({
      zone: flaw.zone.trim(),
      description: flaw.description.trim(),
      severity: flaw.severity,
    })),
    accessoriesPresent: result.accessoriesPresent
      .map((item) => item.trim())
      .filter(Boolean),
  };
}
