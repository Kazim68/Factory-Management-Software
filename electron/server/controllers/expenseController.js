import prisma from "../prisma.js";
import { groupByPeriod, toDate, withDateRange } from "../utils/date.js";

const toDbPaymentType = (paymentType) => {
  const normalized = String(paymentType ?? "CASH").toUpperCase();
  if (normalized === "KHATA") return "CREDIT";
  return normalized === "CREDIT" ? "CREDIT" : "CASH";
};

const isKhata = (paymentType) =>
  ["CREDIT", "KHATA"].includes(String(paymentType ?? "CASH").toUpperCase());

export const listExpenses = async (req, res) => {
  const start = toDate(req.query.start);
  const end = toDate(req.query.end);
  const expenses = await prisma.expenseEntry.findMany({
    where: {
      date: withDateRange(start, end),
      module: req.query.module,
    },
    include: {
      party: true,
      labor: true,
      laborAdvance: { include: { labor: true } },
    },
    orderBy: { date: "desc" },
  });
  res.json(expenses);
};

export const createExpense = async (req, res) => {
  const {
    date,
    partyId,
    laborId,
    module,
    amount,
    description,
    moduleData,
  } = req.body;

  const result = await prisma.$transaction(async (tx) => {
    let chemicalPurchaseId;
    let rexinePurchaseId;
    let materialPurchaseId;
    let laborAdvanceId;

    if (module === "CHEMICAL" && moduleData) {
      const purchase = await tx.chemicalPurchase.create({
        data: {
          date: new Date(moduleData.date ?? date),
          partyId: moduleData.partyId ?? partyId,
          quantityKg: moduleData.quantityKg,
          ratePerKg: moduleData.ratePerKg,
          totalAmount: moduleData.totalAmount ?? amount,
          paymentType: toDbPaymentType(moduleData.paymentType ?? "CASH"),
        },
      });
      chemicalPurchaseId = purchase.id;

      if (purchase.partyId && isKhata(purchase.paymentType)) {
        await tx.partyLedgerEntry.create({
          data: {
            partyId: purchase.partyId,
            date: purchase.date,
            reference: "Chemical Purchase",
            description,
            balance: -Number(purchase.totalAmount),
          },
        });
      }
    }

    if (module === "REXINE" && moduleData) {
      const purchase = await tx.rexinePurchase.create({
        data: {
          date: new Date(moduleData.date ?? date),
          partyId: moduleData.partyId ?? partyId,
          quantityMeter: moduleData.quantityMeter,
          ratePerMeter: moduleData.ratePerMeter,
          totalAmount: moduleData.totalAmount ?? amount,
          paymentType: toDbPaymentType(moduleData.paymentType ?? "CASH"),
        },
      });
      rexinePurchaseId = purchase.id;

      if (purchase.partyId && isKhata(purchase.paymentType)) {
        await tx.partyLedgerEntry.create({
          data: {
            partyId: purchase.partyId,
            date: purchase.date,
            reference: "Rexine Purchase",
            description,
            balance: -Number(purchase.totalAmount),
          },
        });
      }
    }

    if (module === "MATERIAL" && moduleData) {
      const purchase = await tx.materialPurchase.create({
        data: {
          date: new Date(moduleData.date ?? date),
          partyId: moduleData.partyId ?? partyId,
          articleId: moduleData.articleId,
          unitId: moduleData.unitId,
          quantity: moduleData.quantity,
          pricePerUnit: moduleData.pricePerUnit,
          totalAmount: moduleData.totalAmount ?? amount,
          paymentType: toDbPaymentType(moduleData.paymentType ?? "CASH"),
        },
      });
      materialPurchaseId = purchase.id;

      if (purchase.partyId && isKhata(purchase.paymentType)) {
        await tx.partyLedgerEntry.create({
          data: {
            partyId: purchase.partyId,
            date: purchase.date,
            reference: "Material Purchase",
            description,
            balance: -Number(purchase.totalAmount),
          },
        });
      }
    }

    if (module === "LABOR" && moduleData) {
      const advance = await tx.laborAdvance.create({
        data: {
          laborId: moduleData.laborId,
          date: new Date(moduleData.date ?? date),
          amount: moduleData.amount ?? amount,
          reason: moduleData.reason ?? description,
        },
      });
      laborAdvanceId = advance.id;
    }

    const expense = await tx.expenseEntry.create({
      data: {
        date: new Date(date),
        partyId,
        laborId,
        module: module ?? "MISC",
        paymentType: toDbPaymentType(req.body.paymentType ?? moduleData?.paymentType),
        amount,
        description,
        chemicalPurchaseId,
        rexinePurchaseId,
        materialPurchaseId,
        laborAdvanceId,
        source: "MANUAL",
        sourceSystem: "ROZNAMCHA_MANUAL",
      },
      include: {
        party: true,
        labor: true,
        laborAdvance: { include: { labor: true } },
      },
    });

    return expense;
  });

  res.status(201).json(result);
};

