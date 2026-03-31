import type {
  ApiArticle,
  ApiExpenseEntry,
  ApiExpenseCategory,
  ApiExpenseModule,
  ApiLaborCategory,
  ApiLaborLedger,
  ApiLaborProfile,
  ApiLaborWorkEntry,
  ApiLaborAdvance,
  ApiPaymentType,
  ApiParty,
  ApiPartyLedgerEntry,
  ApiSupplierPendingDuesResponse,
  ApiPartyPayment,
  ApiBill,
  ApiBillLedgerEntry,
  ApiBillLine,
  ApiBillStatus,
  ApiBillType,
  ApiCheque,
  ApiChemicalPurchase,
  ApiMaterialPurchase,
  ApiPaymentMethod,
  ApiRexinePurchase,
  ApiProductionOrder,
  ApiLaborDepartment,
  ApiStockSummary,
  ApiStockArticleRow,
  ApiStockEntry,
  ApiStockMode,
  ApiUnit,
  ApiLaborSummaryReport,
  ApiPartyMonthlyOutstandingReport,
  ApiRoznamchaSummaryReport,
} from "../types/api";
import { auth } from "./auth";

type ApiAuditMeta = {
  itemLabel?: string;
  previousValues?: Record<string, unknown>;
  fieldLabels?: Record<string, string>;
  previousFieldLabels?: Record<string, string>;
};

type ApiRequest = {
  path: string;
  method?: string;
  body?: unknown;
  auditMeta?: ApiAuditMeta;
};

const request = async <T>(payload: ApiRequest): Promise<T> => {
  if (typeof window === "undefined" || !window.api?.request) {
    throw new Error("API bridge is unavailable.");
  }

  const { auditMeta, ...apiPayload } = payload;
  const response = (await window.api.request(apiPayload)) as T;
  writeAuditLog(apiPayload, auditMeta);
  return response;
};

const get = <T>(path: string) => request<T>({ path });

const withQuery = (
  path: string,
  params?: Record<string, string | undefined>,
) => {
  const query = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) query.set(key, value);
    }
  }
  const suffix = query.toString();
  return `${path}${suffix ? `?${suffix}` : ""}`;
};

const AUDITABLE_METHODS = new Set(["POST", "PATCH", "DELETE"]);

const ENTITY_LABELS: Record<string, string> = {
  "config/units": "unit",
  "config/articles": "article",
  "config/labor-categories": "labor category",
  "config/payment-types": "payment type",
  "config/expense-categories": "expense category",
  parties: "party",
  expenses: "expense",
  bills: "bill",
  "labor/work": "labor work entry",
  "labor/advances": "labor advance",
  "labor/profiles": "labor profile",
  "purchases/chemical": "chemical purchase",
  "purchases/rexine": "rexine purchase",
  "purchases/material": "material purchase",
  "production/orders": "production order",
  "production/stock/manual": "manual stock entry",
};

const toTitleCase = (value: string): string =>
  value.replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

const singularize = (value: string): string =>
  value.endsWith("s") ? value.slice(0, -1) : value;

const isIdSegment = (segment: string): boolean =>
  /^(\d+|[0-9a-fA-F-]{8,})$/.test(segment);

const getAuditContext = (path: string, method: string) => {
  const cleanPath = path.split("?")[0];
  const segments = cleanPath.split("/").filter(Boolean);
  const shouldTreatLastSegmentAsId = method === "PATCH" || method === "DELETE";

  const resourceId =
    segments.length > 0 &&
    (shouldTreatLastSegmentAsId || isIdSegment(segments[segments.length - 1]))
      ? segments[segments.length - 1]
      : undefined;

  const entitySegments = resourceId ? segments.slice(0, -1) : segments;
  const entity = entitySegments.length
    ? entitySegments
        .map((segment) => toTitleCase(singularize(segment)))
        .join(" / ")
    : "Record";

  return { cleanPath, entity, resourceId };
};

const stringifyDetail = (value: unknown): string | undefined => {
  if (value == null) return undefined;
  try {
    const text = JSON.stringify(value);
    return text.length > 220 ? `${text.slice(0, 220)}…` : text;
  } catch {
    return String(value);
  }
};

