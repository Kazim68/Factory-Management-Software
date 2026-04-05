import prisma from "../prisma.js";
import { createSystemRoznamchaEntry } from "../utils/roznamcha.js";

const BILL_COUNTER_ID = "default";
const MAX_BILL_NUMBER = 9999;

const formatBillNumber = (value) => String(value).padStart(4, "0");

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

const computeLineTotal = ({ quantity, price, discount }) => {
  const grossTotal = Number(quantity ?? 0) * Number(price ?? 0);
  const discountAmount = Number(discount ?? 0) * Number(quantity ?? 0);
  return Number((grossTotal - discountAmount).toFixed(2));
};

const toNumber = (value) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const normalizeSize = (value) => {
  const normalized = String(value ?? "").trim();
  return normalized || "-";
};

const getStockVariantKey = (articleId, size) =>
  `${articleId}::${normalizeSize(size)}`;

const MERGED_FINAL_DEPARTMENTS = ["MACHINEMAN", "PACKING"];

const getAvailableStockByVariant = async (tx) => {
  const [orders, stockEntries] = await Promise.all([
    tx.productionOrder.findMany({
      select: {
        department: true,
        articleId: true,
        size: true,
        quantityDozen: true,
        completedDozen: true,
        bMallDozen: true,
        cMallDozen: true,
      },
    }),
    tx.stockEntry.findMany({
      where: { mode: "PACKED" },
      select: {
        articleId: true,
        quantityDozen: true,
      },
    }),
  ]);

  const availableByVariant = new Map();

  for (const row of orders) {
    const completed = toNumber(row.completedDozen);

    if (!MERGED_FINAL_DEPARTMENTS.includes(row.department)) {
      continue;
    }

    const contribution = completed;
    if (contribution <= 0) continue;
    const variantKey = getStockVariantKey(row.articleId, row.size);
    availableByVariant.set(
      variantKey,
      (availableByVariant.get(variantKey) ?? 0) + contribution,
    );
  }

  for (const entry of stockEntries) {
    const contribution = toNumber(entry.quantityDozen);
    if (contribution <= 0) continue;
    const variantKey = getStockVariantKey(entry.articleId, "-");
    availableByVariant.set(
      variantKey,
      (availableByVariant.get(variantKey) ?? 0) + contribution,
    );
  }

  return availableByVariant;
};

const assertSufficientStockForBillLines = async (tx, lines) => {
  const requestedByVariant = lines.reduce((acc, line) => {
    const variantKey = getStockVariantKey(line.articleId, line.size);
    acc[variantKey] = (acc[variantKey] ?? 0) + toNumber(line.quantity);
    return acc;
  }, {});

  const availableByVariant = await getAvailableStockByVariant(tx);

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

  const nextNumber =
    Number(counter.lastNumber ?? 0) >= MAX_BILL_NUMBER
      ? 1
      : Number(counter.lastNumber ?? 0) + 1;

  await tx.billNumberCounter.update({
    where: { id: BILL_COUNTER_ID },
    data: { lastNumber: nextNumber },
  });

  return formatBillNumber(nextNumber);
};

const toApiBill = (bill) => {
  if (!bill) return bill;
  const total = Number(bill.total ?? 0);
  const totalPaid = Number(
    (bill.payments ?? []).reduce(
      (sum, payment) => sum + Number(payment.amount ?? 0),
      0,
    ),
  );
  const remaining = Math.max(total - totalPaid, 0);
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
      await tx.partyLedgerEntry.delete({ where: { id: existing.id } });
    }
    return;
  }

  const payload = {
    partyId: bill.partyId,
    billId: bill.id,
    date: bill.date,
    reference: bill.billNumber,
    description: "Receivable bill",
    balance: Number(bill.total ?? 0),
  };

  if (existing) {
    await tx.partyLedgerEntry.update({
      where: { id: existing.id },
      data: payload,
    });
  } else {
    await tx.partyLedgerEntry.create({ data: payload });
  }
};

export const listBills = async (req, res) => {
  const bills = await prisma.bill.findMany({
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
  const bill = await prisma.$transaction(async (tx) => {
    await assertSufficientStockForBillLines(tx, normalizedLines);
    const billNumber = await reserveNextBillNumber(tx);
    return tx.bill.create({
      data: {
        billNumber,
        date: new Date(date),
        partyId,
        type: toDbBillType(type) ?? "CASH",
        status: status ?? "DRAFT",
        total: normalizedLines.reduce(
          (sum, line) => sum + Number(line.total),
          0,
        ),
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
    return getBillSummary(tx, updated.id);
  });

  res.json(bill);
};

export const updateBill = async (req, res) => {
  const { date, partyId, type, status, lines } = req.body;
  const normalizedLines = Array.isArray(lines)
    ? normalizeBillLines(lines)
    : null;
  const bill = await prisma.$transaction(async (tx) => {
    if (normalizedLines) {
      await assertSufficientStockForBillLines(tx, normalizedLines);
    }

    const updated = await tx.bill.update({
      where: { id: req.params.billId },
      data: {
        date: date ? new Date(date) : undefined,
        partyId,
        type: toDbBillType(type),
        status,
        total: normalizedLines
          ? normalizedLines.reduce((sum, line) => sum + Number(line.total), 0)
          : undefined,
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
      payments: { orderBy: { date: "asc" } },
      ledgerEntries: { orderBy: { date: "asc" } },
    },
  });
  if (!bill) {
    res.status(404).json({ error: "Bill not found" });
    return;
  }

  const openingEntry = {
    id: `bill-${bill.id}`,
    date: bill.date,
    reference: bill.billNumber,
    description: "Bill Raised",
    amount: Number(bill.total),
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
        include: { payments: true },
      });
      if (!bill) {
        throw new Error("Bill not found");
      }
      if (!bill.partyId) {
        throw new Error("Bill has no linked party.");
      }

      const total = Number(bill.total ?? 0);
      const totalPaid = bill.payments.reduce(
        (sum, payment) => sum + Number(payment.amount ?? 0),
        0,
      );
      const remaining = Math.max(total - totalPaid, 0);
      const method = toDbPaymentMethod(req.body.method ?? "KHATA");
      if (remaining <= 0) {
        throw new Error("Bill is already fully paid.");
      }
      if (amount > remaining && method !== "CHEQUE") {
        throw new Error("Payment exceeds remaining amount.");
      }

      const paymentDate = req.body.date ? new Date(req.body.date) : new Date();
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
        include: { payments: true },
      });
      if (!found) throw new Error("Bill not found");

      const total = Number(found.total ?? 0);
      const totalPaid = found.payments.reduce(
        (sum, payment) => sum + Number(payment.amount ?? 0),
        0,
      );
      const remaining = Math.max(total - totalPaid, 0);
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
      const paymentCount = await tx.partyPayment.count({
        where: { billId: req.params.billId },
      });
      if (paymentCount > 0) {
        throw new Error("Cannot delete bill with existing payments.");
      }

      await tx.partyLedgerEntry.deleteMany({
        where: { billId: req.params.billId },
      });
      await tx.billLine.deleteMany({ where: { billId: req.params.billId } });
      await tx.bill.delete({ where: { id: req.params.billId } });
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
