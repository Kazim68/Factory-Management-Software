import { Router } from "express";
import asyncHandler from "../middleware/asyncHandler.js";
import {
  confirmBill,
  createBill,
  deleteBill,
  listBills,
  updateBill,
} from "../controllers/billController.js";

const router = Router();

router.get("/", asyncHandler(listBills));
router.post("/", asyncHandler(createBill));
router.post("/:billId/confirm", asyncHandler(confirmBill));
router.patch("/:billId", asyncHandler(updateBill));
router.delete("/:billId", asyncHandler(deleteBill));

export default router;
