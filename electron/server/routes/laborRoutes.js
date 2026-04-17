import { Router } from "express";
import asyncHandler from "../middleware/asyncHandler.js";
import {
  createLaborAdvance,
  createLaborProfile,
  createLaborWorkEntry,
  getPrintableLaborWorkEntries,
  fireLaborProfile,
  deleteLaborAdvance,
  deleteLaborProfile,
  deleteLaborWorkEntry,
  getLaborLedger,
  getMonthlyLaborSummary,
  getWeeklyLaborSummary,
  listLaborAdvances,
  listLaborProfiles,
  listLaborWorkEntries,
  restoreLaborAdvance,
  restoreLaborProfile,
  restoreLaborWorkEntry,
  updateLaborAdvance,
  updateLaborProfile,
  updateLaborWorkEntry,
  upsertLaborRate,
} from "../controllers/laborController.js";

const router = Router();

router.get("/profiles", asyncHandler(listLaborProfiles));
router.post("/profiles", asyncHandler(createLaborProfile));
router.patch("/profiles/:laborId", asyncHandler(updateLaborProfile));
router.post("/profiles/:laborId/fire", asyncHandler(fireLaborProfile));
router.delete("/profiles/:laborId", asyncHandler(deleteLaborProfile));
router.post("/profiles/:laborId/restore", asyncHandler(restoreLaborProfile));
router.post("/rates", asyncHandler(upsertLaborRate));
router.get("/work", asyncHandler(listLaborWorkEntries));
router.post("/work", asyncHandler(createLaborWorkEntry));
router.get("/work/printable", asyncHandler(getPrintableLaborWorkEntries));
router.patch("/work/:workId", asyncHandler(updateLaborWorkEntry));
router.delete("/work/:workId", asyncHandler(deleteLaborWorkEntry));
router.post("/work/:workId/restore", asyncHandler(restoreLaborWorkEntry));
router.get("/advances", asyncHandler(listLaborAdvances));
router.post("/advances", asyncHandler(createLaborAdvance));
router.patch("/advances/:advanceId", asyncHandler(updateLaborAdvance));
router.delete("/advances/:advanceId", asyncHandler(deleteLaborAdvance));
router.post("/advances/:advanceId/restore", asyncHandler(restoreLaborAdvance));
router.get("/:laborId/ledger", asyncHandler(getLaborLedger));
router.get("/summary/weekly", asyncHandler(getWeeklyLaborSummary));
router.get("/summary/monthly", asyncHandler(getMonthlyLaborSummary));

export default router;