export const updateExpense = async (req, res) => {
  const existing = await prisma.expenseEntry.findUnique({
    where: { id: req.params.expenseId },
  });
  if (!existing) {
    res.status(404).json({ error: "Expense not found." });
    return;
  }
  if (existing.source === "SYSTEM") {
    res.status(403).json({ error: "System entries cannot be edited from Roznamcha." });
    return;
  }

  const expense = await prisma.expenseEntry.update({
    where: { id: req.params.expenseId },
    data: {
      date: req.body.date ? new Date(req.body.date) : undefined,
      partyId: req.body.partyId,
      laborId: req.body.laborId,
      module: req.body.module,
      paymentType: req.body.paymentType
        ? toDbPaymentType(req.body.paymentType)
        : undefined,
      amount: req.body.amount,
      description: req.body.description,
    },
    include: {
      party: true,
      labor: true,
      laborAdvance: { include: { labor: true } },
    },
  });
  res.json(expense);
};

export const deleteExpense = async (req, res) => {
  const expense = await prisma.expenseEntry.findUnique({
    where: { id: req.params.expenseId },
  });
  if (!expense) {
    res.status(404).json({ error: "Expense not found." });
    return;
  }
  if (expense.source === "SYSTEM") {
    res.status(403).json({ error: "System entries cannot be deleted from Roznamcha." });
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (expense?.chemicalPurchaseId) {
      await tx.partyLedgerEntry.deleteMany({
        where: { chemicalPurchaseId: expense.chemicalPurchaseId },
      });
      await tx.chemicalPurchase.delete({ where: { id: expense.chemicalPurchaseId } });
    }
    if (expense?.rexinePurchaseId) {
      await tx.partyLedgerEntry.deleteMany({
        where: { rexinePurchaseId: expense.rexinePurchaseId },
      });
      await tx.rexinePurchase.delete({ where: { id: expense.rexinePurchaseId } });
    }
    if (expense?.materialPurchaseId) {
      await tx.partyLedgerEntry.deleteMany({
        where: { materialPurchaseId: expense.materialPurchaseId },
      });
      await tx.materialPurchase.delete({ where: { id: expense.materialPurchaseId } });
    }
    if (expense?.laborAdvanceId) {
      await tx.laborAdvance.delete({ where: { id: expense.laborAdvanceId } });
    }
    await tx.expenseEntry.delete({ where: { id: req.params.expenseId } });
  });

  res.status(204).end();
};

export const getDailySummary = async (req, res) => {
  const start = toDate(req.query.start);
  const end = toDate(req.query.end);
  const expenses = await prisma.expenseEntry.findMany({
    where: { date: withDateRange(start, end) },
    orderBy: { date: "asc" },
  });

  const grouped = groupByPeriod(expenses, (expense) =>
    expense.date.toISOString().slice(0, 10)
  );
  res.json(Object.values(grouped));
};

export const getWeeklySummary = async (req, res) => {
  const start = toDate(req.query.start);
  const end = toDate(req.query.end);
  const expenses = await prisma.expenseEntry.findMany({
    where: { date: withDateRange(start, end) },
    orderBy: { date: "asc" },
  });

  const grouped = groupByPeriod(expenses, (expense) => {
    const date = new Date(expense.date);
    const day = date.getUTCDay() || 7;
    const weekStart = new Date(date);
    weekStart.setUTCDate(date.getUTCDate() - day + 1);
    return weekStart.toISOString().slice(0, 10);
  });

  res.json(Object.values(grouped));
};

export const getMonthlySummary = async (req, res) => {
  const start = toDate(req.query.start);
  const end = toDate(req.query.end);
  const expenses = await prisma.expenseEntry.findMany({
    where: { date: withDateRange(start, end) },
    orderBy: { date: "asc" },
  });

  const grouped = groupByPeriod(expenses, (expense) =>
    expense.date.toISOString().slice(0, 7)
  );

  res.json(Object.values(grouped));
};
