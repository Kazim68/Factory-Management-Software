import { Router } from "express";
import asyncHandler from "../middleware/asyncHandler.js";
import {
  assignProductionOrderLabor,
  createManualStockEntry,
  createProductionOrder,
  deleteManualStockEntry,
  getPrintableProductionOrders,
  getStockSummary,
  listDepartmentLabors,
  listManualStockEntries,
  listProductionOrders,
  listStockByArticle,
  updateManualStockEntry,
  updateProductionOrder,
  updateProductionOrderCompletion,
} from "../controllers/productionController.js";

const router = Router();

router.get("/orders", asyncHandler(listProductionOrders));
router.get("/orders/printable", asyncHandler(getPrintableProductionOrders));
router.post("/orders", asyncHandler(createProductionOrder));
router.patch("/orders/:orderId", asyncHandler(updateProductionOrder));
router.patch(
  "/orders/:orderId/assign-labor",
  asyncHandler(assignProductionOrderLabor),
);
router.patch(
  "/orders/:orderId/completion",
  asyncHandler(updateProductionOrderCompletion),
);

router.get("/labors", asyncHandler(listDepartmentLabors));
router.get("/stock/summary", asyncHandler(getStockSummary));
router.get("/stock/articles", asyncHandler(listStockByArticle));
router.get("/stock/manual", asyncHandler(listManualStockEntries));
router.post("/stock/manual", asyncHandler(createManualStockEntry));
router.patch("/stock/manual/:entryId", asyncHandler(updateManualStockEntry));
router.delete("/stock/manual/:entryId", asyncHandler(deleteManualStockEntry));

export default router;
