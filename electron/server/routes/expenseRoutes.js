import { Router } from "express";
import asyncHandler from "../middleware/asyncHandler.js";
import {
  createExpense,
  getDailySummary,
  getMonthlySummary,
  getWeeklySummary,
  listExpenses,
} from "../controllers/expenseController.js";

const router = Router();

router.get("/", asyncHandler(listExpenses));
router.post("/", asyncHandler(createExpense));
router.get("/summary/daily", asyncHandler(getDailySummary));
router.get("/summary/weekly", asyncHandler(getWeeklySummary));
router.get("/summary/monthly", asyncHandler(getMonthlySummary));

export default router;