const formatValue = (value: unknown): string => {
  if (value == null) return "-";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value))
    return value.map((item) => formatValue(item)).join(", ");

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const formatFieldName = (field: string): string =>
  toTitleCase(
    field.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/\bId\b/g, ""),
  );

const pickComparableValue = (
  source: Record<string, unknown> | undefined,
  key: string,
): unknown => {
  if (!source) return undefined;
  if (key in source) return source[key];

  if (key.endsWith("Id")) {
    const shortKey = key.slice(0, -2);
    if (shortKey in source) return source[shortKey];
  }

  return undefined;
};

const isNumericLike = (value: unknown): boolean => {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  const numberValue = Number(trimmed);
  return Number.isFinite(numberValue);
};

const valuesEqual = (left: unknown, right: unknown): boolean => {
  if (left === right) return true;
  if (left == null && right == null) return true;

  if (isNumericLike(left) && isNumericLike(right)) {
    return Number(left) === Number(right);
  }

  if (typeof left === "boolean" || typeof right === "boolean") {
    return String(left) === String(right);
  }

  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return String(left) === String(right);
  }
};

const buildFieldChanges = (
  payloadBody: unknown,
  previousValues?: Record<string, unknown>,
): string[] => {
  if (!payloadBody || typeof payloadBody !== "object") return [];

  const source = payloadBody as Record<string, unknown>;
  return Object.entries(source)
    .filter(([key, value]) => value !== undefined && key !== "moduleData")
    .flatMap(([key, value]) => {
      const previousValue = pickComparableValue(previousValues, key);
      const field = formatFieldName(key);

      if (previousValue !== undefined && valuesEqual(previousValue, value)) {
        return [];
      }

      if (previousValue === undefined) {
        return `${field} set to ${formatValue(value)}`;
      }

      return `${field} changed from ${formatValue(previousValue)} to ${formatValue(value)}`;
    });
};

const getFieldDisplayValue = (
  key: string,
  value: unknown,
  auditMeta?: ApiAuditMeta,
): string => {
  if (auditMeta?.fieldLabels?.[key]) {
    return auditMeta.fieldLabels[key];
  }

  return formatValue(value);
};

const getPreviousFieldDisplayValue = (
  key: string,
  value: unknown,
  auditMeta?: ApiAuditMeta,
): string => {
  if (auditMeta?.previousFieldLabels?.[key]) {
    return auditMeta.previousFieldLabels[key];
  }

  return formatValue(value);
};

const buildAuditChanges = (
  payloadBody: unknown,
  auditMeta?: ApiAuditMeta,
): string[] => {
  if (!payloadBody || typeof payloadBody !== "object") return [];

  const source = payloadBody as Record<string, unknown>;
  return Object.entries(source)
    .filter(([key, value]) => value !== undefined && key !== "moduleData")
    .flatMap(([key, value]) => {
      const previousValue = pickComparableValue(auditMeta?.previousValues, key);
      const field = formatFieldName(key);

      if (previousValue !== undefined && valuesEqual(previousValue, value)) {
        return [];
      }

      if (previousValue === undefined) {
        return `${field} set to ${getFieldDisplayValue(key, value, auditMeta)}`;
      }

      return `${field} changed from ${getPreviousFieldDisplayValue(key, previousValue, auditMeta)} to ${getFieldDisplayValue(key, value, auditMeta)}`;
    });
};

const pickValue = (payload: unknown, keys: string[]): string | undefined => {
  if (!payload || typeof payload !== "object") return undefined;
  const source = payload as Record<string, unknown>;
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") {
      return formatValue(value);
    }
  }
  return undefined;
};

const getEntityLabel = (cleanPath: string, fallbackEntity: string): string => {
  const segments = cleanPath.split("/").filter(Boolean);
  const baseSegments = segments.filter(
    (segment) => !/^(\d+|[0-9a-fA-F-]{8,})$/.test(segment),
  );
  const key = baseSegments.join("/");
  return ENTITY_LABELS[key] ?? fallbackEntity.toLowerCase();
};

