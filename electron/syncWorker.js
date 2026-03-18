import prisma from "./server/prisma.js";
import { getCloudPrisma } from "./server/cloudPrisma.js";
import {
  getDeviceId,
  getLastSyncTimestamp,
  setLastSyncTimestamp,
} from "./server/sync/syncService.js";

const BASE_INTERVAL_MS = 30_000;
const MAX_BACKOFF_MS = 5 * 60_000;
const BATCH_SIZE = 200;
const MAX_PASSES = 5;
const MAX_RETRIES = 3;

const nowStamp = () => new Date().toISOString();
const log = (...args) => console.log("[sync]", nowStamp(), ...args);
const warn = (...args) => console.warn("[sync]", nowStamp(), ...args);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async (fn, label) => {
  let attempt = 0;
  let lastError;
  while (attempt < MAX_RETRIES) {
    attempt += 1;
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      warn(`${label}:retry`, { attempt, error: error?.message ?? error });
      await sleep(250 * attempt);
    }
  }
  throw lastError;
};

const snakeToCamel = (value) =>
  value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

const toComparableTimestamp = (record) => {
  if (!record) return null;
  const value = record.updatedAt ?? record.createdAt;
  if (!value) return null;
  const dateValue = value instanceof Date ? value : new Date(value);
  return Number.isNaN(dateValue.getTime()) ? null : dateValue;
};

