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

const runtimeModels = prisma._runtimeDataModel?.models ?? {};
const modelScalarFieldsCache = new Map();

const toModelName = (entity) => {
  const camel = snakeToCamel(String(entity ?? ""));
  if (!camel) return "";
  return camel[0].toUpperCase() + camel.slice(1);
};

const getModelScalarFields = (entity) => {
  const modelName = toModelName(entity);
  if (modelScalarFieldsCache.has(modelName)) {
    return modelScalarFieldsCache.get(modelName);
  }

  const model = runtimeModels[modelName];
  if (!model?.fields) {
    modelScalarFieldsCache.set(modelName, null);
    return null;
  }

  const scalarFields = new Set(
    model.fields
      .filter((field) => field.kind !== "object")
      .map((field) => field.name)
  );

  modelScalarFieldsCache.set(modelName, scalarFields);
  return scalarFields;
};

const sanitizeIncoming = (entity, incoming) => {
  if (!incoming || typeof incoming !== "object") return incoming;

  const scalarFields = getModelScalarFields(entity);
  if (!scalarFields) return incoming;

  const sanitized = {};
  for (const fieldName of scalarFields) {
    if (Object.prototype.hasOwnProperty.call(incoming, fieldName)) {
      sanitized[fieldName] = incoming[fieldName];
    }
  }

  return sanitized;
};

router.post("/push", async (req, res, next) => {
  try {
    const changes = Array.isArray(req.body?.changes) ? req.body.changes : [];
    const deviceId = String(req.body?.deviceId ?? "unknown-device");

    for (const change of changes) {
      const delegate = resolveDelegate(prisma, String(change.entity ?? ""));
      const incoming = change.data;

      if (!delegate || !incoming?.id) continue;

      if (change.operation === "delete") {
        await prisma.$transaction([
          delegate.deleteMany({ where: { id: incoming.id } }),
          prisma.changeLog.upsert({
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
          }),
        ]);
        continue;
      }

      const existing = await delegate.findUnique({ where: { id: incoming.id } });
      if (!shouldApplyIncomingUpdate(existing, incoming)) continue;

      const sanitizedIncoming = sanitizeIncoming(change.entity, incoming);

      await prisma.$transaction([
        delegate.upsert({
          where: { id: incoming.id },
          create: sanitizedIncoming,
          update: sanitizedIncoming,
        }),
        prisma.changeLog.upsert({
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
        }),
      ]);
    }

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