const buildFriendlyDetail = (
  method: "POST" | "PATCH" | "DELETE",
  cleanPath: string,
  entity: string,
  payloadBody: unknown,
  auditMeta?: ApiAuditMeta,
): string => {
  const label = getEntityLabel(cleanPath, entity);
  const what =
    auditMeta?.itemLabel ??
    pickValue(payloadBody, [
      "name",
      "description",
      "detail",
      "reference",
      "billNumber",
    ]) ??
    pickValue(payloadBody, ["amount", "quantity", "total"])?.concat(
      " amount",
    ) ??
    "record";

  const titledLabel = `${label[0].toUpperCase()}${label.slice(1)}`;
  const entityName = auditMeta?.itemLabel ? `[${auditMeta.itemLabel}]` : "";
  const fieldChanges = buildAuditChanges(payloadBody, auditMeta);
  const changeSummary =
    fieldChanges.length > 0 ? fieldChanges.join("; ") : what;

  if (method === "POST") {
    return `${titledLabel} created: ${entityName || what}.`
      .replace(/\s+/g, " ")
      .trim();
  }

  if (method === "PATCH") {
    return `${titledLabel} updated: ${entityName || what}${fieldChanges.length ? `; ${changeSummary}` : ""}.`
      .replace(/\s+/g, " ")
      .trim();
  }

  const isExpense = label === "expense";
  const deletedSummary = auditMeta?.previousValues
    ? Object.entries(auditMeta.previousValues)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => `${formatFieldName(key)}: ${formatValue(value)}`)
        .join(", ")
    : undefined;

  if (isExpense && deletedSummary) {
    return `${titledLabel} deleted: ${entityName || what} (${deletedSummary}).`
      .replace(/\s+/g, " ")
      .trim();
  }

  return `${titledLabel} deleted: ${entityName || what}.`
    .replace(/\s+/g, " ")
    .trim();
};

const writeAuditLog = (payload: ApiRequest, auditMeta?: ApiAuditMeta): void => {
  const method = (payload.method ?? "GET").toUpperCase();
  if (!AUDITABLE_METHODS.has(method)) return;

  const { cleanPath, entity, resourceId } = getAuditContext(
    payload.path,
    method,
  );
  const actor = auth.getSessionUser();
  const verb =
    method === "POST" ? "Created" : method === "PATCH" ? "Updated" : "Deleted";

  auth.logAction({
    actorId: actor?.id,
    actorName: actor?.name ?? "System",
    action: `${entity} ${verb}`,
    entity,
    resourceId,
    method: method as "POST" | "PATCH" | "DELETE",
    detail:
      buildFriendlyDetail(
        method as "POST" | "PATCH" | "DELETE",
        cleanPath,
        entity,
        payload.body,
        auditMeta,
      ) ?? stringifyDetail({ path: cleanPath, payload: payload.body }),
  });
};

