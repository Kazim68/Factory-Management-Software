import { Router } from "express";
import asyncHandler from "../middleware/asyncHandler.js";
import {
  assignProductionOrderLabor,
  createProductionOrder,
  getStockSummary,
  listDepartmentLabors,
  listProductionOrders,
  listStockByArticle,
  updateProductionOrder,
  updateProductionOrderCompletion,
} from "../controllers/productionController.js";

const router = Router();

router.get("/orders", asyncHandler(listProductionOrders));
router.post("/orders", asyncHandler(createProductionOrder));
router.patch("/orders/:orderId", asyncHandler(updateProductionOrder));
router.patch("/orders/:orderId/assign-labor", asyncHandler(assignProductionOrderLabor));
router.patch("/orders/:orderId/completion", asyncHandler(updateProductionOrderCompletion));

router.get("/labors", asyncHandler(listDepartmentLabors));
router.get("/stock/summary", asyncHandler(getStockSummary));
router.get("/stock/articles", asyncHandler(listStockByArticle));

export default router;
