import prisma from "../prisma.js";
import { createSystemRoznamchaEntry } from "../utils/roznamcha.js";
import { toDate } from "../utils/date.js";
import {
  getPackedStockSnapshot,
  getStockVariantKey,
  toNumber,
} from "../services/stockService.js";
import { resolveDeletedWhere } from "../utils/softDelete.js";

const BILL_COUNTER_ID = "default";
const MAX_BILL_NUMBER = 9999;
const PAIRS_PER_DOZEN = 12;

const formatBillNumber = (value) => String(value).padStart(4, "0");

const getMaxStoredBillNumber = async (tx) => {
  const [row] = await tx.$queryRawUnsafe(`
    SELECT COALESCE(MAX(CAST("billNumber" AS INTEGER)), 0) AS lastNumber
    FROM "Bill"
    WHERE "billNumber" GLOB '[0-9][0-9][0-9][0-9]'
      AND CAST("billNumber" AS INTEGER) BETWEEN 0 AND 9999
  `);

  return Number(row?.lastNumber ?? 0);
};

const toDbBillType = (type) => {
  const normalized = String(type ?? "CASH").toUpperCase();
  if (normalized === "RECEIVABLE" || normalized === "KHATA") return "CREDIT";
  return "CASH";
};
const toDbPaymentMethod = (method) => {
  const normalized = String(method ?? "KHATA").toUpperCase();
  if (normalized === "KHATA") return "CREDIT";
  if (["CASH", "CREDIT", "BANK", "CHEQUE"].includes(normalized))
    return normalized;
  return "CREDIT";
};

const computePaymentStatus = (total, totalPaid) => {
  const remaining = Math.max(total - totalPaid, 0);
  if (remaining === 0) return "PAID";
  if (totalPaid > 0) return "PARTIAL_PAID";
  return "UNPAID";
};

const roundMoney = (value) => Number(Number(value ?? 0).toFixed(2));

const computeLineTotal = ({ quantity, price, discount }) => {
  const grossTotal =
    Number(quantity ?? 0) * PAIRS_PER_DOZEN * Number(price ?? 0);
  const discountAmount =
    Number(discount ?? 0) * Number(quantity ?? 0) * PAIRS_PER_DOZEN;
  return roundMoney(grossTotal - discountAmount);
};

const computeBillTotalFromLines = (lines = []) =>
  roundMoney(
    lines.reduce((sum, line) => sum + computeLineTotal(line), 0),
  );

const resolveBillTotal = (bill) => {
  if (Array.isArray(bill?.lines) && bill.lines.length > 0) {
    return computeBillTotalFromLines(bill.lines);
  }
  return roundMoney(Number(bill?.total ?? 0));
};

const getAvailableStockByVariant = async (tx, options = {}) => {
  const { packedRows } = await getPackedStockSnapshot(tx, options);
  return packedRows.reduce((acc, row) => {
    acc.set(
      getStockVariantKey(row.articleId, row.size),
      (acc.get(getStockVariantKey(row.articleId, row.size)) ?? 0) +
        toNumber(row.quantityDozen),
    );
    return acc;
  }, new Map());
};

const assertSufficientStockForBillLines = async (
  tx,
  lines,
  options = {},
) => {
  const requestedByVariant = lines.reduce((acc, line) => {
    const variantKey = getStockVariantKey(line.articleId, line.size);
    acc[variantKey] = (acc[variantKey] ?? 0) + toNumber(line.quantity);
    return acc;
  }, {});

  const availableByVariant = await getAvailableStockByVariant(tx, options);

  for (const [variantKey, requestedQty] of Object.entries(requestedByVariant)) {
    const [articleId] = variantKey.split("::");
    const availableQty = toNumber(availableByVariant.get(variantKey) ?? 0);
    if (requestedQty > availableQty) {
      const article = await tx.article.findUnique({
        where: { id: articleId },
        select: { name: true },
      });
      const articleName = article?.name || "Selected article";
      const size = variantKey.slice(variantKey.indexOf("::") + 2) || "-";
      const error = new Error(
        `${articleName} (${size}) has only ${availableQty} dozen available in packed stock.`,
      );
      error.statusCode = 400;
      throw error;
    }
  }
};

