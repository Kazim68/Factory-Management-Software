import { Router } from "express";
import asyncHandler from "../middleware/asyncHandler.js";
import {
  createCombinedSupplierPurchase,
  createChemicalPurchase,
  createMaterialPurchase,
  createRexinePurchase,
  deleteChemicalPurchase,
  deleteMaterialPurchase,
  deleteRexinePurchase,
  listChemicalPurchases,
  listMaterialPurchases,
  listRexinePurchases,
  getPrintableSupplierPurchases,
  updateChemicalPurchase,
  updateMaterialPurchase,
  updateRexinePurchase,
} from "../controllers/purchaseController.js";

const router = Router();

router.post(
  "/purchases/combined",
  asyncHandler(createCombinedSupplierPurchase),
);
router.get("/purchases/printable", asyncHandler(getPrintableSupplierPurchases));
router.post("/chemicals", asyncHandler(createChemicalPurchase));
router.post("/rexine", asyncHandler(createRexinePurchase));
router.post("/materials", asyncHandler(createMaterialPurchase));
router.get("/chemicals", asyncHandler(listChemicalPurchases));
router.get("/rexine", asyncHandler(listRexinePurchases));
router.get("/materials", asyncHandler(listMaterialPurchases));
router.patch("/chemicals/:purchaseId", asyncHandler(updateChemicalPurchase));
router.delete("/chemicals/:purchaseId", asyncHandler(deleteChemicalPurchase));
router.patch("/rexine/:purchaseId", asyncHandler(updateRexinePurchase));
router.delete("/rexine/:purchaseId", asyncHandler(deleteRexinePurchase));
router.patch("/materials/:purchaseId", asyncHandler(updateMaterialPurchase));
router.delete("/materials/:purchaseId", asyncHandler(deleteMaterialPurchase));

export default router;
