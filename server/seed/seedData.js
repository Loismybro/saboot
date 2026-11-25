import sharp from "sharp";
import { RepairRate } from "../models/RepairRate.js";
import { Rental } from "../models/Rental.js";
import { Inspection } from "../models/Inspection.js";
import { Settlement } from "../models/Settlement.js";
import { computeBaselineSealHash, sha256Buffer } from "../utils/hash.js";

const SOURCE_LABEL = "Indian local repair benchmark (2026)";

export const REPAIR_RATES_SEED = [
  // Electronics (laptops, tablets, audio)
  { category: "electronics", itemKeyword: "charger", severity: "missing", costInr: 1400, sourceLabel: SOURCE_LABEL },
  { category: "electronics", itemKeyword: "cable", severity: "missing", costInr: 350, sourceLabel: SOURCE_LABEL },
  { category: "electronics", itemKeyword: "mouse", severity: "missing", costInr: 600, sourceLabel: SOURCE_LABEL },
  { category: "electronics", itemKeyword: "bag", severity: "missing", costInr: 900, sourceLabel: SOURCE_LABEL },
  { category: "electronics", itemKeyword: "scratch", severity: "minor", costInr: 300, sourceLabel: SOURCE_LABEL },
  { category: "electronics", itemKeyword: "scratch", severity: "moderate", costInr: 800, sourceLabel: SOURCE_LABEL },
  { category: "electronics", itemKeyword: "scratch", severity: "severe", costInr: 2000, sourceLabel: SOURCE_LABEL },
  { category: "electronics", itemKeyword: "mark", severity: "minor", costInr: 250, sourceLabel: SOURCE_LABEL },
  { category: "electronics", itemKeyword: "mark", severity: "moderate", costInr: 650, sourceLabel: SOURCE_LABEL },
  { category: "electronics", itemKeyword: "dent", severity: "minor", costInr: 450, sourceLabel: SOURCE_LABEL },
  { category: "electronics", itemKeyword: "dent", severity: "moderate", costInr: 1100, sourceLabel: SOURCE_LABEL },
  { category: "electronics", itemKeyword: "crack", severity: "minor", costInr: 750, sourceLabel: SOURCE_LABEL },
  { category: "electronics", itemKeyword: "crack", severity: "moderate", costInr: 1800, sourceLabel: SOURCE_LABEL },
  { category: "electronics", itemKeyword: "crack", severity: "severe", costInr: 4500, sourceLabel: SOURCE_LABEL },

  // Camera gear
  { category: "camera", itemKeyword: "lens cap", severity: "missing", costInr: 450, sourceLabel: SOURCE_LABEL },
  { category: "camera", itemKeyword: "strap", severity: "missing", costInr: 500, sourceLabel: SOURCE_LABEL },
  { category: "camera", itemKeyword: "battery", severity: "missing", costInr: 1800, sourceLabel: SOURCE_LABEL },
  { category: "camera", itemKeyword: "charger", severity: "missing", costInr: 1500, sourceLabel: SOURCE_LABEL },
  { category: "camera", itemKeyword: "filter", severity: "minor", costInr: 600, sourceLabel: SOURCE_LABEL },
  { category: "camera", itemKeyword: "filter", severity: "severe", costInr: 1200, sourceLabel: SOURCE_LABEL },
  { category: "camera", itemKeyword: "scratch", severity: "minor", costInr: 400, sourceLabel: SOURCE_LABEL },
  { category: "camera", itemKeyword: "scratch", severity: "moderate", costInr: 1200, sourceLabel: SOURCE_LABEL },
  { category: "camera", itemKeyword: "crack", severity: "severe", costInr: 5000, sourceLabel: SOURCE_LABEL },

  // Bike gear & 2-wheelers
  { category: "bike_gear", itemKeyword: "visor", severity: "minor", costInr: 450, sourceLabel: SOURCE_LABEL },
  { category: "bike_gear", itemKeyword: "visor", severity: "moderate", costInr: 950, sourceLabel: SOURCE_LABEL },
  { category: "bike_gear", itemKeyword: "visor", severity: "missing", costInr: 1500, sourceLabel: SOURCE_LABEL },
  { category: "bike_gear", itemKeyword: "strap", severity: "missing", costInr: 400, sourceLabel: SOURCE_LABEL },
  { category: "bike_gear", itemKeyword: "key", severity: "missing", costInr: 500, sourceLabel: SOURCE_LABEL },
  { category: "bike_gear", itemKeyword: "scratch", severity: "minor", costInr: 300, sourceLabel: SOURCE_LABEL },
  { category: "bike_gear", itemKeyword: "scratch", severity: "moderate", costInr: 750, sourceLabel: SOURCE_LABEL },
  { category: "bike_gear", itemKeyword: "dent", severity: "moderate", costInr: 900, sourceLabel: SOURCE_LABEL },
  { category: "bike_gear", itemKeyword: "dent", severity: "severe", costInr: 2000, sourceLabel: SOURCE_LABEL },

  // PG Room & Flat fixtures
  { category: "pg_room", itemKeyword: "key", severity: "missing", costInr: 350, sourceLabel: SOURCE_LABEL },
  { category: "pg_room", itemKeyword: "remote", severity: "missing", costInr: 450, sourceLabel: SOURCE_LABEL },
  { category: "pg_room", itemKeyword: "mark", severity: "minor", costInr: 350, sourceLabel: SOURCE_LABEL },
  { category: "pg_room", itemKeyword: "mark", severity: "moderate", costInr: 850, sourceLabel: SOURCE_LABEL },
  { category: "pg_room", itemKeyword: "scratch", severity: "minor", costInr: 300, sourceLabel: SOURCE_LABEL },
  { category: "pg_room", itemKeyword: "crack", severity: "moderate", costInr: 1200, sourceLabel: SOURCE_LABEL },
  { category: "pg_room", itemKeyword: "crack", severity: "severe", costInr: 2800, sourceLabel: SOURCE_LABEL },

  // General fallbacks
  { category: "general", itemKeyword: "scratch", severity: "minor", costInr: 350, sourceLabel: SOURCE_LABEL },
  { category: "general", itemKeyword: "scratch", severity: "moderate", costInr: 900, sourceLabel: SOURCE_LABEL },
  { category: "general", itemKeyword: "scratch", severity: "severe", costInr: 2200, sourceLabel: SOURCE_LABEL },
  { category: "general", itemKeyword: "mark", severity: "minor", costInr: 250, sourceLabel: SOURCE_LABEL },
  { category: "general", itemKeyword: "mark", severity: "moderate", costInr: 650, sourceLabel: SOURCE_LABEL },
  { category: "general", itemKeyword: "dent", severity: "minor", costInr: 400, sourceLabel: SOURCE_LABEL },
  { category: "general", itemKeyword: "dent", severity: "moderate", costInr: 1000, sourceLabel: SOURCE_LABEL },
  { category: "general", itemKeyword: "crack", severity: "minor", costInr: 600, sourceLabel: SOURCE_LABEL },
  { category: "general", itemKeyword: "crack", severity: "moderate", costInr: 1400, sourceLabel: SOURCE_LABEL },
  { category: "general", itemKeyword: "crack", severity: "severe", costInr: 2800, sourceLabel: SOURCE_LABEL },
  { category: "general", itemKeyword: "charger", severity: "missing", costInr: 950, sourceLabel: SOURCE_LABEL },
  { category: "general", itemKeyword: "cable", severity: "missing", costInr: 300, sourceLabel: SOURCE_LABEL },
];