const normalizeBillLines = (lines) => {
  if (!Array.isArray(lines) || lines.length === 0) {
    const error = new Error("At least one bill line is required.");
    error.statusCode = 400;
    throw error;
  }

  return lines.map((line, index) => {
    const quantity = Number(line.quantity ?? 0);
    const price = Number(line.price ?? 0);
    const discount = Number(line.discount ?? 0);

    if (!line.articleId) {
      const error = new Error(`Article is required for line ${index + 1}.`);
      error.statusCode = 400;
      throw error;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      const error = new Error(
        `Quantity must be greater than 0 on line ${index + 1}.`,
      );
      error.statusCode = 400;
      throw error;
    }

    if (!Number.isFinite(price) || price <= 0) {
      const error = new Error(
        `Price must be greater than 0 on line ${index + 1}.`,
      );
      error.statusCode = 400;
      throw error;
    }

    if (!Number.isFinite(discount) || discount < 0 || discount > price) {
      const error = new Error(
        `Discount must be between 0 and price on line ${index + 1}.`,
      );
      error.statusCode = 400;
      throw error;
    }

    return {
      articleId: line.articleId,
      size: line.size ?? null,
      quantity,
      price,
      discount,
      total: computeLineTotal({ quantity, price, discount }),
    };
  });
};

const reserveNextBillNumber = async (tx) => {
  const counter = await tx.billNumberCounter.upsert({
    where: { id: BILL_COUNTER_ID },
    update: {},
    create: { id: BILL_COUNTER_ID, lastNumber: 0 },
  });

  const maxStoredBillNumber = await getMaxStoredBillNumber(tx);
  const currentNumber = Math.max(
    Number(counter.lastNumber ?? 0),
    maxStoredBillNumber,
  );
  const nextNumber =
    currentNumber >= MAX_BILL_NUMBER ? 1 : currentNumber + 1;

  await tx.billNumberCounter.update({
    where: { id: BILL_COUNTER_ID },
    data: { lastNumber: nextNumber },
  });

  return formatBillNumber(nextNumber);
};

const getBillRoznamchaSourceSystem = (billId) => `BILL_SALE|${billId}`;

const toApiBill = (bill) => {
  if (!bill) return bill;
  const total = resolveBillTotal(bill);
  const totalPaid = roundMoney(
    (bill.payments ?? []).reduce(
      (sum, payment) => sum + Number(payment.amount ?? 0),
      0,
    ),
  );
  const remaining = roundMoney(Math.max(total - totalPaid, 0));
  return {
    ...bill,
    type: bill.type === "CREDIT" ? "RECEIVABLE" : bill.type,
    totalPaid,
    remaining,
    paymentStatus: computePaymentStatus(total, totalPaid),
    isVerified: Boolean(bill.verifiedAt),
  };
};

const getBillSummary = async (tx, billId) => {
  const bill = await tx.bill.findUnique({
    where: { id: billId },
    include: {
      lines: { include: { article: true } },
      party: true,
      payments: true,
    },
  });
  return toApiBill(bill);
};

const syncBillLedgerEntry = async (tx, bill) => {
  if (!bill) return;
  const existing = await tx.partyLedgerEntry.findFirst({
    where: { billId: bill.id, description: "Receivable bill" },
  });

  const shouldHaveLedger = bill.type === "CREDIT" && Boolean(bill.partyId);
  if (!shouldHaveLedger) {
    if (existing) {
      await tx.partyLedgerEntry.update({
        where: { id: existing.id },
        data: { deletedAt: new Date() },
      });
    }
    return;
  }

  const payload = {
    partyId: bill.partyId,
    billId: bill.id,
    date: bill.date,
    reference: bill.billNumber,
    description: "Receivable bill",
    balance: resolveBillTotal(bill),
  };

  if (existing) {
    await tx.partyLedgerEntry.update({
      where: { id: existing.id },
      data: { ...payload, deletedAt: null },
    });
  } else {
    await tx.partyLedgerEntry.create({ data: payload });
  }
};

const syncBillRoznamchaEntry = async (tx, bill) => {
  if (!bill?.id) return;

  const sourceSystem = getBillRoznamchaSourceSystem(bill.id);
  const existing = await tx.expenseEntry.findFirst({
    where: { sourceSystem, deletedAt: null },
  });
  if (existing) {
    await tx.expenseEntry.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });
  }
};

export const listBills = async (req, res) => {
  const bills = await prisma.bill.findMany({
    where: resolveDeletedWhere(req.query.deleted),
    include: {
      lines: { include: { article: true } },
      party: true,
      payments: true,
    },
    orderBy: { date: "desc" },
  });
  res.json(bills.map(toApiBill));
};

export const createBill = async (req, res) => {
  const { date, partyId, type, status, lines } = req.body;
  const normalizedLines = normalizeBillLines(lines);
  const billTotal = computeBillTotalFromLines(normalizedLines);
  const bill = await prisma.$transaction(async (tx) => {
    await assertSufficientStockForBillLines(tx, normalizedLines);
    const billNumber = await reserveNextBillNumber(tx);
    const created = await tx.bill.create({
      data: {
        billNumber,
        date: toDate(date, "start"),
        partyId,
        type: toDbBillType(type) ?? "CASH",
        status: status ?? "DRAFT",
        total: billTotal,
        verifiedAt: null,
        lines: {
          create: normalizedLines.map((line) => ({
            articleId: line.articleId,
            size: line.size,
            quantity: line.quantity,
            price: line.price,
            discount: line.discount,
            total: line.total,
          })),
        },
      },
      include: { lines: true, payments: true },
    });
    await syncBillLedgerEntry(tx, created);
    await syncBillRoznamchaEntry(tx, created);
    return created;
  });

  res.status(201).json(toApiBill(bill));
};