export const configApi = {
  listUnits: (): Promise<ApiUnit[]> => get("/config/units"),
  createUnit: (data: { name: string; symbol?: string }): Promise<ApiUnit> =>
    request({ path: "/config/units", method: "POST", body: data }),
  updateUnit: (
    unitId: string,
    data: { name: string; symbol?: string | null },
  ): Promise<ApiUnit> =>
    request({ path: `/config/units/${unitId}`, method: "PATCH", body: data }),
  deleteUnit: (unitId: string): Promise<void> =>
    request({ path: `/config/units/${unitId}`, method: "DELETE" }),

  listArticles: (): Promise<ApiArticle[]> => get("/config/articles"),
  createArticle: (data: { name: string; code?: string }): Promise<ApiArticle> =>
    request({ path: "/config/articles", method: "POST", body: data }),
  updateArticle: (
    articleId: string,
    data: { name: string; code?: string | null },
  ): Promise<ApiArticle> =>
    request({
      path: `/config/articles/${articleId}`,
      method: "PATCH",
      body: data,
    }),
  deleteArticle: (articleId: string): Promise<void> =>
    request({ path: `/config/articles/${articleId}`, method: "DELETE" }),

  listLaborCategories: (): Promise<ApiLaborCategory[]> =>
    get("/config/labor-categories"),
  createLaborCategory: (data: { name: string }): Promise<ApiLaborCategory> =>
    request({ path: "/config/labor-categories", method: "POST", body: data }),
  updateLaborCategory: (
    categoryId: string,
    data: { name: string },
  ): Promise<ApiLaborCategory> =>
    request({
      path: `/config/labor-categories/${categoryId}`,
      method: "PATCH",
      body: data,
    }),
  deleteLaborCategory: (categoryId: string): Promise<void> =>
    request({
      path: `/config/labor-categories/${categoryId}`,
      method: "DELETE",
    }),

  listPaymentTypes: (): Promise<ApiPaymentType[]> =>
    get("/config/payment-types"),
  createPaymentType: (data: {
    name: string;
    unitId?: string;
  }): Promise<ApiPaymentType> =>
    request({ path: "/config/payment-types", method: "POST", body: data }),
  updatePaymentType: (
    paymentTypeId: string,
    data: { name: string; unitId?: string | null },
  ): Promise<ApiPaymentType> =>
    request({
      path: `/config/payment-types/${paymentTypeId}`,
      method: "PATCH",
      body: data,
    }),
  deletePaymentType: (paymentTypeId: string): Promise<void> =>
    request({
      path: `/config/payment-types/${paymentTypeId}`,
      method: "DELETE",
    }),

  listExpenseCategories: (): Promise<ApiExpenseCategory[]> =>
    get("/config/expense-categories"),
  createExpenseCategory: (data: {
    name: string;
  }): Promise<ApiExpenseCategory> =>
    request({ path: "/config/expense-categories", method: "POST", body: data }),
  updateExpenseCategory: (
    expenseCategoryId: string,
    data: { name: string },
  ): Promise<ApiExpenseCategory> =>
    request({
      path: `/config/expense-categories/${expenseCategoryId}`,
      method: "PATCH",
      body: data,
    }),
  deleteExpenseCategory: (expenseCategoryId: string): Promise<void> =>
    request({
      path: `/config/expense-categories/${expenseCategoryId}`,
      method: "DELETE",
    }),
};

export const partyApi = {
  listParties: (): Promise<ApiParty[]> => get("/parties"),
  listSupplierPendingDues: (params?: {
    asOf?: string;
  }): Promise<ApiSupplierPendingDuesResponse> =>
    get(
      withQuery("/parties/suppliers/pending", {
        asOf: params?.asOf,
      }),
    ),
  createParty: (data: {
    name: string;
    type: ApiParty["type"];
    openingBalance?: number;
  }): Promise<ApiParty> =>
    request({ path: "/parties", method: "POST", body: data }),
  updateParty: (
    partyId: string,
    data: {
      name?: string;
      type?: ApiParty["type"];
      openingBalance?: number;
    },
  ): Promise<ApiParty> =>
    request({ path: `/parties/${partyId}`, method: "PATCH", body: data }),
  deleteParty: (partyId: string): Promise<void> =>
    request({ path: `/parties/${partyId}`, method: "DELETE" }),
  getLedger: (partyId: string): Promise<ApiPartyLedgerEntry[]> =>
    get(`/parties/${partyId}/ledger`),
  createPayment: (
    partyId: string,
    data: {
      date: string;
      amount: number;
      method?: ApiPartyPayment["method"];
      direction?: "RECEIVE" | "PAY";
      reference?: string;
      description?: string;
      chequeId?: string;
      chequeNumber?: string;
      chequeNotes?: string;
      billId?: string;
      chemicalPurchaseId?: string;
      rexinePurchaseId?: string;
      materialPurchaseId?: string;
    },
  ): Promise<ApiPartyPayment> =>
    request({
      path: `/parties/${partyId}/payments`,
      method: "POST",
      body: data,
    }),
};

