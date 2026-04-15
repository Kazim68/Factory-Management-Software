import prisma from "../prisma.js";
import {
  formatDateKey,
  formatMonthKey,
  getWeekStart,
  groupByPeriod,
  toDate,
  withDateRange,
} from "../utils/date.js";

const toDbPaymentType = (paymentType) => {
  const normalized = String(paymentType ?? "CASH").toUpperCase();
  if (["KHATA", "BANK", "CREDIT"].includes(normalized)) return "CREDIT";
  if (normalized === "CHEQUE") return "CHEQUE";
  return "CASH";
};

const isKhata = (paymentType) =>
  ["CREDIT", "KHATA"].includes(String(paymentType ?? "CASH").toUpperCase());

export const listExpenses = async (req, res) => {
  const start = toDate(req.query.start, "start");
  const end = toDate(req.query.end, "end");
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
    actorUsername,
    actorRole,
  } = req.body;

  const normalizedPaymentType = toDbPaymentType(
    req.body.paymentType ?? moduleData?.paymentType,
  );
  const chequeId =
    req.body.chequeId == null ? "" : String(req.body.chequeId).trim();
  const chequeNumber =
    req.body.chequeNumber == null
      ? null
      : String(req.body.chequeNumber).trim() || null;
  const chequeNotes =
    req.body.chequeNotes == null
      ? null
      : String(req.body.chequeNotes).trim() || null;

  const result = await prisma.$transaction(async (tx) => {
    let chemicalPurchaseId;
    let rexinePurchaseId;
    let materialPurchaseId;
    let laborAdvanceId;

    if (module === "CHEMICAL" && moduleData) {
      const purchase = await tx.chemicalPurchase.create({
        data: {
          date: toDate(moduleData.date ?? date, "start"),
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
          date: toDate(moduleData.date ?? date, "start"),
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
          date: toDate(moduleData.date ?? date, "start"),
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
          date: toDate(moduleData.date ?? date, "start"),
          amount: moduleData.amount ?? amount,
          reason: moduleData.reason ?? description,
        },
      });
      laborAdvanceId = advance.id;
    }

    const sourceSystem =
      actorUsername && actorRole
        ? `ROZNAMCHA_MANUAL|${String(actorUsername)}|${String(actorRole)}`
        : "ROZNAMCHA_MANUAL";

    const expense = await tx.expenseEntry.create({
      data: {
        date: toDate(date, "start"),
        partyId,
        laborId,
        module: module ?? "MISC",
        paymentType: normalizedPaymentType,
        amount,
        description,
        chemicalPurchaseId,
        rexinePurchaseId,
        materialPurchaseId,
        laborAdvanceId,
        source: "MANUAL",
        sourceSystem,
      },
      include: {
        party: true,
        labor: true,
        laborAdvance: { include: { labor: true } },
      },
    });

    if (normalizedPaymentType === "CHEQUE") {
      const normalizedAmount = Math.abs(Number(expense.amount ?? 0));
      if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
        throw new Error("Cheque amount must be greater than 0.");
      }

      const isInflow = Number(expense.amount ?? 0) < 0;
      if (isInflow) {
        await tx.cheque.create({
          data: {
            date: new Date(expense.date),
            amount: normalizedAmount,
            chequeNumber,
            notes: chequeNotes || description || null,
            sourcePartyId: partyId ?? null,
            status: "AVAILABLE",
          },
        });
      } else {
        if (!chequeId) {
          throw new Error("Please select an available cheque.");
        }

        const selectedCheque = await tx.cheque.findUnique({
          where: { id: chequeId },
        });
        if (!selectedCheque || selectedCheque.status !== "AVAILABLE") {
          throw new Error("Selected cheque is not available.");
        }

        const selectedAmount = Number(selectedCheque.amount ?? 0);
        if (Math.abs(selectedAmount - normalizedAmount) > 0.0001) {
          throw new Error("Expense amount must match selected cheque amount.");
        }

        await tx.cheque.update({
          where: { id: selectedCheque.id },
          data: {
            status: "USED",
            usedPartyId: partyId ?? null,
            notes: chequeNotes || selectedCheque.notes,
            chequeNumber: chequeNumber || selectedCheque.chequeNumber,
          },
        });
      }
    }

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
    res
      .status(403)
      .json({ error: "System entries cannot be edited from Roznamcha." });
    return;
  }

  const expense = await prisma.expenseEntry.update({
    where: { id: req.params.expenseId },
    data: {
      date: req.body.date ? toDate(req.body.date, "start") : undefined,
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
    res
      .status(403)
      .json({ error: "System entries cannot be deleted from Roznamcha." });
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (expense?.chemicalPurchaseId) {
      await tx.partyLedgerEntry.deleteMany({
        where: { chemicalPurchaseId: expense.chemicalPurchaseId },
      });
      await tx.chemicalPurchase.delete({
        where: { id: expense.chemicalPurchaseId },
      });
    }
    if (expense?.rexinePurchaseId) {
      await tx.partyLedgerEntry.deleteMany({
        where: { rexinePurchaseId: expense.rexinePurchaseId },
      });
      await tx.rexinePurchase.delete({
        where: { id: expense.rexinePurchaseId },
      });
    }
    if (expense?.materialPurchaseId) {
      await tx.partyLedgerEntry.deleteMany({
        where: { materialPurchaseId: expense.materialPurchaseId },
      });
      await tx.materialPurchase.delete({
        where: { id: expense.materialPurchaseId },
      });
    }
    if (expense?.laborAdvanceId) {
      await tx.laborAdvance.delete({ where: { id: expense.laborAdvanceId } });
    }
    await tx.expenseEntry.delete({ where: { id: req.params.expenseId } });
  });

  res.status(204).end();
};

export const getDailySummary = async (req, res) => {
  const start = toDate(req.query.start, "start");
  const end = toDate(req.query.end, "end");
  const expenses = await prisma.expenseEntry.findMany({
    where: { date: withDateRange(start, end) },
    orderBy: { date: "asc" },
  });

  const grouped = groupByPeriod(expenses, (expense) =>
    formatDateKey(expense.date),
  );
  res.json(Object.values(grouped));
};

export const getWeeklySummary = async (req, res) => {
  const start = toDate(req.query.start, "start");
  const end = toDate(req.query.end, "end");
  const expenses = await prisma.expenseEntry.findMany({
    where: { date: withDateRange(start, end) },
    orderBy: { date: "asc" },
  });

  const grouped = groupByPeriod(expenses, (expense) => {
    return formatDateKey(getWeekStart(expense.date));
  });

  res.json(Object.values(grouped));
};

export const getMonthlySummary = async (req, res) => {
  const start = toDate(req.query.start, "start");
  const end = toDate(req.query.end, "end");
  const expenses = await prisma.expenseEntry.findMany({
    where: { date: withDateRange(start, end) },
    orderBy: { date: "asc" },
  });

  const grouped = groupByPeriod(expenses, (expense) =>
    formatMonthKey(expense.date),
  );

  res.json(Object.values(grouped));
};
