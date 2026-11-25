import { generateStructured } from "../utils/geminiClient.js";
import { ReviewerGateSchema } from "./schemas.js";

const REVIEWER_GATE_SYSTEM_INSTRUCTION = `You are an adversarial QA auditor protecting both renter and owner.
Audit the proposed Check-Out inspection and deterministic INR settlement against the sealed Check-In baseline.

Check strictly for these issues:
1. Is hashIntegrityPassed false? (Indicates SHA-256 baseline seal mismatch / possible tampering.)
2. Is sameObjectConfirmed false, or does qualityWarning indicate mismatched/unreadable photos?
3. Does any item in newFindings duplicate or overlap with baselineSeal.preExistingFlaws? (Renter must never be charged for pre-existing flaws.)
4. Does totalDeduction exceed 60% of depositAmount without clear severe damage or missing accessory evidence?
5. Are the calculated lineItems consistent with newFindings?

Output verdict "FLAG" if ANY issue is questionable or detected, and list each concern in "flags". Otherwise output verdict "PASS" with flags: []. Provide a confidence score from 0 to 100 and concise auditReasoning.`;

/**
 * Runs an independent adversarial Gemini QA audit on the proposed settlement
 * and enforces deterministic safety overrides when hash integrity or object match fails.
 */
export async function runReviewerGate({
  rental,
  diff,
  lineItems = [],
  totalDeduction = 0,
  hashIntegrityPassed,
}) {
  const depositAmount = Math.max(0, Number(rental?.depositAmount) || 0);
  const deductionPct =
    depositAmount > 0
      ? Math.round((totalDeduction / depositAmount) * 10000) / 100
      : 0;

  const auditPayload = {
    rental: {
      title: rental?.title || "",
      category: rental?.category || "general",
      depositAmount,
    },
    hashIntegrityPassed: Boolean(hashIntegrityPassed),
    checkinBaseline: {
      summary: rental?.baselineSeal?.summary || "",
      preExistingFlaws: (rental?.baselineSeal?.preExistingFlaws || []).map(
        (flaw) => ({
          zone: String(flaw.zone || ""),
          description: String(flaw.description || ""),
          severity: String(flaw.severity || "minor"),
        })
      ),
      accessoriesPresent: (rental?.baselineSeal?.accessoriesPresent || []).map(
        String
      ),
    },
    forensicDiff: {
      sameObjectConfirmed: Boolean(diff?.sameObjectConfirmed),
      qualityWarning: diff?.qualityWarning || null,
      preExistingIgnored: diff?.preExistingIgnored || [],
      newFindings: diff?.newFindings || [],
    },
    proposedSettlement: {
      lineItems: lineItems.map((item) => ({
        findingDescription: item.findingDescription,
        type: item.type,
        severity: item.severity,
        rateSourceLabel: item.rateSourceLabel,
        deductionAmount: item.deductionAmount,
      })),
      totalDeduction,
      refundToRenter: Math.max(0, depositAmount - totalDeduction),
      deductionPercentOfDeposit: deductionPct,
    },
  };

  const result = await generateStructured({
    parts: [
      {
        text: `Perform an adversarial QA audit on this inspection and settlement payload:\n${JSON.stringify(auditPayload, null, 2)}`,
      },
    ],
    schema: ReviewerGateSchema,
    systemInstruction: REVIEWER_GATE_SYSTEM_INSTRUCTION,
  });

  const flags = (result.flags || [])
    .map((flag) => String(flag).trim())
    .filter(Boolean);
  let verdict = result.verdict;
  let auditReasoning = String(result.auditReasoning || "").trim();

  const overrideNotes = [];

  if (!hashIntegrityPassed) {
    verdict = "FLAG";
    const hashFlag =
      "SHA-256 baseline seal verification failed (possible baseline tampering).";
    if (!flags.some((f) => /hash|seal|tamper|integrity/i.test(f))) {
      flags.push(hashFlag);
    }
    overrideNotes.push("forced FLAG due to failed SHA-256 seal integrity");
  }

  if (!diff?.sameObjectConfirmed) {
    verdict = "FLAG";
    const matchFlag = diff?.qualityWarning
      ? `Check-out item/quality verification failed: ${diff.qualityWarning}`
      : "Check-out photos could not be confirmed as the same item as check-in.";
    if (
      !flags.some((f) =>
        /same object|same item|different item|mismatch|unreadable|quality/i.test(
          f
        )
      )
    ) {
      flags.push(matchFlag);
    }
    overrideNotes.push("forced FLAG because sameObjectConfirmed is false");
  }

  if (overrideNotes.length > 0) {
    const suffix = ` [Deterministic safety override: ${overrideNotes.join("; ")}.]`;
    if (!auditReasoning.includes("Deterministic safety override")) {
      auditReasoning = `${auditReasoning}${suffix}`.trim();
    }
  }

  return {
    verdict,
    confidence: Math.min(100, Math.max(0, Number(result.confidence) || 0)),
    flags,
    auditReasoning,
  };
}
