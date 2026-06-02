import { Router } from "express";
import asyncHandler from "../middleware/asyncHandler.js";
import {
  activate,
  deactivate,
  getStatus,
  verifyNow,
} from "../controllers/licenseController.js";

const router = Router();

router.get("/status", asyncHandler(getStatus));
router.post("/activate", asyncHandler(activate));
router.post("/verify", asyncHandler(verifyNow));
router.post("/deactivate", asyncHandler(deactivate));

export default router;
