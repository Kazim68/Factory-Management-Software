import prisma from "./server/prisma.js";
import {
  getDeviceId,
  getLastSyncTimestamp,
  setLastSyncTimestamp,
} from "./server/sync/syncService.js";

const SYNC_INTERVAL_MS = 30_000;
const SYNC_BASE_URL = process.env.SYNC_SERVER_URL ?? "http://localhost:3001";

const ENTITY_MODEL_MAP = {
  expense_entry: "expenseEntry",
  labor_advance: "laborAdvance",
  chemical_purchase: "chemicalPurchase",
  rexine_purchase: "rexinePurchase",
  material_purchase: "materialPurchase",
};

const applyRemoteChange = async (tx, change) => {
  const modelName = ENTITY_MODEL_MAP[change.entity];
  if (!modelName) return;

  const delegate = tx[modelName];
  const incoming = change.data;
  if (!incoming?.id) return;

  if (change.operation === "delete") {
    await delegate.deleteMany({ where: { id: incoming.id } });
    return;
  }

  const existing = await delegate.findUnique({ where: { id: incoming.id } });
  const incomingUpdatedAt = incoming.updatedAt ? new Date(incoming.updatedAt) : null;
  const existingUpdatedAt = existing?.updatedAt ?? null;

  if (existing && incomingUpdatedAt && existingUpdatedAt && incomingUpdatedAt <= existingUpdatedAt) {
    return;
  }

  await delegate.upsert({
    where: { id: incoming.id },
    create: incoming,
    update: incoming,
  });
};

const syncOnce = async () => {
  const pendingChanges = await prisma.changeLog.findMany({
    where: { synced: false },
    orderBy: { createdAt: "asc" },
  });

  if (pendingChanges.length) {
    const pushResponse = await fetch(`${SYNC_BASE_URL}/sync/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: getDeviceId(), changes: pendingChanges }),
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
    `${SYNC_BASE_URL}/sync/pull?lastSync=${encodeURIComponent(lastSync)}`
  );

  if (!pullResponse.ok) return;

  const payload = await pullResponse.json();
  const remoteChanges = Array.isArray(payload?.changes) ? payload.changes : [];

  if (remoteChanges.length) {
    globalThis.__SYNC_APPLYING__ = true;
    try {
      await prisma.$transaction(async (tx) => {
        for (const change of remoteChanges) {
          await applyRemoteChange(tx, change);
        }
      });
    } finally {
      globalThis.__SYNC_APPLYING__ = false;
    }
  }

  await setLastSyncTimestamp(prisma, new Date().toISOString());
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