export const confirmBill = async (req, res) => {
  const bill = await prisma.$transaction(async (tx) => {
    const updated = await tx.bill.update({
      where: { id: req.params.billId },
      data: { status: "CONFIRMED" },
    });
    await syncBillLedgerEntry(tx, updated);
    await syncBillRoznamchaEntry(tx, updated);
    return getBillSummary(tx, updated.id);
  });

  res.json(bill);
};

export const updateBill = async (req, res) => {
  const { date, partyId, type, status, lines } = req.body;
  const normalizedLines = Array.isArray(lines)
    ? normalizeBillLines(lines)
    : null;
  const nextBillTotal = normalizedLines
    ? computeBillTotalFromLines(normalizedLines)
    : undefined;
  const bill = await prisma.$transaction(async (tx) => {
    if (normalizedLines) {
      await assertSufficientStockForBillLines(tx, normalizedLines, {
        excludeBillId: req.params.billId,
      });
    }

    const updated = await tx.bill.update({
      where: { id: req.params.billId },
      data: {
        date: date ? toDate(date, "start") : undefined,
        partyId,
        type: toDbBillType(type),
        status,
        total: nextBillTotal,
      },
    });

    if (normalizedLines) {
      await tx.billLine.deleteMany({ where: { billId: updated.id } });
      await tx.billLine.createMany({
        data: normalizedLines.map((line) => ({
          billId: updated.id,
          articleId: line.articleId,
          size: line.size,
          quantity: line.quantity,
          price: line.price,
          discount: line.discount,
          total: line.total,
        })),
      });
    }

    await syncBillLedgerEntry(tx, updated);
    await syncBillRoznamchaEntry(tx, updated);

    const hasPayments = await tx.partyPayment.count({
      where: { billId: updated.id },
    });
    if (hasPayments > 0) {
      await tx.bill.update({
        where: { id: updated.id },
        data: { verifiedAt: null },
      });
    }

    return tx.bill.findUnique({
      where: { id: updated.id },
      include: {
        lines: { include: { article: true } },
        party: true,
        payments: true,
      },
    });
  });

  res.json(toApiBill(bill));
};

export const getBillLedger = async (req, res) => {
  const bill = await prisma.bill.findUnique({
    where: { id: req.params.billId },
    include: {
      lines: true,
      payments: { orderBy: { date: "asc" } },
      ledgerEntries: { orderBy: { date: "asc" } },
    },
  });
  if (!bill) {
    res.status(404).json({ error: "Bill not found" });
    return;
  }

  const total = resolveBillTotal(bill);
  const openingEntry = {
    id: `bill-${bill.id}`,
    date: bill.date,
    reference: bill.billNumber,
    description: "Bill Raised",
    amount: total,
    kind: "RECEIVABLE",
  };

  const paymentEntries = bill.payments.map((payment) => ({
    id: `payment-${payment.id}`,
    date: payment.date,
    reference: payment.reference ?? bill.billNumber,
    description: payment.description ?? "Payment received",
    amount: Number(payment.amount),
    kind: "PAYMENT",
    method: payment.method === "CREDIT" ? "KHATA" : payment.method,
  }));

  res.json([openingEntry, ...paymentEntries].sort((a, b) => b.date - a.date));
};

