import cron from "node-cron";
import { getDbState } from "../config/db.js";
import { Rental } from "../models/Rental.js";

const OVERDUE_NOTE = "Checkout overdue — follow-up inspection required";
let scheduledTask = null;

/**
 * Scans CHECKED_IN rentals whose dueDate has passed and flags unflagged
 * records with an overdueAlert in MongoDB.
 */
export async function runOverdueScan() {
  if (getDbState() !== "connected") {
    const err = new Error("Cannot run overdue scan while database is disconnected.");
    err.status = 503;
    throw err;
  }

  const scannedAt = new Date();
  const candidates = await Rental.find({
    status: "CHECKED_IN",
    dueDate: { $lt: scannedAt },
    "overdueAlert.flagged": { $ne: true },
  })
    .select("_id")
    .lean();

  const ids = candidates.map((doc) => doc._id);
  let flaggedCount = 0;
  let rentals = [];

  if (ids.length > 0) {
    const updateResult = await Rental.updateMany(
      {
        _id: { $in: ids },
        status: "CHECKED_IN",
        "overdueAlert.flagged": { $ne: true },
      },
      {
        $set: {
          overdueAlert: {
            flagged: true,
            flaggedAt: scannedAt,
            note: OVERDUE_NOTE,
          },
        },
      }
    );

    flaggedCount = updateResult.modifiedCount ?? ids.length;
    rentals = await Rental.find({ _id: { $in: ids } })
      .select("-checkinImages -tamperBackup")
      .lean();
  }

  return {
    ok: true,
    scannedAt: scannedAt.toISOString(),
    flaggedCount,
    rentals,
  };
}

/**
 * Schedules a recurring 15-minute cron job to scan for overdue rentals without
 * crashing the server if the database is temporarily unavailable.
 */
export function startOverdueCron() {
  if (scheduledTask) {
    return scheduledTask;
  }

  scheduledTask = cron.schedule("*/15 * * * *", async () => {
    if (getDbState() !== "connected") {
      console.warn("[overdueJob] Skipping scheduled scan: database is not connected.");
      return;
    }

    try {
      const result = await runOverdueScan();
      if (result.flaggedCount > 0) {
        console.log(
          `[overdueJob] Flagged ${result.flaggedCount} overdue rental(s) at ${result.scannedAt}`
        );
      }
    } catch (err) {
      console.error("[overdueJob] Scheduled overdue scan failed:", err.message);
    }
  });

  console.log('[overdueJob] Scheduled overdue rental scan ("*/15 * * * *")');
  return scheduledTask;
}
