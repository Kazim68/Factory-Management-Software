import { Router } from "express";
import prisma from "../prisma.js";

const router = Router();

const snakeToCamel = (value) =>
  value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

const toComparableTimestamp = (record) => {
  if (!record) return null;
  if (record.updatedAt) return new Date(record.updatedAt);
  if (record.createdAt) return new Date(record.createdAt);
  return null;
};

const shouldApplyIncomingUpdate = (existing, incoming) => {
  if (!existing) return true;

  const incomingTimestamp = toComparableTimestamp(incoming);
  const existingTimestamp = toComparableTimestamp(existing);

  if (!incomingTimestamp || !existingTimestamp) return true;
  return incomingTimestamp > existingTimestamp;
};

const resolveDelegate = (tx, entity) => {
  const key = snakeToCamel(entity);
  return tx[key];
};

router.post("/push", async (req, res, next) => {
  try {
    const changes = Array.isArray(req.body?.changes) ? req.body.changes : [];
    const deviceId = String(req.body?.deviceId ?? "unknown-device");

    await prisma.$transaction(async (tx) => {
      for (const change of changes) {
        const delegate = resolveDelegate(tx, String(change.entity ?? ""));
        const incoming = change.data;

        if (!delegate || !incoming?.id) continue;

        if (change.operation === "delete") {
          await delegate.deleteMany({ where: { id: incoming.id } });
        } else {
          const existing = await delegate.findUnique({ where: { id: incoming.id } });
          if (!shouldApplyIncomingUpdate(existing, incoming)) continue;

          await delegate.upsert({
            where: { id: incoming.id },
            create: incoming,
            update: incoming,
          });
        }

        await tx.changeLog.upsert({
          where: { id: change.id },
          create: {
            id: change.id,
            entity: change.entity,
            entityId: String(incoming.id),
            operation: change.operation,
            data: incoming,
            synced: true,
            deviceId,
            createdAt: change.createdAt ? new Date(change.createdAt) : new Date(),
          },
          update: {
            entity: change.entity,
            entityId: String(incoming.id),
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
    const deviceId = req.query.deviceId ? String(req.query.deviceId) : undefined;

    const changes = await prisma.changeLog.findMany({
      where: {
        createdAt: { gt: lastSync },
        ...(deviceId ? { deviceId: { not: deviceId } } : {}),
      },
      orderBy: { createdAt: "asc" },
    });

    res.json({ changes });
  } catch (error) {
    next(error);
  }
});

export default router;
