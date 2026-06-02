import prisma from "./server/prisma.js";
import { getCloudPrisma } from "./server/cloudPrisma.js";
import {
  getDeviceId,
  getLastSyncTimestamp,
  setLastSyncTimestamp,
} from "./server/sync/syncService.js";
import { licenseService } from "./license/index.js";

const BASE_INTERVAL_MS = 30_000;
const MAX_BACKOFF_MS = 5 * 60_000;
const BATCH_SIZE = 200;
const MAX_PASSES = 5;
const MAX_RETRIES = 3;

const nowStamp = () => new Date().toISOString();
const log = (...args) => console.log("[sync]", nowStamp(), ...args);
const warn = (...args) => console.warn("[sync]", nowStamp(), ...args);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isSchemaMismatchError = (error) => {
  const message = String(error?.message ?? error ?? "");
  return (
    message.includes("does not exist in the current database") ||
    message.includes("no such table:") ||
    (message.includes("column") && message.includes("does not exist")) ||
    message.includes("Unknown argument")
  );
};

const withRetry = async (fn, label) => {
  let attempt = 0;
  let lastError;
  while (attempt < MAX_RETRIES) {
    attempt += 1;
    try {
      return await fn();
    } catch (error) {
      if (isSchemaMismatchError(error)) {
        throw error;
      }
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

const getRuntimeModels = (client) => client?._runtimeDataModel?.models ?? {};
const localRuntimeModels = getRuntimeModels(prisma);
const modelScalarFieldsCache = new WeakMap();
const modelRelationsCache = new WeakMap();

const toModelName = (entity) => {
  const camel = snakeToCamel(String(entity ?? ""));
  if (!camel) return "";
  return camel[0].toUpperCase() + camel.slice(1);
};

const getRuntimeModelCache = (weakMap, runtimeModels) => {
  let cache = weakMap.get(runtimeModels);
  if (!cache) {
    cache = new Map();
    weakMap.set(runtimeModels, cache);
  }
  return cache;
};

const getModelScalarFields = (runtimeModels, entity) => {
  const modelName = toModelName(entity);
  const cache = getRuntimeModelCache(modelScalarFieldsCache, runtimeModels);
  if (cache.has(modelName)) {
    return cache.get(modelName);
  }

  const model = runtimeModels[modelName];
  if (!model?.fields) {
    cache.set(modelName, null);
    return null;
  }

  const scalarFields = new Set(
    model.fields
      .filter((field) => field.kind !== "object")
      .map((field) => field.name),
  );

  cache.set(modelName, scalarFields);
  return scalarFields;
};

const sanitizeIncoming = (runtimeModels, entity, incoming) => {
  if (!incoming || typeof incoming !== "object") return incoming;

  const scalarFields = getModelScalarFields(runtimeModels, entity);
  if (!scalarFields) return incoming;

  const sanitized = {};
  for (const fieldName of scalarFields) {
    if (Object.prototype.hasOwnProperty.call(incoming, fieldName)) {
      sanitized[fieldName] = incoming[fieldName];
    }
  }

  return sanitized;
};

const getUniqueScalarFields = (runtimeModels, entity) => {
  const modelName = toModelName(entity);
  const model = runtimeModels[modelName];
  if (!model?.fields) return [];

  return model.fields
    .filter(
      (field) => field.kind !== "object" && (field.isId || field.isUnique),
    )
    .map((field) => field.name);
};

const isUniqueConstraintError = (error) =>
  error?.code === "P2002" ||
  String(error?.message ?? "").includes("Unique constraint failed");

const parseUniqueTargetsFromMessage = (error) => {
  const message = String(error?.message ?? "");
  const match = message.match(/fields?:\s*\(([^)]+)\)/i);
  if (!match?.[1]) return [];

  return match[1]
    .split(",")
    .map((part) => part.replace(/[`'"\s]/g, ""))
    .filter(Boolean);
};

const getConflictTargets = (runtimeModels, entity, incoming, error) => {
  const rawTargets = Array.isArray(error?.meta?.target)
    ? error.meta.target
    : parseUniqueTargetsFromMessage(error);

  const uniqueScalarFields = getUniqueScalarFields(runtimeModels, entity);

  const candidates = (rawTargets.length ? rawTargets : uniqueScalarFields)
    .filter((field) => field !== "id")
    .filter((field) => incoming?.[field] != null);

  return [...new Set(candidates)];
};

const updateExistingOnConflict = async (
  delegate,
  existingRecord,
  sanitizedIncoming,
) => {
  const updateData = { ...sanitizedIncoming };

  if (existingRecord.id !== sanitizedIncoming.id) {
    try {
      await delegate.update({
        where: { id: existingRecord.id },
        data: updateData,
      });
      return { resolved: true, rekeyed: true };
    } catch (error) {
      // If PK rekey is blocked by related rows, keep existing id and update content.
      const fallbackData = { ...updateData };
      delete fallbackData.id;
      await delegate.update({
        where: { id: existingRecord.id },
        data: fallbackData,
      });
      return { resolved: true, rekeyed: false };
    }
  }

  await delegate.update({
    where: { id: existingRecord.id },
    data: updateData,
  });
  return { resolved: true, rekeyed: false };
};

const upsertWithConflictRecovery = async ({
  delegate,
  runtimeModels,
  entity,
  incoming,
  sanitizedIncoming,
}) => {
  try {
    await delegate.upsert({
      where: { id: incoming.id },
      create: sanitizedIncoming,
      update: sanitizedIncoming,
    });
    return { applied: true, skipped: false, conflictResolved: false };
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const conflictTargets = getConflictTargets(
      runtimeModels,
      entity,
      incoming,
      error,
    );
    for (const field of conflictTargets) {
      const conflicting = await delegate.findFirst({
        where: { [field]: incoming[field] },
      });

      if (!conflicting) continue;

      if (!shouldApplyIncomingUpdate(conflicting, incoming)) {
        return { applied: true, skipped: true, conflictResolved: true };
      }

      const result = await updateExistingOnConflict(
        delegate,
        conflicting,
        sanitizedIncoming,
      );

      if (!result.rekeyed) {
        warn("sync:unique-conflict-id-mismatch", {
          entity,
          field,
          localId: incoming.id,
          remoteId: conflicting.id,
        });
      }

      return { applied: true, skipped: false, conflictResolved: true };
    }

    throw error;
  }
};

const getModelRelations = (runtimeModels, entity) => {
  const modelName = toModelName(entity);
  const cache = getRuntimeModelCache(modelRelationsCache, runtimeModels);
  if (cache.has(modelName)) {
    return cache.get(modelName);
  }

  const model = runtimeModels[modelName];
  if (!model?.fields) {
    cache.set(modelName, []);
    return [];
  }

  const relations = model.fields
    .filter(
      (field) =>
        field.kind === "object" && Array.isArray(field.relationFromFields),
    )
    .map((field) => ({
      targetModel: field.type,
      fromFields: field.relationFromFields,
    }));

  cache.set(modelName, relations);
  return relations;
};

const toDelegateKey = (modelName) => {
  if (!modelName) return "";
  return modelName[0].toLowerCase() + modelName.slice(1);
};

const areForeignKeysSatisfied = async (tx, runtimeModels, entity, incoming) => {
  const relations = getModelRelations(runtimeModels, entity);
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
  const cloudRuntimeModels = getRuntimeModels(cloud);

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

  const canApply = await areForeignKeysSatisfied(
    cloud,
    cloudRuntimeModels,
    change.entity,
    incoming,
  );
  if (!canApply) {
    return { applied: false, deferred: true };
  }

  const sanitizedIncoming = sanitizeIncoming(
    cloudRuntimeModels,
    change.entity,
    incoming,
  );

  const upsertResult = await upsertWithConflictRecovery({
    delegate,
    runtimeModels: cloudRuntimeModels,
    entity: change.entity,
    incoming,
    sanitizedIncoming,
  });

  await cloud.$transaction([
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

  return { applied: true, skipped: upsertResult.skipped };
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

  const canApply = await areForeignKeysSatisfied(
    tx,
    localRuntimeModels,
    change.entity,
    incoming,
  );
  if (!canApply) {
    return { applied: false, deferred: true };
  }

  const sanitizedIncoming = sanitizeIncoming(
    localRuntimeModels,
    change.entity,
    incoming,
  );
  await upsertWithConflictRecovery({
    delegate,
    runtimeModels: localRuntimeModels,
    entity: change.entity,
    incoming,
    sanitizedIncoming,
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
  const cloud = getCloudPrisma();
  const lastSync = await getLastSyncTimestamp(prisma);
  const lastSyncDate = new Date(lastSync);

  const changes = await cloud.changeLog.findMany({
    where: {
      createdAt: { gt: lastSyncDate },
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

const runSyncCycle = async ({ pullFirst = false } = {}) => {
  // Pause sync entirely when the license is missing/blocked/expired (Approch.docx
  // P241–P242). The license service refreshes this status every 15 minutes.
  const licenseStatus = licenseService.getCachedStatus();
  if (!licenseStatus?.valid) {
    log("cycle:paused", {
      reason: licenseStatus?.reason ?? "License inactive",
    });
    return;
  }

  let pullResult;

  if (pullFirst) {
    pullResult = await withRetry(pullRemoteChanges, "pull");
    await withRetry(pushPendingChanges, "push");
  } else {
    await withRetry(pushPendingChanges, "push");
    pullResult = await withRetry(pullRemoteChanges, "pull");
  }

  if (pullResult.maxTimestamp) {
    await setLastSyncTimestamp(prisma, pullResult.maxTimestamp.toISOString());
  }
};

export const startSyncWorker = () => {
  let stopped = false;
  let backoffMs = 0;
  let schemaMismatchLogged = false;
  let isInitialCycle = true;

  const scheduleNext = () => {
    if (stopped) return;
    const interval = Math.min(
      BASE_INTERVAL_MS + backoffMs,
      BASE_INTERVAL_MS + MAX_BACKOFF_MS,
    );
    setTimeout(runLoop, interval);
  };

  const runLoop = async () => {
    if (stopped) return;
    try {
      await runSyncCycle({ pullFirst: isInitialCycle });
      isInitialCycle = false;
      backoffMs = 0;
      log("cycle:ok");
    } catch (error) {
      if (isSchemaMismatchError(error)) {
        if (!schemaMismatchLogged) {
          warn("cycle:paused", {
            reason:
              "Remote sync schema is behind the local schema. Apply the latest database schema remotely, then restart the app to re-enable sync.",
            error: error?.message ?? error,
          });
          schemaMismatchLogged = true;
        }
        stopped = true;
        return;
      }
      warn("cycle:error", { error: error?.message ?? error });
      backoffMs = Math.min(
        backoffMs ? backoffMs * 2 : BASE_INTERVAL_MS,
        MAX_BACKOFF_MS,
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