export const expenseApi = {
  listExpenses: (params?: {
    start?: string;
    end?: string;
    module?: ApiExpenseModule;
  }): Promise<ApiExpenseEntry[]> => {
    const query = new URLSearchParams();
    if (params?.start) query.set("start", params.start);
    if (params?.end) query.set("end", params.end);
    if (params?.module) query.set("module", params.module);
    const suffix = query.toString();
    return get(`/expenses${suffix ? `?${suffix}` : ""}`);
  },
  createExpense: (data: {
    date: string;
    partyId?: string;
    laborId?: string;
    module?: ApiExpenseModule;
    paymentType?: ApiPaymentMethod;
    amount: number;
    description?: string;
    actorUsername?: string;
    actorRole?: string;
    moduleData?: Record<string, unknown>;
  }): Promise<ApiExpenseEntry> =>
    request({ path: "/expenses", method: "POST", body: data }),
  updateExpense: (
    expenseId: string,
    data: {
      date?: string;
      partyId?: string;
      laborId?: string;
      module?: ApiExpenseModule;
      paymentType?: ApiPaymentMethod;
      amount?: number;
      description?: string;
    },
    auditMeta?: ApiAuditMeta,
  ): Promise<ApiExpenseEntry> =>
    request({
      path: `/expenses/${expenseId}`,
      method: "PATCH",
      body: data,
      auditMeta,
    }),
  deleteExpense: (expenseId: string, auditMeta?: ApiAuditMeta): Promise<void> =>
    request({ path: `/expenses/${expenseId}`, method: "DELETE", auditMeta }),
};

export const laborApi = {
  listProfiles: (params?: {
    status?: "ACTIVE" | "FIRED" | "ALL";
  }): Promise<ApiLaborProfile[]> => {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    const suffix = query.toString();
    return get(`/labor/profiles${suffix ? `?${suffix}` : ""}`);
  },
  createProfile: (
    data: {
      name: string;
      categoryId: string;
      paymentTypeId: string;
      defaultRate?: number;
      status?: "ACTIVE" | "FIRED";
    },
    auditMeta?: ApiAuditMeta,
  ): Promise<ApiLaborProfile> =>
    request({ path: "/labor/profiles", method: "POST", body: data, auditMeta }),
  updateProfile: (
    laborId: string,
    data: {
      name?: string;
      categoryId?: string;
      paymentTypeId?: string;
      defaultRate?: number;
      status?: "ACTIVE" | "FIRED";
    },
    auditMeta?: ApiAuditMeta,
  ): Promise<ApiLaborProfile> =>
    request({
      path: `/labor/profiles/${laborId}`,
      method: "PATCH",
      body: data,
      auditMeta,
    }),
  fireProfile: (laborId: string, auditMeta?: ApiAuditMeta): Promise<void> =>
    request({
      path: `/labor/profiles/${laborId}/fire`,
      method: "POST",
      auditMeta,
    }),
  deleteProfile: (laborId: string, auditMeta?: ApiAuditMeta): Promise<void> =>
    request({
      path: `/labor/profiles/${laborId}/fire`,
      method: "POST",
      auditMeta,
    }),
  upsertRate: (data: {
    laborId: string;
    articleId: string;
    unitId?: string;
    rate: number;
  }): Promise<unknown> =>
    request({ path: "/labor/rates", method: "POST", body: data }),
  createWorkEntry: (
    data: {
      laborId: string;
      articleId: string;
      unitId?: string;
      startDate: string;
      endDate: string;
      quantity: number;
      rate: number;
      total: number;
    },
    auditMeta?: ApiAuditMeta,
  ): Promise<ApiLaborWorkEntry> =>
    request({ path: "/labor/work", method: "POST", body: data, auditMeta }),
  updateWorkEntry: (
    workId: string,
    data: {
      laborId?: string;
      articleId?: string;
      unitId?: string;
      startDate?: string;
      endDate?: string;
      quantity?: number;
      rate?: number;
      total?: number;
    },
    auditMeta?: ApiAuditMeta,
  ): Promise<ApiLaborWorkEntry> =>
    request({
      path: `/labor/work/${workId}`,
      method: "PATCH",
      body: data,
      auditMeta,
    }),
  deleteWorkEntry: (workId: string, auditMeta?: ApiAuditMeta): Promise<void> =>
    request({ path: `/labor/work/${workId}`, method: "DELETE", auditMeta }),
  createAdvance: (
    data: {
      laborId: string;
      date: string;
      amount: number;
      reason: string;
      categoryId?: string;
      partyId?: string;
    },
    auditMeta?: ApiAuditMeta,
  ): Promise<{ advance: ApiLaborAdvance; expense: unknown }> =>
    request({ path: "/labor/advances", method: "POST", body: data, auditMeta }),
  updateAdvance: (
    advanceId: string,
    data: {
      laborId?: string;
      date?: string;
      amount?: number;
      reason?: string;
      categoryId?: string;
    },
    auditMeta?: ApiAuditMeta,
  ): Promise<ApiLaborAdvance> =>
    request({
      path: `/labor/advances/${advanceId}`,
      method: "PATCH",
      body: data,
      auditMeta,
    }),
  deleteAdvance: (advanceId: string, auditMeta?: ApiAuditMeta): Promise<void> =>
    request({
      path: `/labor/advances/${advanceId}`,
      method: "DELETE",
      auditMeta,
    }),
  getLedger: (
    laborId: string,
    params?: {
      start?: string;
      end?: string;
    },
  ): Promise<ApiLaborLedger> =>
    get(
      withQuery(`/labor/${laborId}/ledger`, {
        start: params?.start,
        end: params?.end,
      }),
    ),
};

