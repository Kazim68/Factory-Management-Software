import { Router } from "express";
import asyncHandler from "../middleware/asyncHandler.js";
import {
  createExpense,
  deleteExpense,
  getDailySummary,
  getMonthlySummary,
  getWeeklySummary,
  listExpenses,
  restoreExpense,
  updateExpense,
} from "../controllers/expenseController.js";

const router = Router();

router.get("/", asyncHandler(listExpenses));
router.post("/", asyncHandler(createExpense));
router.patch("/:expenseId", asyncHandler(updateExpense));
router.delete("/:expenseId", asyncHandler(deleteExpense));
router.post("/:expenseId/restore", asyncHandler(restoreExpense));
router.get("/summary/daily", asyncHandler(getDailySummary));
router.get("/summary/weekly", asyncHandler(getWeeklySummary));
router.get("/summary/monthly", asyncHandler(getMonthlySummary));

export default router;
