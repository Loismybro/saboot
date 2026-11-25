import crypto from "crypto";

export function sha256Buffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function computeBaselineSealHash({
  imageHashes = [],
  preExistingFlaws = [],
  accessoriesPresent = [],
}) {
  const canonical = {
    imageHashes: [...imageHashes].sort(),
    preExistingFlaws: [...preExistingFlaws]
      .map((f) => ({
        zone: String(f.zone || ""),
        description: String(f.description || ""),
        severity: String(f.severity || ""),
      }))
      .sort((a, b) =>
        (a.zone + a.description).localeCompare(b.zone + b.description)
      ),
    accessoriesPresent: [...accessoriesPresent].map(String).sort(),
  };

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonical))
    .digest("hex");
}

export function verifyRentalSeal(rental) {
  if (!rental || !rental.baselineSeal) {
    return {
      valid: false,
      expectedHash: null,
      actualHash: null,
      tamperedFieldHint: "Missing baselineSeal",
    };
  }

  const storedImages = rental.checkinImages || [];
  const recomputedImageHashes = [];

  for (let i = 0; i < storedImages.length; i++) {
    const img = storedImages[i];
    const buf = Buffer.from(img.base64 || "", "base64");
    const actualImgHash = sha256Buffer(buf);
    if (actualImgHash !== img.sha256) {
      return {
        valid: false,
        expectedHash: rental.baselineSeal.sha256Hash,
        actualHash: actualImgHash,
        tamperedFieldHint: `Check-in image "${img.label || i}" buffer modified`,
      };
    }
    recomputedImageHashes.push(actualImgHash);
  }

  const expectedSealImageHashes = [...(rental.baselineSeal.imageHashes || [])]
    .sort()
    .join(",");
  const actualSealImageHashes = [...recomputedImageHashes].sort().join(",");
  if (expectedSealImageHashes !== actualSealImageHashes) {
    return {
      valid: false,
      expectedHash: rental.baselineSeal.sha256Hash,
      actualHash: null,
      tamperedFieldHint: "Image set does not match sealed baseline imageHashes",
    };
  }

  const actualHash = computeBaselineSealHash({
    imageHashes: recomputedImageHashes,
    preExistingFlaws: rental.baselineSeal.preExistingFlaws || [],
    accessoriesPresent: rental.baselineSeal.accessoriesPresent || [],
  });

  const expectedHash = rental.baselineSeal.sha256Hash;
  const valid = actualHash === expectedHash;

  return {
    valid,
    expectedHash,
    actualHash,
    tamperedFieldHint: valid
      ? null
      : "Baseline JSON ledger (preExistingFlaws or accessoriesPresent) does not match SHA-256 seal",
  };
}
