import { Router } from "express";
import asyncHandler from "../middleware/asyncHandler.js";
import {
  createParty,
  createPartyPayment,
  getPartyLedger,
  listParties,
} from "../controllers/partyController.js";

const router = Router();

router.get("/", asyncHandler(listParties));
router.post("/", asyncHandler(createParty));
router.get("/:partyId/ledger", asyncHandler(getPartyLedger));
router.post("/:partyId/payments", asyncHandler(createPartyPayment));

export default router;
