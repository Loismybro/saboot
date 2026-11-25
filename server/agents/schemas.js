import * as z from "zod";

export const CheckInSchema = z.object({
  summary: z.string(),
  preExistingFlaws: z.array(
    z.object({
      zone: z.string(),
      description: z.string(),
      severity: z.enum(["minor", "moderate", "severe"]),
    })
  ),
  accessoriesPresent: z.array(z.string()),
});

export const ForensicDiffSchema = z.object({
  sameObjectConfirmed: z.boolean(),
  qualityWarning: z.string().nullable(),
  preExistingIgnored: z.array(
    z.object({
      zone: z.string(),
      description: z.string(),
      reason: z.string(),
    })
  ),
  newFindings: z.array(
    z.object({
      type: z.enum(["damage", "missing_accessory"]),
      zone: z.string(),
      itemKeyword: z.string(),
      description: z.string(),
      severity: z.enum(["minor", "moderate", "severe", "missing"]),
      evidenceNote: z.string(),
    })
  ),
});

export const ReviewerGateSchema = z.object({
  verdict: z.enum(["PASS", "FLAG"]),
  confidence: z
    .number()
    .min(0)
    .max(100)
    .describe("Confidence score from 0 to 100"),
  flags: z.array(z.string()),
  auditReasoning: z.string(),
});
