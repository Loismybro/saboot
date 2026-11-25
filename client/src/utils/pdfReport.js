import { jsPDF } from "jspdf";

function pdfSafe(value) {
  return String(value ?? "")
    .replace(/₹/g, "Rs. ")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[^\x20-\x7E\n\r\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatRs(amount) {
  const num = Number(amount);
  return `Rs. ${Number.isFinite(num) ? num.toLocaleString("en-IN") : "0"}`;
}

function formatDate(value) {
  if (!value) return "N/A";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "N/A" : d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

/**
 * Generates and downloads a Forensic Verdict Certificate PDF for a rental settlement.
 * Uses "Rs. " for INR amounts so standard jsPDF Helvetica renders cleanly without missing glyphs.
 */
export function downloadVerdictPdf({
  rental,
  inspection,
  settlement,
  sealVerification,
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 16;

  const ensureSpace = (needed = 12) => {
    if (y + needed > 280) {
      doc.addPage();
      y = 18;
    }
  };

  const writeSectionHeader = (title) => {
    ensureSpace(14);
    y += 3;
    doc.setFillColor(15, 23, 42);
    doc.rect(margin, y - 5, contentWidth, 7.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(16, 185, 129);
    doc.text(pdfSafe(title), margin + 2.5, y);
    doc.setTextColor(30, 41, 59);
    y += 6.5;
  };

  const writeWrappedLine = (label, value, { mono = false, indent = 0 } = {}) => {
    const prefix = label ? `${pdfSafe(label)}: ` : "";
    const text = `${prefix}${pdfSafe(value)}`;
    doc.setFont(mono ? "courier" : "helvetica", "normal");
    doc.setFontSize(9.5);
    const lines = doc.splitTextToSize(text, contentWidth - indent);
    for (const line of lines) {
      ensureSpace(6);
      doc.text(line, margin + indent, y);
      y += 4.8;
    }
  };

  // Title banner
  doc.setFillColor(2, 6, 23);
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(52, 211, 153);
  doc.text("SABOOT - FORENSIC RENTAL VERDICT CERTIFICATE", margin, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `Generated: ${formatDate(new Date())}  |  Deterministic SHA-256 + Two-Pass AI Audit`,
    margin,
    20
  );

  doc.setTextColor(30, 41, 59);
  y = 36;

  // 1. Rental Overview
  writeSectionHeader("1. RENTAL & CASE METADATA");
  writeWrappedLine("Rental ID", rental?._id || settlement?.rentalId?._id || "N/A", { mono: true });
  writeWrappedLine("Item Title", rental?.title || settlement?.rentalId?.title || "Untitled Rental");
  writeWrappedLine(
    "Category / Status",
    `${rental?.category || "general"}  |  Rental: ${rental?.status || "N/A"}  |  HITL: ${settlement?.hitlStatus || "N/A"}`
  );
  writeWrappedLine(
    "Parties",
    `Owner: ${rental?.ownerName || "N/A"}  |  Renter: ${rental?.renterName || "N/A"}`
  );
  writeWrappedLine("Due Date", formatDate(rental?.dueDate));

  // 2. Cryptographic Baseline Seal
  writeSectionHeader("2. CRYPTOGRAPHIC SHA-256 BASELINE SEAL");
  const sealValid =
    sealVerification?.valid !== undefined
      ? sealVerification.valid
      : inspection?.hashIntegrityPassed;
  const integrityLabel =
    sealValid === true
      ? "VERIFIED INTACT (SHA-256 MATCH)"
      : sealValid === false
      ? "TAMPER ALERT (HASH MISMATCH)"
      : "UNVERIFIED";

  writeWrappedLine("Integrity Verdict", integrityLabel);
  writeWrappedLine(
    "Sealed SHA-256 Hash",
    rental?.baselineSeal?.sha256Hash || sealVerification?.expectedHash || "N/A",
    { mono: true }
  );
  if (sealValid === false && sealVerification?.actualHash) {
    writeWrappedLine("Recomputed Hash", sealVerification.actualHash, { mono: true });
  }
  if (sealValid === false && sealVerification?.tamperedFieldHint) {
    writeWrappedLine("Tamper Hint", sealVerification.tamperedFieldHint);
  }
  writeWrappedLine("Sealed At", formatDate(rental?.baselineSeal?.sealedAt));
  if (rental?.baselineSeal?.summary) {
    writeWrappedLine("Baseline Summary", rental.baselineSeal.summary);
  }
  const accessories = rental?.baselineSeal?.accessoriesPresent || [];
  writeWrappedLine(
    "Accessories Sealed at Check-In",
    accessories.length > 0 ? accessories.join(", ") : "None recorded"
  );

  // 3. Pre-Existing Flaws Ignored (Rs. 0)
  writeSectionHeader("3. PRE-EXISTING FLAWS IGNORED (Rs. 0 CHARGED TO RENTER)");
  const ignoredList = inspection?.preExistingIgnored || [];
  const baselineFlaws = rental?.baselineSeal?.preExistingFlaws || [];

  if (ignoredList.length > 0) {
    ignoredList.forEach((item, idx) => {
      writeWrappedLine(
        `${idx + 1}. [${item.zone || "zone"}]`,
        `${item.description || ""} (${item.reason || "Matched Check-In seal; Rs. 0"})`,
        { indent: 2 }
      );
    });
  } else if (baselineFlaws.length > 0) {
    baselineFlaws.forEach((flaw, idx) => {
      writeWrappedLine(
        `${idx + 1}. [${flaw.zone || "zone"} | ${flaw.severity || "minor"}]`,
        `${flaw.description || ""} (Sealed at Check-In; Rs. 0)`,
        { indent: 2 }
      );
    });
  } else {
    writeWrappedLine("", "No pre-existing flaws recorded at Check-In (Rs. 0).", {
      indent: 2,
    });
  }

  // 4. Itemized Deductions
  writeSectionHeader("4. NEW DAMAGE & MISSING ACCESSORY DEDUCTIONS");
  const lineItems = settlement?.lineItems || [];
  if (lineItems.length > 0) {
    lineItems.forEach((item, idx) => {
      writeWrappedLine(
        `${idx + 1}. ${formatRs(item.deductionAmount)} [${item.type || "damage"} / ${item.severity || "minor"}]`,
        `${item.findingDescription || ""} (Source: ${item.rateSourceLabel || "Benchmark"})`,
        { indent: 2 }
      );
    });
  } else {
    writeWrappedLine("", "No new billable damage or missing accessories (Rs. 0).", {
      indent: 2,
    });
  }

  // 5. Reviewer QA Gate Audit
  writeSectionHeader("5. REVIEWER QA GATE (ADVERSARIAL AUDIT)");
  const gate = settlement?.reviewerGate;
  if (gate) {
    writeWrappedLine(
      "QA Verdict & Confidence",
      `${gate.verdict || "N/A"} (${gate.confidence ?? "N/A"}% confidence)`
    );
    writeWrappedLine(
      "Audit Flags",
      gate.flags && gate.flags.length > 0 ? gate.flags.join(" | ") : "None"
    );
    writeWrappedLine("Audit Reasoning", gate.auditReasoning || "N/A");
  } else {
    writeWrappedLine("", "No Reviewer QA Gate record attached.");
  }

  // 6. Final Deposit Split
  writeSectionHeader("6. FINAL SETTLEMENT LEDGER");
  const depositAmount =
    settlement?.depositAmount ?? rental?.depositAmount ?? 0;
  const aiTotalDeduction = settlement?.totalDeduction ?? 0;
  const hasOverride =
    settlement?.overrideTotalDeduction !== null &&
    settlement?.overrideTotalDeduction !== undefined;
  const finalDeduction = hasOverride
    ? settlement.overrideTotalDeduction
    : aiTotalDeduction;
  const refundToRenter =
    settlement?.refundToRenter ?? Math.max(0, depositAmount - finalDeduction);

  writeWrappedLine("Security Deposit Held", formatRs(depositAmount), { mono: true });
  writeWrappedLine("AI Proposed Deduction", formatRs(aiTotalDeduction), { mono: true });
  if (hasOverride) {
    writeWrappedLine(
      "HITL Override Deduction",
      formatRs(settlement.overrideTotalDeduction),
      { mono: true }
    );
  }
  writeWrappedLine("Final Deduction to Owner", formatRs(finalDeduction), { mono: true });
  writeWrappedLine("Final Refund to Renter", formatRs(refundToRenter), { mono: true });
  if (settlement?.finalOverrideNote) {
    writeWrappedLine("HITL Decision Note", settlement.finalOverrideNote);
  }
  if (settlement?.decidedAt) {
    writeWrappedLine("Decision Timestamp", formatDate(settlement.decidedAt));
  }

  const idSuffix = String(
    rental?._id || settlement?._id || "report"
  ).slice(-8);
  const fileName = `saboot-verdict-${idSuffix}.pdf`;
  doc.save(fileName);
  return fileName;
}
