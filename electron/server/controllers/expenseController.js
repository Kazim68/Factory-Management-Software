import prisma from "../prisma.js";
import { groupByPeriod, toDate, withDateRange } from "../utils/date.js";

export const listExpenses = async (req, res) => {
  const start = toDate(req.query.start);
  const end = toDate(req.query.end);
  const expenses = await prisma.expenseEntry.findMany({
    where: {
      date: withDateRange(start, end),
      module: req.query.module,
      categoryId: req.query.categoryId,
    },
    include: { category: true, party: true, laborAdvance: { include: { labor: true } } },
    orderBy: { date: "desc" },
  });
  res.json(expenses);
};

export const createExpense = async (req, res) => {
  const {
    date,
    categoryId,
    partyId,
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
          paymentType: moduleData.paymentType ?? "CASH",
        },
      });
      chemicalPurchaseId = purchase.id;

      if (purchase.partyId && purchase.paymentType === "CREDIT") {
        await tx.partyLedgerEntry.create({
          data: {
            partyId: purchase.partyId,
            date: purchase.date,
            reference: "Chemical Purchase",
            description,
            debit: 0,
            credit: purchase.totalAmount,
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
          paymentType: moduleData.paymentType ?? "CASH",
        },
      });
      rexinePurchaseId = purchase.id;

      if (purchase.partyId && purchase.paymentType === "CREDIT") {
        await tx.partyLedgerEntry.create({
          data: {
            partyId: purchase.partyId,
            date: purchase.date,
            reference: "Rexine Purchase",
            description,
            debit: 0,
            credit: purchase.totalAmount,
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
          paymentType: moduleData.paymentType ?? "CASH",
        },
      });
      materialPurchaseId = purchase.id;

      if (purchase.partyId && purchase.paymentType === "CREDIT") {
        await tx.partyLedgerEntry.create({
          data: {
            partyId: purchase.partyId,
            date: purchase.date,
            reference: "Material Purchase",
            description,
            debit: 0,
            credit: purchase.totalAmount,
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
        categoryId,
        partyId,
        module: module ?? "MISC",
        amount,
        description,
        chemicalPurchaseId,
        rexinePurchaseId,
        materialPurchaseId,
        laborAdvanceId,
      },
      include: { category: true, party: true, laborAdvance: { include: { labor: true } } },
    });

    return expense;
  });

  res.status(201).json(result);
};

export const updateExpense = async (req, res) => {
  const expense = await prisma.expenseEntry.update({
    where: { id: req.params.expenseId },
    data: {
      date: req.body.date ? new Date(req.body.date) : undefined,
      categoryId: req.body.categoryId,
      partyId: req.body.partyId,
      module: req.body.module,
      amount: req.body.amount,
      description: req.body.description,
    },
    include: { category: true, party: true, laborAdvance: { include: { labor: true } } },
  });
  res.json(expense);
};

export const deleteExpense = async (req, res) => {
  const expense = await prisma.expenseEntry.findUnique({
    where: { id: req.params.expenseId },
  });

  await prisma.$transaction(async (tx) => {
    if (expense?.chemicalPurchaseId) {
      await tx.chemicalPurchase.delete({ where: { id: expense.chemicalPurchaseId } });
    }
    if (expense?.rexinePurchaseId) {
      await tx.rexinePurchase.delete({ where: { id: expense.rexinePurchaseId } });
    }
    if (expense?.materialPurchaseId) {
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