const getChangeTimestamp = (change) => {
  const byData = toComparableTimestamp(change?.data);
  if (byData) return byData;
  if (change?.createdAt) {
    const dateValue =
      change.createdAt instanceof Date
        ? change.createdAt
        : new Date(change.createdAt);
    return Number.isNaN(dateValue.getTime()) ? null : dateValue;
  }
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
    .filter(
      (field) => field.kind === "object" && Array.isArray(field.relationFromFields)
    )
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

const applyChangeToRemote = async (cloud, change, deviceId) => {
  const delegate = resolveDelegate(cloud, String(change.entity ?? ""));
  if (!delegate) return { applied: false, deferred: false };

  const incoming = change.data;
  if (!incoming?.id) return { applied: false, deferred: false };

  const changeTimestamp = getChangeTimestamp(change);

  if (change.operation === "delete") {
    const existing = await delegate.findUnique({ where: { id: incoming.id } });
    if (existing) {
      const existingTimestamp = toComparableTimestamp(existing);
      if (
        existingTimestamp &&
        changeTimestamp &&
        existingTimestamp > changeTimestamp
      ) {
        return { applied: true, skipped: true };
      }
    }

    await cloud.$transaction([
      delegate.deleteMany({ where: { id: incoming.id } }),
      cloud.changeLog.upsert({
        where: { id: change.id },
        create: {
          id: change.id,
          entity: change.entity,
          entityId: String(incoming.id),
          operation: change.operation,
          data: incoming,
          synced: true,
          deviceId,
          createdAt: changeTimestamp ?? new Date(),
        },
        update: {
          entity: change.entity,
          entityId: String(incoming.id),
          operation: change.operation,
          data: incoming,
          synced: true,
          deviceId,
          createdAt: changeTimestamp ?? new Date(),
        },
      }),
    ]);
    return { applied: true, skipped: false };
  }

  const existing = await delegate.findUnique({ where: { id: incoming.id } });
  if (!shouldApplyIncomingUpdate(existing, incoming)) {
    return { applied: true, skipped: true };
  }

  const canApply = await areForeignKeysSatisfied(cloud, change.entity, incoming);
  if (!canApply) {
    return { applied: false, deferred: true };
  }

  const sanitizedIncoming = sanitizeIncoming(change.entity, incoming);

  await cloud.$transaction([
    delegate.upsert({
      where: { id: incoming.id },
      create: sanitizedIncoming,
      update: sanitizedIncoming,
    }),
    cloud.changeLog.upsert({
      where: { id: change.id },
      create: {
        id: change.id,
        entity: change.entity,
        entityId: String(incoming.id),
        operation: change.operation,
        data: incoming,
        synced: true,
        deviceId,
        createdAt: changeTimestamp ?? new Date(),
      },
      update: {
        entity: change.entity,
        entityId: String(incoming.id),
        operation: change.operation,
        data: incoming,
        synced: true,
        deviceId,
        createdAt: changeTimestamp ?? new Date(),
      },
    }),
  ]);

  return { applied: true, skipped: false };
};

const applyChangeToLocal = async (tx, change) => {
  const delegate = resolveDelegate(tx, String(change.entity ?? ""));
  if (!delegate) return { applied: false, deferred: false };

  const incoming = change.data;
  if (!incoming?.id) return { applied: false, deferred: false };

  const changeTimestamp = getChangeTimestamp(change);

  if (change.operation === "delete") {
    const existing = await delegate.findUnique({ where: { id: incoming.id } });
    if (existing) {
      const existingTimestamp = toComparableTimestamp(existing);
      if (
        existingTimestamp &&
        changeTimestamp &&
        existingTimestamp > changeTimestamp
      ) {
        return { applied: true, skipped: true };
      }
    }

    await delegate.deleteMany({ where: { id: incoming.id } });
    return { applied: true, deferred: false };
  }

  const existing = await delegate.findUnique({ where: { id: incoming.id } });
  if (!shouldApplyIncomingUpdate(existing, incoming)) {
    return { applied: true, deferred: false, skipped: true };
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

const pushPendingChanges = async () => {
  const deviceId = getDeviceId();
  const cloud = getCloudPrisma();

  const pendingChanges = await prisma.changeLog.findMany({
    where: { synced: false },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
  });

  if (!pendingChanges.length) {
    return { pushed: 0 };
  }

  log("push:start", { count: pendingChanges.length });

  let pending = pendingChanges.slice();
  let pass = 0;
  const appliedIds = new Set();

  while (pending.length && pass < MAX_PASSES) {
    pass += 1;
    const nextPending = [];
    let progress = false;

    for (const change of pending) {
      const result = await applyChangeToRemote(cloud, change, deviceId);
      if (result.applied) {
        appliedIds.add(change.id);
        progress = true;
        continue;
      }
      if (result.deferred) {
        nextPending.push(change);
      }
    }

    pending = nextPending;
    if (!progress) break;
  }

  if (appliedIds.size) {
    await prisma.changeLog.updateMany({
      where: { id: { in: Array.from(appliedIds) } },
      data: { synced: true },
    });
  }

  if (pending.length) {
    warn("push:deferred", { count: pending.length });
  }

  return { pushed: appliedIds.size, deferred: pending.length };
};

const pullRemoteChanges = async () => {
  const deviceId = getDeviceId();
  const cloud = getCloudPrisma();
  const lastSync = await getLastSyncTimestamp(prisma);
  const lastSyncDate = new Date(lastSync);

  const changes = await cloud.changeLog.findMany({
    where: {
      createdAt: { gt: lastSyncDate },
      deviceId: { not: deviceId },
    },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
  });

  if (!changes.length) {
    return { applied: 0, maxTimestamp: null };
  }

  log("pull:start", { count: changes.length });

  let appliedCount = 0;
  let deferredCount = 0;

  globalThis.__SYNC_APPLYING__ = true;
  try {
    await prisma.$transaction(async (tx) => {
      let pending = changes;
      let pass = 0;
      let progress = true;

      while (pending.length && progress && pass < MAX_PASSES) {
        pass += 1;
        progress = false;
        const nextPending = [];

        for (const change of pending) {
          const result = await applyChangeToLocal(tx, change);
          if (result.applied) {
            appliedCount += 1;
            progress = true;
            continue;
          }
          if (result.deferred) {
            nextPending.push(change);
          }
        }

        pending = nextPending;
      }

      deferredCount = pending.length;
    });
  } finally {
    globalThis.__SYNC_APPLYING__ = false;
  }

  if (deferredCount) {
    warn("pull:deferred", { count: deferredCount });
    return { applied: appliedCount, maxTimestamp: null, deferred: true };
  }

  let maxTimestamp = null;
  for (const change of changes) {
    const ts = getChangeTimestamp(change);
    if (!ts) continue;
    if (!maxTimestamp || ts > maxTimestamp) {
      maxTimestamp = ts;
    }
  }

  return { applied: appliedCount, maxTimestamp, deferred: false };
};

const runSyncCycle = async () => {
  await withRetry(pushPendingChanges, "push");
  const pullResult = await withRetry(pullRemoteChanges, "pull");

  if (pullResult.maxTimestamp) {
    await setLastSyncTimestamp(prisma, pullResult.maxTimestamp.toISOString());
  }
};

export const startSyncWorker = () => {
  let stopped = false;
  let backoffMs = 0;

  const scheduleNext = () => {
    if (stopped) return;
    const interval = Math.min(
      BASE_INTERVAL_MS + backoffMs,
      BASE_INTERVAL_MS + MAX_BACKOFF_MS
    );
    setTimeout(runLoop, interval);
  };

  const runLoop = async () => {
    if (stopped) return;
    try {
      await runSyncCycle();
      backoffMs = 0;
      log("cycle:ok");
    } catch (error) {
      warn("cycle:error", { error: error?.message ?? error });
      backoffMs = Math.min(
        backoffMs ? backoffMs * 2 : BASE_INTERVAL_MS,
        MAX_BACKOFF_MS
      );
    } finally {
      scheduleNext();
    }
  };

  runLoop();

  return {
    stop: () => {
      stopped = true;
    },
  };
};
