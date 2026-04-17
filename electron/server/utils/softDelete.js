const DELETED_SCOPE_VALUES = new Set(["ACTIVE", "ONLY", "INCLUDE"]);

export const getDeletedScope = (value) => {
  const normalized = String(value ?? "ACTIVE").trim().toUpperCase();
  return DELETED_SCOPE_VALUES.has(normalized) ? normalized : "ACTIVE";
};

export const applyDeletedScope = (where = {}, scope = "ACTIVE") => {
  if (where?.deletedAt !== undefined) return where;

  if (scope === "ONLY") {
    return { ...where, deletedAt: { not: null } };
  }

  if (scope === "INCLUDE") {
    return where;
  }

  return { ...where, deletedAt: null };
};

export const resolveDeletedWhere = (queryValue, where = {}) =>
  applyDeletedScope(where, getDeletedScope(queryValue));

export const softDeleteData = (deletedAt = new Date()) => ({
  deletedAt,
});

export const restoreData = () => ({
  deletedAt: null,
});

export const softDeleteById = (delegate, id, deletedAt = new Date()) =>
  delegate.update({
    where: { id },
    data: softDeleteData(deletedAt),
  });

export const restoreById = (delegate, id) =>
  delegate.update({
    where: { id },
    data: restoreData(),
  });