export const receiveBillPayment = async (req, res) => {
  const amount = Math.abs(Number(req.body.amount ?? 0));
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: "Payment amount must be greater than 0." });
    return;
  }

  const response = await prisma
    .$transaction(async (tx) => {
      const bill = await tx.bill.findUnique({
        where: { id: req.params.billId },
        include: { payments: true, lines: true },
      });
      if (!bill || bill.deletedAt) {
        throw new Error("Bill not found");
      }
      if (!bill.partyId) {
        throw new Error("Bill has no linked party.");
      }

      const total = resolveBillTotal(bill);
      const totalPaid = bill.payments.reduce(
        (sum, payment) => sum + Number(payment.amount ?? 0),
        0,
      );
      const remaining = roundMoney(Math.max(total - totalPaid, 0));
      const method = toDbPaymentMethod(req.body.method ?? "KHATA");
      if (remaining <= 0) {
        throw new Error("Bill is already fully paid.");
      }
      if (amount > remaining && method !== "CHEQUE") {
        throw new Error("Payment exceeds remaining amount.");
      }

      const paymentDate = req.body.date
        ? toDate(req.body.date, "start")
        : new Date();
      const chequeNumber =
        req.body.chequeNumber == null
          ? null
          : String(req.body.chequeNumber).trim();
      const chequeNotes =
        req.body.chequeNotes == null
          ? null
          : String(req.body.chequeNotes).trim();

      const payment = await tx.partyPayment.create({
        data: {
          partyId: bill.partyId,
          billId: bill.id,
          date: paymentDate,
          amount,
          method,
          reference: req.body.reference ?? bill.billNumber,
          description: req.body.description ?? "Bill payment received",
        },
      });

      if (method === "CHEQUE") {
        await tx.cheque.create({
          data: {
            date: paymentDate,
            amount,
            chequeNumber: chequeNumber || null,
            notes: chequeNotes || req.body.description || null,
            sourcePartyId: bill.partyId,
            sourcePaymentId: payment.id,
            status: "AVAILABLE",
          },
        });
      }

      await tx.partyLedgerEntry.create({
        data: {
          partyId: bill.partyId,
          billId: bill.id,
          date: paymentDate,
          reference: bill.billNumber,
          description: "Bill payment received",
          balance: -amount,
        },
      });

      await createSystemRoznamchaEntry(tx, {
        date: paymentDate,
        amount: -amount,
        description:
          method === "CHEQUE"
            ? `Cheque received against bill ${bill.billNumber}`
            : `Cash received against bill ${bill.billNumber}`,
        partyId: bill.partyId,
        sourceSystem: "BILL_PAYMENT_RECEIVED",
        paymentType: method,
      });

      await tx.bill.update({
        where: { id: bill.id },
        data: { verifiedAt: null },
      });

      return {
        payment: {
          ...payment,
          method: payment.method === "CREDIT" ? "KHATA" : payment.method,
        },
        bill: await getBillSummary(tx, bill.id),
      };
    })
    .catch((error) => {
      res
        .status(400)
        .json({ error: error.message ?? "Failed to receive payment." });
      return null;
    });

  if (!response) return;
  res.status(201).json(response);
};

export const verifyBill = async (req, res) => {
  const bill = await prisma
    .$transaction(async (tx) => {
      const found = await tx.bill.findUnique({
        where: { id: req.params.billId },
        include: { payments: true, lines: true },
      });
      if (!found || found.deletedAt) throw new Error("Bill not found");

      const total = resolveBillTotal(found);
      const totalPaid = found.payments.reduce(
        (sum, payment) => sum + Number(payment.amount ?? 0),
        0,
      );
      const remaining = roundMoney(Math.max(total - totalPaid, 0));
      if (remaining > 0) {
        throw new Error("Bill cannot be verified until remaining amount is 0.");
      }

      await tx.bill.update({
        where: { id: found.id },
        data: { verifiedAt: new Date() },
      });

      return getBillSummary(tx, found.id);
    })
    .catch((error) => {
      res
        .status(400)
        .json({ error: error.message ?? "Failed to verify bill." });
      return null;
    });

  if (!bill) return;
  res.json(bill);
};

export const deleteBill = async (req, res) => {
  await prisma
    .$transaction(async (tx) => {
      const deletedAt = new Date();
      const paymentCount = await tx.partyPayment.count({
        where: { billId: req.params.billId },
      });
      if (paymentCount > 0) {
        throw new Error("Cannot delete bill with existing payments.");
      }

      await tx.partyLedgerEntry.updateMany({
        where: { billId: req.params.billId, deletedAt: null },
        data: { deletedAt },
      });
      await tx.expenseEntry.updateMany({
        where: {
          sourceSystem: getBillRoznamchaSourceSystem(req.params.billId),
          deletedAt: null,
        },
        data: { deletedAt },
      });
      await tx.billLine.updateMany({
        where: { billId: req.params.billId, deletedAt: null },
        data: { deletedAt },
      });
      await tx.bill.update({
        where: { id: req.params.billId },
        data: { deletedAt },
      });
    })
    .catch((error) => {
      res
        .status(400)
        .json({ error: error.message ?? "Failed to delete bill." });
      return null;
    });
  if (res.headersSent) return;
  res.status(204).end();
};

export const restoreBill = async (req, res) => {
  const bill = await prisma.$transaction(async (tx) => {
    await tx.bill.update({
      where: { id: req.params.billId },
      data: { deletedAt: null },
    });
    await tx.billLine.updateMany({
      where: { billId: req.params.billId },
      data: { deletedAt: null },
    });
    await tx.partyLedgerEntry.updateMany({
      where: { billId: req.params.billId },
      data: { deletedAt: null },
    });
    await tx.expenseEntry.updateMany({
      where: { sourceSystem: getBillRoznamchaSourceSystem(req.params.billId) },
      data: { deletedAt: null },
    });
    return getBillSummary(tx, req.params.billId);
  });

  res.json(bill);
};