async function renderSyntheticWebp(svgMarkup, label) {
  const buf = await sharp(Buffer.from(svgMarkup))
    .resize({ width: 800, height: 500, fit: "inside" })
    .webp({ quality: 80 })
    .toBuffer();

  return {
    label,
    mimeType: "image/webp",
    base64: buf.toString("base64"),
    sha256: sha256Buffer(buf),
  };
}

function makeCameraSvg({ showNewDamage = false, missingCap = false }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
    <rect width="800" height="500" fill="#0f172a"/>
    <rect x="60" y="70" width="440" height="320" rx="28" fill="#1e293b" stroke="#475569" stroke-width="4"/>
    <circle cx="280" cy="230" r="95" fill="#020617" stroke="#94a3b8" stroke-width="8"/>
    <circle cx="280" cy="230" r="62" fill="#0f172a" stroke="#38bdf8" stroke-width="3"/>
    <path d="M 110 120 L 165 135" stroke="#fbbf24" stroke-width="4" stroke-linecap="round"/>
    <text x="85" y="105" fill="#fbbf24" font-size="16" font-family="sans-serif">PRE-EXISTING CORNER SCUFF</text>
    ${
      showNewDamage
        ? `<line x1="230" y1="185" x2="335" y2="275" stroke="#f43f5e" stroke-width="7" stroke-linecap="round"/>
           <text x="200" y="355" fill="#fb7185" font-size="18" font-family="sans-serif">NEW LENS GLASS CRACK</text>`
        : ""
    }
    <rect x="540" y="100" width="200" height="120" rx="16" fill="#1e293b" stroke="#475569" stroke-width="3"/>
    <text x="560" y="165" fill="#e2e8f0" font-size="18" font-family="sans-serif">NP-FW50 Battery</text>
    ${
      missingCap
        ? `<rect x="540" y="255" width="200" height="120" rx="16" fill="#0f172a" stroke="#f43f5e" stroke-dasharray="8 6" stroke-width="3"/>
           <text x="565" y="320" fill="#fb7185" font-size="18" font-family="sans-serif">LENS CAP MISSING</text>`
        : `<circle cx="640" cy="315" r="55" fill="#334155" stroke="#34d399" stroke-width="4"/>
           <text x="595" y="321" fill="#34d399" font-size="18" font-family="sans-serif">Lens Cap</text>`
    }
    <text x="60" y="450" fill="#94a3b8" font-size="18" font-family="monospace">SYNTHETIC DEMO ASSET - SONY A6400 KIT</text>
  </svg>`;
}

function makeLaptopSvg({ showNewMark = false, missingCharger = false }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
    <rect width="800" height="500" fill="#0f172a"/>
    <rect x="70" y="80" width="430" height="290" rx="20" fill="#334155" stroke="#64748b" stroke-width="4"/>
    <rect x="95" y="105" width="380" height="240" rx="8" fill="#020617"/>
    <path d="M 410 100 L 460 112" stroke="#fbbf24" stroke-width="4" stroke-linecap="round"/>
    <text x="275" y="98" fill="#fbbf24" font-size="14" font-family="sans-serif">PRE-EXISTING LID SCRATCH</text>
    ${
      showNewMark
        ? `<rect x="195" y="185" width="160" height="55" rx="8" fill="#f43f5e"/>
           <text x="210" y="218" fill="#ffffff" font-size="16" font-family="sans-serif">NEW STICKER/MARK</text>`
        : ""
    }
    ${
      missingCharger
        ? `<rect x="545" y="140" width="195" height="170" rx="16" fill="#0f172a" stroke="#f43f5e" stroke-dasharray="8 6" stroke-width="3"/>
           <text x="565" y="230" fill="#fb7185" font-size="18" font-family="sans-serif">CHARGER MISSING</text>`
        : `<rect x="555" y="150" width="175" height="145" rx="16" fill="#1e293b" stroke="#34d399" stroke-width="4"/>
           <text x="580" y="228" fill="#34d399" font-size="18" font-family="sans-serif">USB-C Charger</text>`
    }
    <text x="70" y="445" fill="#94a3b8" font-size="18" font-family="monospace">SYNTHETIC DEMO ASSET - MACBOOK AIR M2 KIT</text>
  </svg>`;
}

