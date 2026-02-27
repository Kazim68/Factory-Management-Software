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
  ApiPartyPayment,
  ApiBill,
  ApiBillLedgerEntry,
  ApiBillLine,
  ApiBillStatus,
  ApiBillType,
  ApiChemicalPurchase,
  ApiMaterialPurchase,
  ApiPaymentMethod,
  ApiRexinePurchase,
  ApiUnit,
} from "../types/api";
import { auth } from "./auth";

type ApiAuditMeta = {
  itemLabel?: string;
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
};

const toTitleCase = (value: string): string =>
  value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const singularize = (value: string): string =>
  value.endsWith("s") ? value.slice(0, -1) : value;

const isIdSegment = (segment: string): boolean => /^(\d+|[0-9a-fA-F-]{8,})$/.test(segment);

const getAuditContext = (path: string) => {
  const cleanPath = path.split("?")[0];
  const segments = cleanPath.split("/").filter(Boolean);

  const resourceId =
    segments.length > 0 && isIdSegment(segments[segments.length - 1])
      ? segments[segments.length - 1]
      : undefined;

  const entitySegments = resourceId ? segments.slice(0, -1) : segments;
  const entity = entitySegments.length
    ? entitySegments.map((segment) => toTitleCase(singularize(segment))).join(" / ")
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
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "string") return value;
  return String(value);
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
  const baseSegments = segments.filter((segment) => !/^(\d+|[0-9a-fA-F-]{8,})$/.test(segment));
  const key = baseSegments.join("/");
  return ENTITY_LABELS[key] ?? fallbackEntity.toLowerCase();
};

const buildFriendlyDetail = (
  method: "POST" | "PATCH" | "DELETE",
  cleanPath: string,
  entity: string,
  payloadBody: unknown,
): string => {
  const label = getEntityLabel(cleanPath, entity);
  const what =
    pickValue(payloadBody, ["name", "description", "detail", "reference", "billNumber"]) ??
    pickValue(payloadBody, ["amount", "quantity", "total"])?.concat(" amount") ??
    "record";

  if (method === "POST") {
    return `New ${label} added: ${what}.`;
  }

  if (method === "PATCH") {
    return `${label[0].toUpperCase()}${label.slice(1)} updated: ${what}.`;
  }

  return `${label[0].toUpperCase()}${label.slice(1)} deleted. Removed item: ${what}.`;
};

const writeAuditLog = (payload: ApiRequest): void => {
  const method = (payload.method ?? "GET").toUpperCase();
  if (!AUDITABLE_METHODS.has(method)) return;

  const { cleanPath, entity, resourceId } = getAuditContext(payload.path, method);
  const actor = auth.getSessionUser();
  const verb = method === "POST" ? "Created" : method === "PATCH" ? "Updated" : "Deleted";

  auth.logAction({
    actorId: actor?.id,
    actorName: actor?.name ?? "System",
    action: `${entity} ${verb}`,
    entity,
    resourceId,
    method: method as "POST" | "PATCH" | "DELETE",
    detail:
      buildFriendlyDetail(method as "POST" | "PATCH" | "DELETE", cleanPath, entity, payload.body) ??
      stringifyDetail({ path: cleanPath, payload: payload.body }),
  });
};

export const configApi = {
  listUnits: (): Promise<ApiUnit[]> => get("/config/units"),
  createUnit: (data: { name: string; symbol?: string }): Promise<ApiUnit> =>
    request({ path: "/config/units", method: "POST", body: data }),
  updateUnit: (
    unitId: string,
    data: { name: string; symbol?: string | null }
  ): Promise<ApiUnit> =>
    request({ path: `/config/units/${unitId}`, method: "PATCH", body: data }),
  deleteUnit: (unitId: string): Promise<void> =>
    request({ path: `/config/units/${unitId}`, method: "DELETE" }),

  listArticles: (): Promise<ApiArticle[]> => get("/config/articles"),
  createArticle: (data: { name: string; code?: string }): Promise<ApiArticle> =>
    request({ path: "/config/articles", method: "POST", body: data }),
  updateArticle: (
    articleId: string,
    data: { name: string; code?: string | null }
  ): Promise<ApiArticle> =>
    request({ path: `/config/articles/${articleId}`, method: "PATCH", body: data }),
  deleteArticle: (articleId: string): Promise<void> =>
    request({ path: `/config/articles/${articleId}`, method: "DELETE" }),

  listLaborCategories: (): Promise<ApiLaborCategory[]> =>
    get("/config/labor-categories"),
  createLaborCategory: (data: { name: string }): Promise<ApiLaborCategory> =>
    request({ path: "/config/labor-categories", method: "POST", body: data }),
  updateLaborCategory: (
    categoryId: string,
    data: { name: string }
  ): Promise<ApiLaborCategory> =>
    request({
      path: `/config/labor-categories/${categoryId}`,
      method: "PATCH",
      body: data,
    }),
  deleteLaborCategory: (categoryId: string): Promise<void> =>
    request({ path: `/config/labor-categories/${categoryId}`, method: "DELETE" }),

  listPaymentTypes: (): Promise<ApiPaymentType[]> =>
    get("/config/payment-types"),
  createPaymentType: (data: {
    name: string;
    unitId?: string;
  }): Promise<ApiPaymentType> =>
    request({ path: "/config/payment-types", method: "POST", body: data }),
  updatePaymentType: (
    paymentTypeId: string,
    data: { name: string; unitId?: string | null }
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
    data: { name: string }
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
    }
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
      billId?: string;
      chemicalPurchaseId?: string;
      rexinePurchaseId?: string;
      materialPurchaseId?: string;
    }
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
    request({ path: `/expenses/${expenseId}`, method: "PATCH", body: data, auditMeta }),
  deleteExpense: (expenseId: string, auditMeta?: ApiAuditMeta): Promise<void> =>
    request({ path: `/expenses/${expenseId}`, method: "DELETE", auditMeta }),
};

