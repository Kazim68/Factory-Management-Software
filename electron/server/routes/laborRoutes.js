import { Router } from "express";
import asyncHandler from "../middleware/asyncHandler.js";
import {
  createLaborAdvance,
  createLaborProfile,
  createLaborWorkEntry,
  fireLaborProfile,
  deleteLaborAdvance,
  deleteLaborProfile,
  deleteLaborWorkEntry,
  getLaborLedger,
  getMonthlyLaborSummary,
  getWeeklyLaborSummary,
  listLaborProfiles,
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
router.post("/rates", asyncHandler(upsertLaborRate));
router.post("/work", asyncHandler(createLaborWorkEntry));
router.patch("/work/:workId", asyncHandler(updateLaborWorkEntry));
router.delete("/work/:workId", asyncHandler(deleteLaborWorkEntry));
router.post("/advances", asyncHandler(createLaborAdvance));
router.patch("/advances/:advanceId", asyncHandler(updateLaborAdvance));
router.delete("/advances/:advanceId", asyncHandler(deleteLaborAdvance));
router.get("/:laborId/ledger", asyncHandler(getLaborLedger));
router.get("/summary/weekly", asyncHandler(getWeeklyLaborSummary));
router.get("/summary/monthly", asyncHandler(getMonthlyLaborSummary));

export default router;
