import { Router } from "express";
import asyncHandler from "../middleware/asyncHandler.js";
import {
  getLaborMonthlyReport,
  getLaborSummaryReport,
  getLaborWeeklyReport,
  getPartyMonthlyOutstandingReport,
  getRoznamchaDailyReport,
  getRoznamchaMonthlyReport,
  getRoznamchaSummaryReport,
  getRoznamchaWeeklyReport,
} from "../controllers/reportController.js";

const router = Router();

router.get("/roznamcha/summary", asyncHandler(getRoznamchaSummaryReport));
router.get("/roznamcha/daily", asyncHandler(getRoznamchaDailyReport));
router.get("/roznamcha/weekly", asyncHandler(getRoznamchaWeeklyReport));
router.get("/roznamcha/monthly", asyncHandler(getRoznamchaMonthlyReport));

router.get("/labor/summary", asyncHandler(getLaborSummaryReport));
router.get("/labor/weekly", asyncHandler(getLaborWeeklyReport));
router.get("/labor/monthly", asyncHandler(getLaborMonthlyReport));

router.get(
  "/parties/monthly-outstanding",
  asyncHandler(getPartyMonthlyOutstandingReport),
);

export default router;
