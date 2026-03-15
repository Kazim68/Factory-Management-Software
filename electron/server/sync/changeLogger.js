import { randomUUID } from "crypto";

const TRACKED_OPERATIONS = new Set(["create", "update", "upsert", "delete"]);
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

          let previous = null;
          if (operation === "delete") {
            previous = await basePrisma[
              model[0].toLowerCase() + model.slice(1)
            ].findUnique({ where: args.where });
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
