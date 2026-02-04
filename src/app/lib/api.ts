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

  listArticles: (): Promise<ApiArticle[]> => get("/config/articles"),
  createArticle: (data: { name: string; code?: string }): Promise<ApiArticle> =>
    request({ path: "/config/articles", method: "POST", body: data }),

  listLaborCategories: (): Promise<ApiLaborCategory[]> =>
    get("/config/labor-categories"),
  createLaborCategory: (data: { name: string }): Promise<ApiLaborCategory> =>
    request({ path: "/config/labor-categories", method: "POST", body: data }),

  listPaymentTypes: (): Promise<ApiPaymentType[]> =>
    get("/config/payment-types"),
  createPaymentType: (data: {
    name: string;
    unitId?: string;
  }): Promise<ApiPaymentType> =>
    request({ path: "/config/payment-types", method: "POST", body: data }),

  listExpenseCategories: (): Promise<ApiExpenseCategory[]> =>
    get("/config/expense-categories"),
  createExpenseCategory: (data: {
    name: string;
  }): Promise<ApiExpenseCategory> =>
    request({ path: "/config/expense-categories", method: "POST", body: data }),
};

export const partyApi = {
  listParties: (): Promise<ApiParty[]> => get("/parties"),
  createParty: (data: {
    name: string;
    type: ApiParty["type"];
    openingBalance?: number;
  }): Promise<ApiParty> =>
    request({ path: "/parties", method: "POST", body: data }),
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
    module?: ApiExpenseModule;
    amount: number;
    description?: string;
    moduleData?: Record<string, unknown>;
  }): Promise<ApiExpenseEntry> =>
    request({ path: "/expenses", method: "POST", body: data }),
};

export const laborApi = {
  listProfiles: (): Promise<ApiLaborProfile[]> => get("/labor/profiles"),
  createProfile: (data: {
    name: string;
    categoryId: string;
    paymentTypeId: string;
    defaultRate?: number;
  }): Promise<ApiLaborProfile> =>
    request({ path: "/labor/profiles", method: "POST", body: data }),
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
  createAdvance: (data: {
    laborId: string;
    date: string;
    amount: number;
    reason: string;
    categoryId: string;
    partyId?: string;
  }): Promise<{ advance: ApiLaborAdvance; expense: unknown }> =>
    request({ path: "/labor/advances", method: "POST", body: data }),
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
};