export async function runSeedData() {
  const rateOps = REPAIR_RATES_SEED.map((rate) => ({
    updateOne: {
      filter: {
        category: rate.category,
        itemKeyword: rate.itemKeyword,
        severity: rate.severity,
      },
      update: { $set: rate },
      upsert: true,
    },
  }));

  const rateBulkResult = await RepairRate.bulkWrite(rateOps);
  const totalRates = await RepairRate.countDocuments();

  let rentalsCreated = 0;

  // Demo 1: CHECKED_IN Sony A6400 Kit (ready for live Check-Out or Tamper demo)
  const demo1Title = "Sony A6400 Mirrorless Kit (Synthetic Demo)";
  const existing1 = await Rental.findOne({ title: demo1Title });
  if (!existing1) {
    const img1 = await renderSyntheticWebp(
      makeCameraSvg({ showNewDamage: false, missingCap: false }),
      "demo-camera-checkin-front.webp"
    );
    const flaws1 = [
      {
        zone: "top-left body corner",
        description: "Minor surface scuff on magnesium body corner",
        severity: "minor",
      },
    ];
    const acc1 = ["lens cap", "battery", "carry strap"];
    const sealHash1 = computeBaselineSealHash({
      imageHashes: [img1.sha256],
      preExistingFlaws: flaws1,
      accessoriesPresent: acc1,
    });

    await Rental.create({
      title: demo1Title,
      category: "camera",
      ownerName: "Kabir Malhotra (Demo)",
      renterName: "Vikram Nair (Demo)",
      depositAmount: 3000,
      dueDate: new Date(Date.now() - 2 * 60 * 60 * 1000), // Slightly overdue for cron demo
      status: "CHECKED_IN",
      checkinImages: [img1],
      baselineSeal: {
        sha256Hash: sealHash1,
        sealedAt: new Date(),
        imageHashes: [img1.sha256],
        preExistingFlaws: flaws1,
        accessoriesPresent: acc1,
        summary:
          "Camera body intact with one minor pre-existing scuff on top-left corner; lens cap, battery, and carry strap present.",
      },
    });
    rentalsCreated++;
  }

  // Demo 2: UNDER_REVIEW MacBook Air M2 Kit (pre-populated Inspection + Settlement)
  const demo2Title = "MacBook Air M2 Study Kit (Synthetic Demo)";
  const existing2 = await Rental.findOne({ title: demo2Title });
  let needsDemo2 = !existing2;
  if (existing2) {
    const existingSettlement = await Settlement.findOne({ rentalId: existing2._id });
    if (!existingSettlement) {
      await Inspection.deleteMany({ rentalId: existing2._id });
      await Rental.deleteOne({ _id: existing2._id });
      needsDemo2 = true;
    }
  }
  if (needsDemo2) {
    const inImg = await renderSyntheticWebp(
      makeLaptopSvg({ showNewMark: false, missingCharger: false }),
      "demo-laptop-checkin.webp"
    );
    const outImg = await renderSyntheticWebp(
      makeLaptopSvg({ showNewMark: true, missingCharger: true }),
      "demo-laptop-checkout.webp"
    );
    const flaws2 = [
      {
        zone: "top-right aluminum lid",
        description: "Light hairline scratch near top-right lid corner",
        severity: "minor",
      },
    ];
    const acc2 = ["charger", "usb-c cable"];
    const sealHash2 = computeBaselineSealHash({
      imageHashes: [inImg.sha256],
      preExistingFlaws: flaws2,
      accessoriesPresent: acc2,
    });

    const rental2 = await Rental.create({
      title: demo2Title,
      category: "electronics",
      ownerName: "Ananya Verma (Demo)",
      renterName: "Siddharth Rao (Demo)",
      depositAmount: 5000,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: "UNDER_REVIEW",
      checkinImages: [inImg],
      baselineSeal: {
        sha256Hash: sealHash2,
        sealedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
        imageHashes: [inImg.sha256],
        preExistingFlaws: flaws2,
        accessoriesPresent: acc2,
        summary:
          "Laptop aluminum chassis clean except hairline scratch on top-right lid; USB-C charger and cable verified present.",
      },
    });

    const chargerRate = await RepairRate.findOne({
      category: "electronics",
      itemKeyword: "charger",
      severity: "missing",
    });
    const markRate = await RepairRate.findOne({
      category: "electronics",
      itemKeyword: "mark",
      severity: "minor",
    });

    const inspection2 = await Inspection.create({
      rentalId: rental2._id,
      hashIntegrityPassed: true,
      sameObjectConfirmed: true,
      qualityWarning: null,
      checkoutImages: [outImg],
      preExistingIgnored: [
        {
          zone: "top-right aluminum lid",
          description: "Light hairline scratch near top-right lid corner",
          reason: "Matched sealed Check-In baseline flaw; ₹0 charged to renter.",
        },
      ],
      newFindings: [
        {
          type: "damage",
          zone: "center display area",
          itemKeyword: "mark",
          description: "Visible new red mark/adhesive residue on center display",
          severity: "minor",
          evidenceNote: "Absent in Check-In baseline image; clearly visible in Check-Out.",
        },
        {
          type: "missing_accessory",
          zone: "accessories layout",
          itemKeyword: "charger",
          description: "USB-C power charger missing at check-out",
          severity: "missing",
          evidenceNote: "Verified present at Check-In; absent from Check-Out tray.",
        },
      ],
      agentTrace: [
        {
          step: "HASH_VERIFY",
          status: "PASS",
          detail: `SHA-256 baseline seal verified (${sealHash2.slice(0, 16)}...)`,
          durationMs: 4,
        },
        {
          step: "FORENSIC_DIFF",
          status: "PASS",
          detail: "Ignored 1 pre-existing scratch; isolated 1 new mark + 1 missing charger.",
          durationMs: 1420,
        },
        {
          step: "RATE_LOOKUP",
          status: "PASS",
          detail: "Matched deterministic Indian repair rates: ₹250 + ₹1400 = ₹1650.",
          durationMs: 12,
        },
        {
          step: "REVIEWER_QA_GATE",
          status: "PASS",
          detail: "Adversarial QA verified zero overlap with baseline flaws; deduction 33% of deposit.",
          durationMs: 910,
        },
      ],
    });

    const totalDeduction = 1650;
    await Settlement.create({
      rentalId: rental2._id,
      inspectionId: inspection2._id,
      depositAmount: 5000,
      lineItems: [
        {
          findingDescription: "Visible new red mark/adhesive residue on center display",
          type: "damage",
          severity: "minor",
          matchedRateId: markRate?._id || null,
          rateSourceLabel: markRate?.sourceLabel || SOURCE_LABEL,
          deductionAmount: 250,
        },
        {
          findingDescription: "USB-C power charger missing at check-out",
          type: "missing_accessory",
          severity: "missing",
          matchedRateId: chargerRate?._id || null,
          rateSourceLabel: chargerRate?.sourceLabel || SOURCE_LABEL,
          deductionAmount: 1400,
        },
      ],
      totalDeduction,
      refundToRenter: 5000 - totalDeduction,
      reviewerGate: {
        verdict: "PASS",
        confidence: 94,
        flags: [],
        auditReasoning:
          "SHA-256 seal intact. Pre-existing lid scratch properly excluded (₹0). New mark and missing charger are clearly evidenced and priced within benchmark rates.",
      },
      hitlStatus: "PENDING_APPROVAL",
    });

    rentalsCreated++;
  }

  return {
    repairRatesTotal: totalRates,
    repairRatesUpserted: rateBulkResult.upsertedCount,
    rentalsCreated,
  };
}
