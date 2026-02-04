import { Router } from "express";
import asyncHandler from "../middleware/asyncHandler.js";
import {
  createChemicalPurchase,
  createMaterialPurchase,
  createRexinePurchase,
} from "../controllers/purchaseController.js";

const router = Router();

router.post("/chemicals", asyncHandler(createChemicalPurchase));
router.post("/rexine", asyncHandler(createRexinePurchase));
router.post("/materials", asyncHandler(createMaterialPurchase));

export default router;