export const billApi = {
  listBills: (): Promise<ApiBill[]> => get("/bills"),
  createBill: (data: {
    date: string;
    partyId?: string;
    type?: ApiBillType;
    status?: ApiBillStatus;
    lines: Array<{
      articleId: string;
      size?: string | null;
      quantity: number;
      price: number;
      total: number;
    }>;
  }): Promise<ApiBill> =>
    request({ path: "/bills", method: "POST", body: data }),
  confirmBill: (billId: string): Promise<ApiBill> =>
    request({ path: `/bills/${billId}/confirm`, method: "POST" }),
  updateBill: (
    billId: string,
    data: {
      date?: string;
      partyId?: string;
      type?: ApiBillType;
      status?: ApiBillStatus;
      lines?: Array<{
        articleId: string;
        size?: string | null;
        quantity: number;
        price: number;
        total: number;
      }>;
    },
  ): Promise<ApiBill> =>
    request({ path: `/bills/${billId}`, method: "PATCH", body: data }),
  deleteBill: (billId: string): Promise<void> =>
    request({ path: `/bills/${billId}`, method: "DELETE" }),
  getLedger: (billId: string): Promise<ApiBillLedgerEntry[]> =>
    get(`/bills/${billId}/ledger`),
  receivePayment: (
    billId: string,
    data: {
      amount: number;
      date?: string;
      method?: ApiPaymentMethod;
      reference?: string;
      description?: string;
      chequeNumber?: string;
      chequeNotes?: string;
    },
  ): Promise<{ payment: ApiPartyPayment; bill: ApiBill }> =>
    request({ path: `/bills/${billId}/payments`, method: "POST", body: data }),
  verifyBill: (billId: string): Promise<ApiBill> =>
    request({ path: `/bills/${billId}/verify`, method: "POST" }),
};

export const chequeApi = {
  listCheques: (): Promise<ApiCheque[]> => get("/cheques"),
  listAvailableCheques: (params?: { amount?: number }): Promise<ApiCheque[]> =>
    get(
      withQuery("/cheques/available", {
        amount:
          params?.amount != null && Number.isFinite(params.amount)
            ? String(params.amount)
            : undefined,
      }),
    ),
  updateCheque: (
    chequeId: string,
    data: {
      date?: string;
      amount?: number;
      chequeNumber?: string;
      notes?: string;
    },
  ): Promise<ApiCheque> =>
    request({ path: `/cheques/${chequeId}`, method: "PATCH", body: data }),
  cashCheque: (
    chequeId: string,
    data?: { date?: string; notes?: string },
  ): Promise<ApiCheque> =>
    request({
      path: `/cheques/${chequeId}/cash`,
      method: "POST",
      body: data ?? {},
    }),
};

