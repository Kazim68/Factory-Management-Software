import os from "os";

const DEFAULT_SYNC_STATE_ID = "default";

export const getDeviceId = () => `${os.hostname()}-${os.userInfo().username}`;

export const ensureSyncTables = async (prisma) => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS change_log (
      id TEXT PRIMARY KEY,
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      data JSON NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      synced BOOLEAN NOT NULL DEFAULT 0,
      device_id TEXT NOT NULL
    )
  `);

  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS change_log_synced_created_at_idx ON change_log(synced, created_at)`
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS sync_state (
      id TEXT PRIMARY KEY,
      last_sync_timestamp DATETIME,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.syncState.upsert({
    where: { id: DEFAULT_SYNC_STATE_ID },
    update: {},
    create: { id: DEFAULT_SYNC_STATE_ID },
  });
};

export const getLastSyncTimestamp = async (prisma) => {
  const state = await prisma.syncState.findUnique({ where: { id: DEFAULT_SYNC_STATE_ID } });
  return state?.lastSyncTimestamp?.toISOString() ?? new Date(0).toISOString();
};

export const setLastSyncTimestamp = async (prisma, isoTimestamp) => {
  await prisma.syncState.upsert({
    where: { id: DEFAULT_SYNC_STATE_ID },
    update: { lastSyncTimestamp: new Date(isoTimestamp) },
    create: { id: DEFAULT_SYNC_STATE_ID, lastSyncTimestamp: new Date(isoTimestamp) },
  });
};
