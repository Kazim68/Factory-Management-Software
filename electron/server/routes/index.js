import { Router } from "express";
import billRoutes from "./billRoutes.js";
import configRoutes from "./configRoutes.js";
import expenseRoutes from "./expenseRoutes.js";
import laborRoutes from "./laborRoutes.js";
import partyRoutes from "./partyRoutes.js";
import purchaseRoutes from "./purchaseRoutes.js";
import productionRoutes from "./productionRoutes.js";

const router = Router();

router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

router.use("/config", configRoutes);
router.use("/parties", partyRoutes);
router.use("/expenses", expenseRoutes);
router.use("/labor", laborRoutes);
router.use("/bills", billRoutes);
router.use("/", purchaseRoutes);
router.use("/production", productionRoutes);

export default router;