export const purchaseApi = {
  listChemicals: (): Promise<ApiChemicalPurchase[]> => get("/chemicals"),
  createChemical: (
    data: {
      date: string;
      partyId?: string;
      categoryId?: string;
      quantityKg: number;
      ratePerKg: number;
      totalAmount: number;
      paymentType?: ApiPaymentMethod;
      description?: string;
    },
    auditMeta?: ApiAuditMeta,
  ): Promise<{ purchase: ApiChemicalPurchase }> =>
    request({ path: "/chemicals", method: "POST", body: data, auditMeta }),
  updateChemical: (
    purchaseId: string,
    data: {
      date?: string;
      partyId?: string;
      categoryId?: string;
      quantityKg?: number;
      ratePerKg?: number;
      totalAmount?: number;
      paymentType?: ApiPaymentMethod;
      description?: string;
    },
    auditMeta?: ApiAuditMeta,
  ): Promise<ApiChemicalPurchase> =>
    request({
      path: `/chemicals/${purchaseId}`,
      method: "PATCH",
      body: data,
      auditMeta,
    }),
  deleteChemical: (
    purchaseId: string,
    auditMeta?: ApiAuditMeta,
  ): Promise<void> =>
    request({ path: `/chemicals/${purchaseId}`, method: "DELETE", auditMeta }),

  listRexine: (): Promise<ApiRexinePurchase[]> => get("/rexine"),
  createRexine: (
    data: {
      date: string;
      partyId?: string;
      categoryId?: string;
      quantityMeter: number;
      ratePerMeter: number;
      totalAmount: number;
      paymentType?: ApiPaymentMethod;
      description?: string;
    },
    auditMeta?: ApiAuditMeta,
  ): Promise<{ purchase: ApiRexinePurchase }> =>
    request({ path: "/rexine", method: "POST", body: data, auditMeta }),
  updateRexine: (
    purchaseId: string,
    data: {
      date?: string;
      partyId?: string;
      categoryId?: string;
      quantityMeter?: number;
      ratePerMeter?: number;
      totalAmount?: number;
      paymentType?: ApiPaymentMethod;
      description?: string;
    },
    auditMeta?: ApiAuditMeta,
  ): Promise<ApiRexinePurchase> =>
    request({
      path: `/rexine/${purchaseId}`,
      method: "PATCH",
      body: data,
      auditMeta,
    }),
  deleteRexine: (purchaseId: string, auditMeta?: ApiAuditMeta): Promise<void> =>
    request({ path: `/rexine/${purchaseId}`, method: "DELETE", auditMeta }),

  listMaterials: (): Promise<ApiMaterialPurchase[]> => get("/materials"),
  createMaterial: (
    data: {
      date: string;
      partyId?: string;
      categoryId?: string;
      articleId?: string;
      unitId?: string;
      quantity: number;
      pricePerUnit: number;
      totalAmount: number;
      paymentType?: ApiPaymentMethod;
      description?: string;
    },
    auditMeta?: ApiAuditMeta,
  ): Promise<{ purchase: ApiMaterialPurchase }> =>
    request({ path: "/materials", method: "POST", body: data, auditMeta }),
  updateMaterial: (
    purchaseId: string,
    data: {
      date?: string;
      partyId?: string;
      categoryId?: string;
      articleId?: string;
      unitId?: string;
      quantity?: number;
      pricePerUnit?: number;
      totalAmount?: number;
      paymentType?: ApiPaymentMethod;
      description?: string;
    },
    auditMeta?: ApiAuditMeta,
  ): Promise<ApiMaterialPurchase> =>
    request({
      path: `/materials/${purchaseId}`,
      method: "PATCH",
      body: data,
      auditMeta,
    }),
  deleteMaterial: (
    purchaseId: string,
    auditMeta?: ApiAuditMeta,
  ): Promise<void> =>
    request({ path: `/materials/${purchaseId}`, method: "DELETE", auditMeta }),
};

