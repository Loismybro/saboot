import express from "express";
import { RepairRate } from "../models/RepairRate.js";
import { runSeedData } from "../seed/seedData.js";

const router = express.Router();

router.post("/seed", async (req, res, next) => {
  try {
    const result = await runSeedData();
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

router.get("/rates", async (req, res, next) => {
  try {
    const rates = await RepairRate.find().sort({ category: 1, itemKeyword: 1 });
    res.json({ ok: true, count: rates.length, rates });
  } catch (err) {
    next(err);
  }
});

export default router;
