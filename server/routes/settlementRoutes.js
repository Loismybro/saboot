import express from "express";
import mongoose from "mongoose";
import { Settlement } from "../models/Settlement.js";
import { Rental } from "../models/Rental.js";

const router = express.Router();

const ALLOWED_HITL_STATUSES = new Set([
  "PENDING_APPROVAL",
  "APPROVED",
  "EDITED",
  "DISPUTED",
]);

const ALLOWED_ACTIONS = new Set(["APPROVE", "EDIT", "DISPUTE"]);

function createBadRequestError(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function validateObjectIdOr400(id, label = "settlement ID") {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createBadRequestError(`Invalid ${label} "${id}".`);
  }
}

router.get("/pending", async (req, res, next) => {
  try {
    const filter = {};
    const statusParam = req.query.status
      ? String(req.query.status).trim().toUpperCase()
      : "";

    if (statusParam && statusParam !== "ALL") {
      if (!ALLOWED_HITL_STATUSES.has(statusParam)) {
        throw createBadRequestError(
          `Invalid status filter "${statusParam}". Allowed: ${[...ALLOWED_HITL_STATUSES].join(", ")}.`
        );
      }
      filter.hitlStatus = statusParam;
    }

    const settlements = await Settlement.find(filter)
      .sort({ createdAt: -1 })
      .populate({ path: "rentalId", select: "-checkinImages" })
      .populate({ path: "inspectionId", select: "-checkoutImages" })
      .lean();

    res.json({
      ok: true,
      count: settlements.length,
      settlements,
    });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/decision", async (req, res, next) => {
  try {
    validateObjectIdOr400(req.params.id, "settlement ID");

    const { action, overrideTotalDeduction, note } = req.body || {};
    const normalizedAction =
      typeof action === "string" ? action.trim().toUpperCase() : "";

    if (!ALLOWED_ACTIONS.has(normalizedAction)) {
      throw createBadRequestError(
        `Invalid action "${action}". Allowed: APPROVE, EDIT, DISPUTE.`
      );
    }

    if (note !== undefined && note !== null && typeof note !== "string") {
      throw createBadRequestError("note must be a string.");
    }

    const settlement = await Settlement.findById(req.params.id);
    if (!settlement) {
      return res
        .status(404)
        .json({ ok: false, error: "Settlement not found." });
    }

    const rental = await Rental.findById(settlement.rentalId);
    if (!rental) {
      return res.status(404).json({
        ok: false,
        error: "Associated rental not found.",
      });
    }

    if (normalizedAction === "EDIT") {
      if (
        overrideTotalDeduction === undefined ||
        overrideTotalDeduction === null ||
        String(overrideTotalDeduction).trim() === ""
      ) {
        throw createBadRequestError(
          "overrideTotalDeduction is required when action is EDIT."
        );
      }

      const overrideVal = Number(overrideTotalDeduction);
      if (
        !Number.isFinite(overrideVal) ||
        overrideVal < 0 ||
        overrideVal > settlement.depositAmount
      ) {
        throw createBadRequestError(
          `overrideTotalDeduction must be a finite number between 0 and depositAmount (${settlement.depositAmount}).`
        );
      }

      settlement.overrideTotalDeduction = overrideVal;
      settlement.refundToRenter = Number(
        (settlement.depositAmount - overrideVal).toFixed(2)
      );
      settlement.hitlStatus = "EDITED";
      rental.status = "SETTLED";
    } else if (normalizedAction === "APPROVE") {
      const effectiveDeduction =
        settlement.overrideTotalDeduction !== null &&
        settlement.overrideTotalDeduction !== undefined
          ? settlement.overrideTotalDeduction
          : settlement.totalDeduction;

      settlement.refundToRenter = Number(
        Math.max(0, settlement.depositAmount - effectiveDeduction).toFixed(2)
      );
      settlement.hitlStatus = "APPROVED";
      rental.status = "SETTLED";
    } else if (normalizedAction === "DISPUTE") {
      settlement.hitlStatus = "DISPUTED";
      rental.status = "DISPUTED";
    }

    if (note !== undefined) {
      settlement.finalOverrideNote = note === null ? "" : note.trim();
    }
    settlement.decidedAt = new Date();

    await Promise.all([settlement.save(), rental.save()]);

    res.json({
      ok: true,
      settlement,
      rental,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
