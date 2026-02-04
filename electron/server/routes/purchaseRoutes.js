import { Router } from "express";
import asyncHandler from "../middleware/asyncHandler.js";
import {
  createChemicalPurchase,
  createMaterialPurchase,
  createRexinePurchase,
  listChemicalPurchases,
  listMaterialPurchases,
  listRexinePurchases,
} from "../controllers/purchaseController.js";

const router = Router();

router.post("/chemicals", asyncHandler(createChemicalPurchase));
router.post("/rexine", asyncHandler(createRexinePurchase));
router.post("/materials", asyncHandler(createMaterialPurchase));
router.get("/chemicals", asyncHandler(listChemicalPurchases));
router.get("/rexine", asyncHandler(listRexinePurchases));
router.get("/materials", asyncHandler(listMaterialPurchases));

export default router;
