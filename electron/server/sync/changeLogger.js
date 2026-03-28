import { randomUUID } from "crypto";

const TRACKED_OPERATIONS = new Set([
  "create",
  "createMany",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
]);
const EXCLUDED_MODELS = new Set(["ChangeLog", "SyncState"]);

const serializeRecord = (record) =>
  JSON.parse(
    JSON.stringify(record, (_, value) => {
      if (typeof value === "bigint") return value.toString();
      if (value instanceof Date) return value.toISOString();
      return value;
    })
  );

const toOperationType = (operation) => {
  if (operation === "create") return "insert";
  if (operation === "delete") return "delete";
  return "update";
};

const toEntityName = (model) =>
  model.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();

const enqueueChangeLogWrite = (basePrisma, payload) => {
  setTimeout(() => {
    basePrisma.changeLog
      .create({ data: payload })
      .catch((error) => console.error("Change-log write failed:", error));
  }, 0);
};

const modelKeyFromName = (model) => model[0].toLowerCase() + model.slice(1);

const normalizeCreateManyData = (data) => {
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
};

export const withChangeLogging = (basePrisma, getDeviceId) =>
  basePrisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (
            globalThis.__SYNC_APPLYING__ ||
            !model ||
            EXCLUDED_MODELS.has(model) ||
            !TRACKED_OPERATIONS.has(operation)
          ) {
            return query(args);
          }

          const delegate = basePrisma[modelKeyFromName(model)];

          if (operation === "createMany") {
            const dataItems = normalizeCreateManyData(args?.data).map((item) => ({
              ...item,
              id: item?.id ?? randomUUID(),
            }));

            const result = await query({ ...args, data: dataItems });
            for (const record of dataItems) {
              enqueueChangeLogWrite(basePrisma, {
                id: randomUUID(),
                entity: toEntityName(model),
                entityId: String(record.id),
                operation: "insert",
                data: serializeRecord(record),
                deviceId: getDeviceId(),
              });
            }
            return result;
          }

          if (operation === "updateMany") {
            const where = args?.where ?? {};
            const existing = await delegate.findMany({ where });
            const result = await query(args);
            if (existing.length) {
              const updated = await delegate.findMany({
                where: { id: { in: existing.map((row) => row.id) } },
              });
              for (const record of updated) {
                enqueueChangeLogWrite(basePrisma, {
                  id: randomUUID(),
                  entity: toEntityName(model),
                  entityId: String(record.id),
                  operation: "update",
                  data: serializeRecord(record),
                  deviceId: getDeviceId(),
                });
              }
            }
            return result;
          }

          if (operation === "deleteMany") {
            const where = args?.where ?? {};
            const existing = await delegate.findMany({ where });
            const result = await query(args);
            for (const record of existing) {
              if (!record?.id) continue;
              enqueueChangeLogWrite(basePrisma, {
                id: randomUUID(),
                entity: toEntityName(model),
                entityId: String(record.id),
                operation: "delete",
                data: serializeRecord(record),
                deviceId: getDeviceId(),
              });
            }
            return result;
          }

          let previous = null;
          if (operation === "delete") {
            previous = await delegate.findUnique({ where: args.where });
          }

          const result = await query(args);
          const record = operation === "delete" ? previous : result;

          if (!record?.id) return result;

          enqueueChangeLogWrite(basePrisma, {
            id: randomUUID(),
            entity: toEntityName(model),
            entityId: String(record.id),
            operation: toOperationType(operation),
            data: serializeRecord(record),
            deviceId: getDeviceId(),
          });

          return result;
        },
      },
    },
  });
