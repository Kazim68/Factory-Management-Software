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
  ApiBillLine,
  ApiBillStatus,
  ApiBillType,
  ApiChemicalPurchase,
  ApiMaterialPurchase,
  ApiPaymentMethod,
  ApiRexinePurchase,
  ApiUnit,
} from "../types/api";

type ApiRequest = {
  path: string;
  method?: string;
  body?: unknown;
};

const request = async <T>(payload: ApiRequest): Promise<T> => {
  if (typeof window === "undefined" || !window.api?.request) {
    throw new Error("API bridge is unavailable.");
  }

  return window.api.request(payload) as Promise<T>;
};

const get = <T>(path: string) => request<T>({ path });

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
      reference?: string;
      description?: string;
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
    categoryId?: string;
  }): Promise<ApiExpenseEntry[]> => {
    const query = new URLSearchParams();
    if (params?.start) query.set("start", params.start);
    if (params?.end) query.set("end", params.end);
    if (params?.module) query.set("module", params.module);
    if (params?.categoryId) query.set("categoryId", params.categoryId);
    const suffix = query.toString();
    return get(`/expenses${suffix ? `?${suffix}` : ""}`);
  },
  createExpense: (data: {
    date: string;
    categoryId: string;
    partyId?: string;
    laborId?: string;
    module?: ApiExpenseModule;
    amount: number;
    description?: string;
    moduleData?: Record<string, unknown>;
  }): Promise<ApiExpenseEntry> =>
    request({ path: "/expenses", method: "POST", body: data }),
  updateExpense: (
    expenseId: string,
    data: {
      date?: string;
      categoryId?: string;
      partyId?: string;
      laborId?: string;
      module?: ApiExpenseModule;
      amount?: number;
      description?: string;
    }
  ): Promise<ApiExpenseEntry> =>
    request({ path: `/expenses/${expenseId}`, method: "PATCH", body: data }),
  deleteExpense: (expenseId: string): Promise<void> =>
    request({ path: `/expenses/${expenseId}`, method: "DELETE" }),
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
    categoryId: string;
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
};

export const purchaseApi = {
  listChemicals: (): Promise<ApiChemicalPurchase[]> => get("/chemicals"),
  createChemical: (data: {
    date: string;
    partyId?: string;
    categoryId: string;
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
    categoryId: string;
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
    categoryId: string;
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
