import prisma from "./server/prisma.js";
import {
  getDeviceId,
  getLastSyncTimestamp,
  setLastSyncTimestamp,
} from "./server/sync/syncService.js";

const SYNC_INTERVAL_MS = 30_000;
const SYNC_BASE_URL = process.env.SYNC_SERVER_URL ?? "http://localhost:4001";

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
const modelRelationsCache = new Map();

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

const getModelRelations = (entity) => {
  const modelName = toModelName(entity);
  if (modelRelationsCache.has(modelName)) {
    return modelRelationsCache.get(modelName);
  }

  const model = runtimeModels[modelName];
  if (!model?.fields) {
    modelRelationsCache.set(modelName, []);
    return [];
  }

  const relations = model.fields
    .filter((field) => field.kind === "object" && Array.isArray(field.relationFromFields))
    .map((field) => ({
      targetModel: field.type,
      fromFields: field.relationFromFields,
    }));

  modelRelationsCache.set(modelName, relations);
  return relations;
};

const toDelegateKey = (modelName) => {
  if (!modelName) return "";
  return modelName[0].toLowerCase() + modelName.slice(1);
};

const areForeignKeysSatisfied = async (tx, entity, incoming) => {
  const relations = getModelRelations(entity);
  if (!relations.length) return true;

  for (const relation of relations) {
    const { targetModel, fromFields } = relation;
    if (!fromFields?.length) continue;

    for (const fieldName of fromFields) {
      const fkValue = incoming?.[fieldName];
      if (fkValue == null) continue;

      const delegateKey = toDelegateKey(targetModel);
      const delegate = tx[delegateKey];
      if (!delegate) continue;

      const existing = await delegate.findUnique({ where: { id: fkValue } });
      if (!existing) return false;
    }
  }

  return true;
};

const applyRemoteChange = async (tx, change) => {
  const delegate = resolveDelegate(tx, String(change.entity ?? ""));
  if (!delegate) return { applied: false, deferred: false };

  const incoming = change.data;
  if (!incoming?.id) return { applied: false, deferred: false };

  if (change.operation === "delete") {
    await delegate.deleteMany({ where: { id: incoming.id } });
    return { applied: true, deferred: false };
  }

  const existing = await delegate.findUnique({ where: { id: incoming.id } });
  if (!shouldApplyIncomingUpdate(existing, incoming)) {
    return { applied: false, deferred: false };
  }

  const canApply = await areForeignKeysSatisfied(tx, change.entity, incoming);
  if (!canApply) {
    return { applied: false, deferred: true };
  }

  const sanitizedIncoming = sanitizeIncoming(change.entity, incoming);

  await delegate.upsert({
    where: { id: incoming.id },
    create: sanitizedIncoming,
    update: sanitizedIncoming,
  });

  return { applied: true, deferred: false };
};

const syncOnce = async () => {
  const deviceId = getDeviceId();
  const pendingChanges = await prisma.changeLog.findMany({
    where: { synced: false },
    orderBy: { createdAt: "asc" },
  });

  if (pendingChanges.length) {
    const pushResponse = await fetch(`${SYNC_BASE_URL}/sync/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, changes: pendingChanges }),
    });

    if (pushResponse.ok) {
      await prisma.changeLog.updateMany({
        where: { id: { in: pendingChanges.map((change) => change.id) } },
        data: { synced: true },
      });
    }
  }

  const lastSync = await getLastSyncTimestamp(prisma);
  const pullResponse = await fetch(
    `${SYNC_BASE_URL}/sync/pull?lastSync=${encodeURIComponent(lastSync)}&deviceId=${encodeURIComponent(deviceId)}`
  );

  if (!pullResponse.ok) return;

  const payload = await pullResponse.json();
  const remoteChanges = Array.isArray(payload?.changes) ? payload.changes : [];
  const serverTime = payload?.serverTime ? new Date(payload.serverTime) : null;

  if (remoteChanges.length) {
    globalThis.__SYNC_APPLYING__ = true;
    try {
      await prisma.$transaction(async (tx) => {
        let pending = remoteChanges;
        let pass = 0;
        let progress = true;

        while (pending.length && progress && pass < 5) {
          pass += 1;
          progress = false;
          const nextPending = [];

          for (const change of pending) {
            const result = await applyRemoteChange(tx, change);
            if (result.applied) {
              progress = true;
              continue;
            }
            if (result.deferred) {
              nextPending.push(change);
            }
          }

          pending = nextPending;
        }

        if (pending.length) {
          throw new Error(
            `Sync deferred ${pending.length} change(s) due to missing dependencies.`
          );
        }
      });
    } finally {
      globalThis.__SYNC_APPLYING__ = false;
    }
  }

  let nextSync = serverTime && !Number.isNaN(serverTime.getTime()) ? serverTime : null;
  for (const change of remoteChanges) {
    const createdAt = change?.createdAt ? new Date(change.createdAt) : null;
    if (!createdAt || Number.isNaN(createdAt.getTime())) continue;
    if (!nextSync || createdAt > nextSync) nextSync = createdAt;
  }

  await setLastSyncTimestamp(
    prisma,
    (nextSync ?? new Date()).toISOString()
  );
};

export const startSyncWorker = () => {
  const run = async () => {
    try {
      await syncOnce();
    } catch (error) {
      console.error("Sync worker error:", error);
    }
  };

  run();
  return setInterval(run, SYNC_INTERVAL_MS);
};
