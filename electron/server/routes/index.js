import { Router } from "express";
import billRoutes from "./billRoutes.js";
import chequeRoutes from "./chequeRoutes.js";
import configRoutes from "./configRoutes.js";
import expenseRoutes from "./expenseRoutes.js";
import laborRoutes from "./laborRoutes.js";
import partyRoutes from "./partyRoutes.js";
import purchaseRoutes from "./purchaseRoutes.js";
import productionRoutes from "./productionRoutes.js";
import reportRoutes from "./reportRoutes.js";
import licenseRoutes from "./licenseRoutes.js";

const router = Router();

router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

router.use("/config", configRoutes);
router.use("/parties", partyRoutes);
router.use("/expenses", expenseRoutes);
router.use("/labor", laborRoutes);
router.use("/bills", billRoutes);
router.use("/cheques", chequeRoutes);
router.use("/", purchaseRoutes);
router.use("/production", productionRoutes);
router.use("/reports", reportRoutes);
router.use("/license", licenseRoutes);

export default router;
