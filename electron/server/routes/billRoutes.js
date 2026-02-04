import { Router } from "express";
import asyncHandler from "../middleware/asyncHandler.js";
import {
  confirmBill,
  createBill,
  listBills,
} from "../controllers/billController.js";

const router = Router();

router.get("/", asyncHandler(listBills));
router.post("/", asyncHandler(createBill));
router.post("/:billId/confirm", asyncHandler(confirmBill));

export default router;
