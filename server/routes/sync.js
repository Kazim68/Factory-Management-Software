import { Router } from "express";
import prisma from "../prisma.js";

const router = Router();

const ENTITY_MODEL_MAP = {
  expense_entry: "expenseEntry",
  labor_advance: "laborAdvance",
  chemical_purchase: "chemicalPurchase",
  rexine_purchase: "rexinePurchase",
  material_purchase: "materialPurchase",
};

const shouldApplyIncomingUpdate = (existing, incoming) => {
  if (!existing) return true;
  const incomingUpdatedAt = incoming?.updatedAt ? new Date(incoming.updatedAt) : null;
  const existingUpdatedAt = existing?.updatedAt ? new Date(existing.updatedAt) : null;
  if (!incomingUpdatedAt || !existingUpdatedAt) return true;
  return incomingUpdatedAt > existingUpdatedAt;
};

router.post("/push", async (req, res, next) => {
  try {
    const changes = Array.isArray(req.body?.changes) ? req.body.changes : [];
    const deviceId = String(req.body?.deviceId ?? "unknown-device");

    await prisma.$transaction(async (tx) => {
      for (const change of changes) {
        const modelName = ENTITY_MODEL_MAP[change.entity];
        if (!modelName) continue;

        const delegate = tx[modelName];
        const incoming = change.data;
        if (!incoming?.id) continue;

        if (change.operation === "delete") {
          await delegate.deleteMany({ where: { id: incoming.id } });
        } else {
          const existing = await delegate.findUnique({ where: { id: incoming.id } });
          if (!shouldApplyIncomingUpdate(existing, incoming)) {
            continue;
          }

          await delegate.upsert({
            where: { id: incoming.id },
            create: incoming,
            update: incoming,
          });
        }

        await tx.changeLog.create({
          data: {
            entity: change.entity,
            entityId: incoming.id,
            operation: change.operation,
            data: incoming,
            synced: true,
            deviceId,
            createdAt: change.createdAt ? new Date(change.createdAt) : new Date(),
          },
        });
      }
    });

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get("/pull", async (req, res, next) => {
  try {
    const lastSync = req.query.lastSync ? new Date(String(req.query.lastSync)) : new Date(0);

    const changes = await prisma.changeLog.findMany({
      where: {
        createdAt: { gt: lastSync },
      },
      orderBy: { createdAt: "asc" },
    });

    res.json({ changes });
  } catch (error) {
    next(error);
  }
});

export default router;
