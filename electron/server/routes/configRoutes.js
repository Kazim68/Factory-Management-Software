import { Router } from "express";
import asyncHandler from "../middleware/asyncHandler.js";
import {
  createArticle,
  createLaborCategory,
  createPaymentType,
  createUnit,
  deleteArticle,
  deleteLaborCategory,
  deletePaymentType,
  deleteUnit,
  listArticles,
  listLaborCategories,
  listPaymentTypes,
  listUnits,
  restoreArticle,
  restorePaymentType,
  restoreUnit,
  updateArticle,
  updateLaborCategory,
  updatePaymentType,
  updateUnit,
} from "../controllers/configController.js";

const router = Router();

router.get("/units", asyncHandler(listUnits));
router.post("/units", asyncHandler(createUnit));
router.patch("/units/:unitId", asyncHandler(updateUnit));
router.delete("/units/:unitId", asyncHandler(deleteUnit));
router.post("/units/:unitId/restore", asyncHandler(restoreUnit));

router.get("/articles", asyncHandler(listArticles));
router.post("/articles", asyncHandler(createArticle));
router.patch("/articles/:articleId", asyncHandler(updateArticle));
router.delete("/articles/:articleId", asyncHandler(deleteArticle));
router.post("/articles/:articleId/restore", asyncHandler(restoreArticle));

router.get("/labor-categories", asyncHandler(listLaborCategories));
router.post("/labor-categories", asyncHandler(createLaborCategory));
router.patch(
  "/labor-categories/:categoryId",
  asyncHandler(updateLaborCategory),
);
router.delete(
  "/labor-categories/:categoryId",
  asyncHandler(deleteLaborCategory),
);

router.get("/payment-types", asyncHandler(listPaymentTypes));
router.post("/payment-types", asyncHandler(createPaymentType));
router.patch("/payment-types/:paymentTypeId", asyncHandler(updatePaymentType));
router.delete("/payment-types/:paymentTypeId", asyncHandler(deletePaymentType));
router.post(
  "/payment-types/:paymentTypeId/restore",
  asyncHandler(restorePaymentType),
);

export default router;
