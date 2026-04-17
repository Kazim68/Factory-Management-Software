import { Router } from "express";
import asyncHandler from "../middleware/asyncHandler.js";
import {
  assignProductionOrderLabor,
  createBulkProductionOrders,
  createMallStockMovement,
  createManualStockEntry,
  createProductionOrder,
  deleteProductionOrder,
  deleteMallStockMovement,
  deleteManualStockEntry,
  getPrintableProductionOrders,
  getPrintableDailyPressmanOrders,
  getStockSummary,
  listDepartmentLabors,
  listMallStockMovements,
  listManualStockEntries,
  listProductionOrders,
  listStockByArticle,
  restoreMallStockMovement,
  restoreManualStockEntry,
  restoreProductionOrder,
  updateMallStockMovement,
  updateManualStockEntry,
  updateProductionOrder,
  updateProductionOrderCompletion,
} from "../controllers/productionController.js";

const router = Router();

router.get("/orders", asyncHandler(listProductionOrders));
router.get("/orders/printable", asyncHandler(getPrintableProductionOrders));
router.get("/orders/printable/pressman/daily", asyncHandler(getPrintableDailyPressmanOrders));
router.post("/orders", asyncHandler(createProductionOrder));
router.post("/orders/bulk", asyncHandler(createBulkProductionOrders));
router.patch("/orders/:orderId", asyncHandler(updateProductionOrder));
router.delete("/orders/:orderId", asyncHandler(deleteProductionOrder));
router.post("/orders/:orderId/restore", asyncHandler(restoreProductionOrder));
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
router.get("/stock/mall-movements", asyncHandler(listMallStockMovements));
router.post("/stock/mall-movements", asyncHandler(createMallStockMovement));
router.patch(
  "/stock/mall-movements/:movementId",
  asyncHandler(updateMallStockMovement),
);
router.delete(
  "/stock/mall-movements/:movementId",
  asyncHandler(deleteMallStockMovement),
);
router.post(
  "/stock/mall-movements/:movementId/restore",
  asyncHandler(restoreMallStockMovement),
);
router.get("/stock/manual", asyncHandler(listManualStockEntries));
router.post("/stock/manual", asyncHandler(createManualStockEntry));
router.patch("/stock/manual/:entryId", asyncHandler(updateManualStockEntry));
router.delete("/stock/manual/:entryId", asyncHandler(deleteManualStockEntry));
router.post("/stock/manual/:entryId/restore", asyncHandler(restoreManualStockEntry));

export default router;