export const laborApi = {
  listProfiles: (params?: { status?: "ACTIVE" | "FIRED" | "ALL" }): Promise<ApiLaborProfile[]> => {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    const suffix = query.toString();
    return get(`/labor/profiles${suffix ? `?${suffix}` : ""}`);
  },
  createProfile: (data: {
    name: string;
    categoryId: string;
    paymentTypeId: string;
    defaultRate?: number;
    status?: "ACTIVE" | "FIRED";
  }): Promise<ApiLaborProfile> =>
    request({ path: "/labor/profiles", method: "POST", body: data }),
  updateProfile: (
    laborId: string,
    data: {
      name?: string;
      categoryId?: string;
      paymentTypeId?: string;
      defaultRate?: number;
      status?: "ACTIVE" | "FIRED";
    }
  ): Promise<ApiLaborProfile> =>
    request({
      path: `/labor/profiles/${laborId}`,
      method: "PATCH",
      body: data,
    }),
  deleteProfile: (laborId: string): Promise<void> =>
    request({ path: `/labor/profiles/${laborId}`, method: "DELETE" }),
  upsertRate: (data: {
    laborId: string;
    articleId: string;
    unitId?: string;
    rate: number;
  }): Promise<unknown> =>
    request({ path: "/labor/rates", method: "POST", body: data }),
  createWorkEntry: (data: {
    laborId: string;
    articleId: string;
    unitId?: string;
    startDate: string;
    endDate: string;
    quantity: number;
    rate: number;
    total: number;
  }): Promise<ApiLaborWorkEntry> =>
    request({ path: "/labor/work", method: "POST", body: data }),
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
    }
  ): Promise<ApiLaborWorkEntry> =>
    request({ path: `/labor/work/${workId}`, method: "PATCH", body: data }),
  deleteWorkEntry: (workId: string): Promise<void> =>
    request({ path: `/labor/work/${workId}`, method: "DELETE" }),
  createAdvance: (data: {
    laborId: string;
    date: string;
    amount: number;
    reason: string;
    categoryId?: string;
    partyId?: string;
  }): Promise<{ advance: ApiLaborAdvance; expense: unknown }> =>
    request({ path: "/labor/advances", method: "POST", body: data }),
  updateAdvance: (
    advanceId: string,
    data: {
      laborId?: string;
      date?: string;
      amount?: number;
      reason?: string;
      categoryId?: string;
    }
  ): Promise<ApiLaborAdvance> =>
    request({
      path: `/labor/advances/${advanceId}`,
      method: "PATCH",
      body: data,
    }),
  deleteAdvance: (advanceId: string): Promise<void> =>
    request({ path: `/labor/advances/${advanceId}`, method: "DELETE" }),
  getLedger: (laborId: string): Promise<ApiLaborLedger> =>
    get(`/labor/${laborId}/ledger`),
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
      quantity: number;
      price: number;
      total: number;
    }>;
  }): Promise<ApiBill> => request({ path: "/bills", method: "POST", body: data }),
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
        quantity: number;
        price: number;
        total: number;
      }>;
    }
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
    }
  ): Promise<{ payment: ApiPartyPayment; bill: ApiBill }> =>
    request({ path: `/bills/${billId}/payments`, method: "POST", body: data }),
  verifyBill: (billId: string): Promise<ApiBill> =>
    request({ path: `/bills/${billId}/verify`, method: "POST" }),
};

export const purchaseApi = {
  listChemicals: (): Promise<ApiChemicalPurchase[]> => get("/chemicals"),
  createChemical: (data: {
    date: string;
    partyId?: string;
    categoryId?: string;
    quantityKg: number;
    ratePerKg: number;
    totalAmount: number;
    paymentType?: ApiPaymentMethod;
    description?: string;
  }): Promise<{ purchase: ApiChemicalPurchase }> =>
    request({ path: "/chemicals", method: "POST", body: data }),
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
    }
  ): Promise<ApiChemicalPurchase> =>
    request({
      path: `/chemicals/${purchaseId}`,
      method: "PATCH",
      body: data,
    }),
  deleteChemical: (purchaseId: string): Promise<void> =>
    request({ path: `/chemicals/${purchaseId}`, method: "DELETE" }),

  listRexine: (): Promise<ApiRexinePurchase[]> => get("/rexine"),
  createRexine: (data: {
    date: string;
    partyId?: string;
    categoryId?: string;
    quantityMeter: number;
    ratePerMeter: number;
    totalAmount: number;
    paymentType?: ApiPaymentMethod;
    description?: string;
  }): Promise<{ purchase: ApiRexinePurchase }> =>
    request({ path: "/rexine", method: "POST", body: data }),
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
    }
  ): Promise<ApiRexinePurchase> =>
    request({
      path: `/rexine/${purchaseId}`,
      method: "PATCH",
      body: data,
    }),
  deleteRexine: (purchaseId: string): Promise<void> =>
    request({ path: `/rexine/${purchaseId}`, method: "DELETE" }),

  listMaterials: (): Promise<ApiMaterialPurchase[]> => get("/materials"),
  createMaterial: (data: {
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
  }): Promise<{ purchase: ApiMaterialPurchase }> =>
    request({ path: "/materials", method: "POST", body: data }),
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
    }
  ): Promise<ApiMaterialPurchase> =>
    request({
      path: `/materials/${purchaseId}`,
      method: "PATCH",
      body: data,
    }),
  deleteMaterial: (purchaseId: string): Promise<void> =>
    request({ path: `/materials/${purchaseId}`, method: "DELETE" }),
};
