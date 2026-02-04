import { Router } from "express";
import asyncHandler from "../middleware/asyncHandler.js";
import {
  createArticle,
  createExpenseCategory,
  createLaborCategory,
  createPaymentType,
  createUnit,
  listArticles,
  listExpenseCategories,
  listLaborCategories,
  listPaymentTypes,
  listUnits,
} from "../controllers/configController.js";

const router = Router();

router.get("/units", asyncHandler(listUnits));
router.post("/units", asyncHandler(createUnit));

router.get("/articles", asyncHandler(listArticles));
router.post("/articles", asyncHandler(createArticle));

router.get("/labor-categories", asyncHandler(listLaborCategories));
router.post("/labor-categories", asyncHandler(createLaborCategory));

router.get("/payment-types", asyncHandler(listPaymentTypes));
router.post("/payment-types", asyncHandler(createPaymentType));

router.get("/expense-categories", asyncHandler(listExpenseCategories));
router.post("/expense-categories", asyncHandler(createExpenseCategory));

export default router;
