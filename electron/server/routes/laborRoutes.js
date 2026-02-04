import { Router } from "express";
import asyncHandler from "../middleware/asyncHandler.js";
import {
  createLaborAdvance,
  createLaborProfile,
  createLaborWorkEntry,
  getLaborLedger,
  getMonthlyLaborSummary,
  getWeeklyLaborSummary,
  listLaborProfiles,
  upsertLaborRate,
} from "../controllers/laborController.js";

const router = Router();

router.get("/profiles", asyncHandler(listLaborProfiles));
router.post("/profiles", asyncHandler(createLaborProfile));
router.post("/rates", asyncHandler(upsertLaborRate));
router.post("/work", asyncHandler(createLaborWorkEntry));
router.post("/advances", asyncHandler(createLaborAdvance));
router.get("/:laborId/ledger", asyncHandler(getLaborLedger));
router.get("/summary/weekly", asyncHandler(getWeeklyLaborSummary));
router.get("/summary/monthly", asyncHandler(getMonthlyLaborSummary));

export default router;
