import prisma from "../prisma.js";
import { createSystemRoznamchaEntry } from "../utils/roznamcha.js";

const buildBillNumber = () => `BILL-${Date.now()}`;
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
  const bill = await prisma.bill.create({
    data: {
      billNumber: buildBillNumber(),
      date: new Date(date),
      partyId,
      type: toDbBillType(type) ?? "CASH",
      status: status ?? "DRAFT",
      total: lines.reduce((sum, line) => sum + Number(line.total), 0),
      verifiedAt: null,
      lines: {
        create: lines.map((line) => ({
          articleId: line.articleId,
          size: line.size ?? null,
          quantity: line.quantity,
          price: line.price,
          total: line.total,
        })),
      },
    },
    include: { lines: true, payments: true },
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
  const bill = await prisma.$transaction(async (tx) => {
    const updated = await tx.bill.update({
      where: { id: req.params.billId },
      data: {
        date: date ? new Date(date) : undefined,
        partyId,
        type: toDbBillType(type),
        status,
        total: lines
          ? lines.reduce((sum, line) => sum + Number(line.total), 0)
          : undefined,
      },
    });

    if (Array.isArray(lines)) {
      await tx.billLine.deleteMany({ where: { billId: updated.id } });
      await tx.billLine.createMany({
        data: lines.map((line) => ({
          billId: updated.id,
          articleId: line.articleId,
          size: line.size ?? null,
          quantity: line.quantity,
          price: line.price,
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
      if (remaining <= 0) {
        throw new Error("Bill is already fully paid.");
      }
      if (amount > remaining) {
        throw new Error("Payment exceeds remaining amount.");
      }

      const method = toDbPaymentMethod(req.body.method ?? "KHATA");
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