export const productionApi = {
  listOrders: (
    department?: ApiLaborDepartment,
  ): Promise<ApiProductionOrder[]> => {
    const query = new URLSearchParams();
    if (department) query.set("department", department);
    const suffix = query.toString();
    return get(`/production/orders${suffix ? `?${suffix}` : ""}`);
  },
  createOrder: (data: {
    department: ApiLaborDepartment;
    articleId: string;
    laborId?: string;
    quantityDozen: number;
    pricePerDozen: number;
  }): Promise<ApiProductionOrder> =>
    request({ path: "/production/orders", method: "POST", body: data }),
  updateOrder: (
    orderId: string,
    data: {
      articleId?: string;
      quantityDozen?: number;
      pricePerDozen?: number;
    },
  ): Promise<ApiProductionOrder> =>
    request({
      path: `/production/orders/${orderId}`,
      method: "PATCH",
      body: data,
    }),
  assignLabor: (
    orderId: string,
    payload: {
      laborId?: string;
      pricePerDozen?: number;
      machinemanLaborId?: string;
      machinemanPricePerDozen?: number;
      packingLaborId?: string;
      packingPricePerDozen?: number;
    },
  ): Promise<ApiProductionOrder> =>
    request({
      path: `/production/orders/${orderId}/assign-labor`,
      method: "PATCH",
      body: {
        laborId: payload.laborId ?? null,
        pricePerDozen: payload.pricePerDozen,
        machinemanLaborId: payload.machinemanLaborId ?? null,
        machinemanPricePerDozen: payload.machinemanPricePerDozen,
        packingLaborId: payload.packingLaborId ?? null,
        packingPricePerDozen: payload.packingPricePerDozen,
      },
    }),
  updateCompletion: (
    orderId: string,
    payload: {
      completedDozen: number;
      nextDepartment?: ApiLaborDepartment;
      bMallDozenDelta?: number;
      cMallDozenDelta?: number;
      upperDozenDelta?: number;
      upperNextDepartment?: ApiLaborDepartment;
      ptawaDozenDelta?: number;
      ptawaNextDepartment?: ApiLaborDepartment;
    },
  ): Promise<ApiProductionOrder> =>
    request({
      path: `/production/orders/${orderId}/completion`,
      method: "PATCH",
      body: {
        completedDozen: payload.completedDozen,
        nextDepartment: payload.nextDepartment,
        bMallDozenDelta: payload.bMallDozenDelta,
        cMallDozenDelta: payload.cMallDozenDelta,
        upperDozenDelta: payload.upperDozenDelta,
        upperNextDepartment: payload.upperNextDepartment,
        ptawaDozenDelta: payload.ptawaDozenDelta,
        ptawaNextDepartment: payload.ptawaNextDepartment,
      },
    }),
  listDepartmentLabors: (): Promise<
    Array<{ id: string; name: string; department: ApiLaborDepartment }>
  > => get("/production/labors"),
  getStockSummary: (): Promise<ApiStockSummary> =>
    get("/production/stock/summary"),
  listStockByArticle: (params?: {
    mode?: ApiStockMode;
    q?: string;
  }): Promise<ApiStockArticleRow[]> => {
    const query = new URLSearchParams();
    if (params?.mode) query.set("mode", params.mode);
    if (params?.q) query.set("q", params.q);
    const suffix = query.toString();
    return get(`/production/stock/articles${suffix ? `?${suffix}` : ""}`);
  },
  listManualStockEntries: (): Promise<ApiStockEntry[]> =>
    get("/production/stock/manual"),
  createManualStockEntry: (data: {
    articleId: string;
    mode: ApiStockMode;
    quantityDozen: number;
    note?: string;
  }): Promise<ApiStockEntry> =>
    request({ path: "/production/stock/manual", method: "POST", body: data }),
  updateManualStockEntry: (
    entryId: string,
    data: {
      articleId?: string;
      mode?: ApiStockMode;
      quantityDozen?: number;
      note?: string | null;
    },
  ): Promise<ApiStockEntry> =>
    request({
      path: `/production/stock/manual/${entryId}`,
      method: "PATCH",
      body: data,
    }),
  deleteManualStockEntry: (entryId: string): Promise<void> =>
    request({
      path: `/production/stock/manual/${entryId}`,
      method: "DELETE",
    }),
};

export const reportsApi = {
  getRoznamchaSummary: (params?: {
    period?: "daily" | "weekly" | "monthly";
    start?: string;
    end?: string;
  }): Promise<ApiRoznamchaSummaryReport> =>
    get(
      withQuery("/reports/roznamcha/summary", {
        period: params?.period,
        start: params?.start,
        end: params?.end,
      }),
    ),
  getLaborSummary: (params?: {
    period?: "weekly" | "monthly";
    start?: string;
    end?: string;
  }): Promise<ApiLaborSummaryReport> =>
    get(
      withQuery("/reports/labor/summary", {
        period: params?.period,
        start: params?.start,
        end: params?.end,
      }),
    ),
  getPartyMonthlyOutstanding: (params?: {
    period?: "monthly";
    start?: string;
    end?: string;
  }): Promise<ApiPartyMonthlyOutstandingReport> =>
    get(
      withQuery("/reports/parties/monthly-outstanding", {
        period: params?.period,
        start: params?.start,
        end: params?.end,
      }),
    ),
};
