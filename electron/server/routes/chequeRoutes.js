import { Router } from "express";
import asyncHandler from "../middleware/asyncHandler.js";
import {
  cashCheque,
  listAvailableCheques,
  listCheques,
  updateCheque,
} from "../controllers/chequeController.js";

const router = Router();

router.get("/", asyncHandler(listCheques));
router.get("/available", asyncHandler(listAvailableCheques));
router.patch("/:chequeId", asyncHandler(updateCheque));
router.post("/:chequeId/cash", asyncHandler(cashCheque));

export default router;
