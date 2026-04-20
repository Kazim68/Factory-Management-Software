import { Router } from "express";
import asyncHandler from "../middleware/asyncHandler.js";
import {
  createArticle,
  createLaborCategory,
  createUnit,
  deleteArticle,
  deleteLaborCategory,
  deleteUnit,
  listArticles,
  listLaborCategories,
  listUnits,
  restoreArticle,
  restoreUnit,
  updateArticle,
  updateLaborCategory,
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

export default router;
