import { Router } from "express";
import asyncHandler from "../middleware/asyncHandler.js";
import {
  createParty,
  createPartyPayment,
  deleteParty,
  getPartyLedger,
  listParties,
  updateParty,
} from "../controllers/partyController.js";

const router = Router();

router.get("/", asyncHandler(listParties));
router.post("/", asyncHandler(createParty));
router.patch("/:partyId", asyncHandler(updateParty));
router.delete("/:partyId", asyncHandler(deleteParty));
router.get("/:partyId/ledger", asyncHandler(getPartyLedger));
router.post("/:partyId/payments", asyncHandler(createPartyPayment));

export default router;
