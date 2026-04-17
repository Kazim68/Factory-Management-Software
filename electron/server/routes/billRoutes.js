import { Router } from "express";
import asyncHandler from "../middleware/asyncHandler.js";
import {
  confirmBill,
  createBill,
  deleteBill,
  getBillLedger,
  listBills,
  receiveBillPayment,
  restoreBill,
  updateBill,
  verifyBill,
} from "../controllers/billController.js";

const router = Router();

router.get("/", asyncHandler(listBills));
router.post("/", asyncHandler(createBill));
router.post("/:billId/confirm", asyncHandler(confirmBill));
router.get("/:billId/ledger", asyncHandler(getBillLedger));
router.post("/:billId/payments", asyncHandler(receiveBillPayment));
router.post("/:billId/verify", asyncHandler(verifyBill));
router.patch("/:billId", asyncHandler(updateBill));
router.delete("/:billId", asyncHandler(deleteBill));
router.post("/:billId/restore", asyncHandler(restoreBill));

export default router;
