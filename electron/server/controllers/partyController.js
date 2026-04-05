import prisma from "../prisma.js";
import { toDate, withDateRange } from "../utils/date.js";
import { createSystemRoznamchaEntry } from "../utils/roznamcha.js";

export const listParties = async (req, res) => {
  const typeFilter = String(req.query.type ?? "")
    .trim()
    .toUpperCase();
  const where =
    typeFilter === "CUSTOMER" || typeFilter === "SUPPLIER"
      ? { type: typeFilter }
      : undefined;
  const parties = await prisma.party.findMany({
    where,
    orderBy: { name: "asc" },
  });
  res.json(parties);
};

const isCashLikeLedgerEntry = (entry) => {
  const reference = String(entry.reference ?? "").toLowerCase();
  const description = String(entry.description ?? "").toLowerCase();
  return reference.includes("cash") || description.includes("cash");
};

const normalizePartyType = (value) => {
  const type = String(value ?? "")
    .trim()
    .toUpperCase();
  if (type === "CUSTOMER" || type === "SUPPLIER") {
    return type;
  }
  return null;
};

export const listSupplierPendingDues = async (req, res) => {
  const asOfDate = toDate(req.query.asOf);
  const end = asOfDate ?? new Date();

  const [suppliers, ledgerEntries] = await Promise.all([
    prisma.party.findMany({
      where: {
        type: "SUPPLIER",
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        type: true,
      },
    }),
    prisma.partyLedgerEntry.findMany({
      where: {
        date: {
          lte: end,
        },
      },
      select: {
        partyId: true,
        reference: true,
        description: true,
        balance: true,
      },
    }),
  ]);

  const supplierMap = suppliers.reduce((acc, supplier) => {
    acc[supplier.id] = supplier;
    return acc;
  }, {});

  const runningBalanceByParty = {};
  for (const entry of ledgerEntries) {
    if (!supplierMap[entry.partyId]) continue;
    if (isCashLikeLedgerEntry(entry)) continue;
    const current = Number(runningBalanceByParty[entry.partyId] ?? 0);
    runningBalanceByParty[entry.partyId] = current + Number(entry.balance ?? 0);
  }

  const pending = suppliers
    .map((supplier) => {
      const balance = Number(runningBalanceByParty[supplier.id] ?? 0);
      const remainingDue = balance < 0 ? Math.abs(balance) : 0;
      return {
        partyId: supplier.id,
        partyName: supplier.name,
        partyType: supplier.type,
        netBalance: balance,
        remainingDue,
      };
    })
    .filter((row) => row.remainingDue > 0)
    .sort((a, b) => b.remainingDue - a.remainingDue);

  res.json({
    asOf: end.toISOString(),
    totalPending: pending.reduce((sum, row) => sum + row.remainingDue, 0),
    pending,
  });
};

export const createParty = async (req, res) => {
  const type = normalizePartyType(req.body.type);
  if (!type) {
    res.status(400).json({ error: "Party type must be CUSTOMER or SUPPLIER." });
    return;
  }

  const party = await prisma.party.create({
    data: {
      name: req.body.name,
      type,
      // Balance is derived from ledger entries; keep opening balance neutral.
      openingBalance: 0,
    },
  });
  res.status(201).json(party);
};

export const updateParty = async (req, res) => {
  const type =
    req.body.type === undefined ? undefined : normalizePartyType(req.body.type);
  if (req.body.type !== undefined && !type) {
    res.status(400).json({ error: "Party type must be CUSTOMER or SUPPLIER." });
    return;
  }

  const party = await prisma.party.update({
    where: { id: req.params.partyId },
    data: {
      name: req.body.name,
      type,
    },
  });
  res.json(party);
};

export const deleteParty = async (req, res) => {
  await prisma.party.delete({ where: { id: req.params.partyId } });
  res.status(204).end();
};

export const getPartyLedger = async (req, res) => {
  const start = toDate(req.query.start);
  const end = toDate(req.query.end);
  const [ledger, payments, chemicalCash, rexineCash, materialCash] =
    await Promise.all([
      prisma.partyLedgerEntry.findMany({
        where: {
          partyId: req.params.partyId,
          date: withDateRange(start, end),
        },
        orderBy: { date: "asc" },
      }),
      prisma.partyPayment.findMany({
        where: {
          partyId: req.params.partyId,
          date: withDateRange(start, end),
        },
        orderBy: { date: "asc" },
      }),
      prisma.chemicalPurchase.findMany({
        where: {
          partyId: req.params.partyId,
          date: withDateRange(start, end),
          paymentType: "CASH",
        },
        include: { expenses: true },
        orderBy: { date: "asc" },
      }),
      prisma.rexinePurchase.findMany({
        where: {
          partyId: req.params.partyId,
          date: withDateRange(start, end),
          paymentType: "CASH",
        },
        include: { expenses: true },
        orderBy: { date: "asc" },
      }),
      prisma.materialPurchase.findMany({
        where: {
          partyId: req.params.partyId,
          date: withDateRange(start, end),
          paymentType: "CASH",
        },
        include: { expenses: true },
        orderBy: { date: "asc" },
      }),
    ]);

  const cashPayments = payments.filter(
    (payment) => String(payment.method ?? "CASH").toUpperCase() === "CASH",
  );

  const makeKey = (entry) => {
    const amount = Number(entry.amount ?? entry.balance ?? 0);
    const reference = entry.reference ?? "";
    const description = entry.description ?? "";
    const date =
      entry.date instanceof Date ? entry.date.toISOString() : `${entry.date}`;
    return `${entry.partyId}|${date}|${amount}|${reference}|${description}`;
  };

  const cashKeys = new Set(cashPayments.map((payment) => makeKey(payment)));

  const filteredLedger = ledger.filter(
    (entry) => !cashKeys.has(makeKey(entry)),
  );

  const cashEntries = cashPayments.map((payment) => ({
    id: `cash-${payment.id}`,
    partyId: payment.partyId,
    date: payment.date,
    reference: payment.reference ?? "Cash Payment",
    description: payment.description ?? "Cash payment",
    balance: 0,
    payable: 0,
    receivable: 0,
    cash: payment.amount,
    createdAt: payment.createdAt,
    isCash: true,
  }));

  const purchaseCashEntries = [
    ...chemicalCash.map((purchase) => ({
      id: `cash-chemical-${purchase.id}`,
      partyId: purchase.partyId,
      date: purchase.date,
      reference: "Chemical Purchase",
      description: purchase.expenses?.[0]?.description ?? "Cash purchase",
      balance: 0,
      payable: 0,
      receivable: 0,
      cash: purchase.totalAmount,
      createdAt: purchase.createdAt,
      isCash: true,
    })),
    ...rexineCash.map((purchase) => ({
      id: `cash-rexine-${purchase.id}`,
      partyId: purchase.partyId,
      date: purchase.date,
      reference: "Rexine Purchase",
      description: purchase.expenses?.[0]?.description ?? "Cash purchase",
      balance: 0,
      payable: 0,
      receivable: 0,
      cash: purchase.totalAmount,
      createdAt: purchase.createdAt,
      isCash: true,
    })),
    ...materialCash.map((purchase) => ({
      id: `cash-material-${purchase.id}`,
      partyId: purchase.partyId,
      date: purchase.date,
      reference: "Material Purchase",
      description: purchase.expenses?.[0]?.description ?? "Cash purchase",
      balance: 0,
      payable: 0,
      receivable: 0,
      cash: purchase.totalAmount,
      createdAt: purchase.createdAt,
      isCash: true,
    })),
  ];

  const normalizedLedger = filteredLedger.map((entry) => {
    const reference = entry.reference ?? "";
    const description = entry.description ?? "";
    const isCash =
      reference.toLowerCase().includes("cash") ||
      description.toLowerCase().includes("cash");
    const balance = Number(entry.balance ?? 0);
    const receivable = balance > 0 ? balance : 0;
    const payable = balance < 0 ? Math.abs(balance) : 0;
    const mapped = {
      ...entry,
      balance,
      payable,
      receivable,
    };
    return isCash
      ? { ...mapped, cash: Math.abs(balance), isCash: true }
      : mapped;
  });

  res.json(
    [...normalizedLedger, ...cashEntries, ...purchaseCashEntries].sort(
      (a, b) => {
        const dateDiff = b.date - a.date;
        if (dateDiff !== 0) return dateDiff;
        const aCreated = a.createdAt ?? a.date;
        const bCreated = b.createdAt ?? b.date;
        return bCreated - aCreated;
      },
    ),
  );
};

export const createPartyPayment = async (req, res) => {
  const rawMethod = (req.body.method ?? "CASH").toString().toUpperCase();
  const method =
    rawMethod === "KHATA" || rawMethod === "BANK"
      ? "CREDIT"
      : ["CASH", "CREDIT", "CHEQUE"].includes(rawMethod)
        ? rawMethod
        : "CASH";
  const isCash = method === "CASH";
  const direction = (req.body.direction ?? "PAY").toString().toUpperCase();
  const normalizedDirection =
    direction === "RECEIVE" || direction === "PAY" ? direction : "PAY";
  const amount = Math.abs(Number(req.body.amount ?? 0));
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: "Payment amount must be greater than 0." });
    return;
  }

  const chequeNumber =
    req.body.chequeNumber == null ? null : String(req.body.chequeNumber).trim();
  const chequeNotes =
    req.body.chequeNotes == null ? null : String(req.body.chequeNotes).trim();
  const reference =
    req.body.reference ??
    (method === "CHEQUE"
      ? "Cheque Settlement"
      : isCash
        ? "Cash Payment"
        : "Khata Settlement");
  const description =
    req.body.description ??
    (method === "CHEQUE"
      ? "Cheque settlement"
      : isCash
        ? "Cash payment"
        : "Khata settlement");

  const paymentDate = new Date(req.body.date);
  const payment = await prisma
    .$transaction(async (tx) => {
      const party = await tx.party.findUnique({
        where: { id: req.params.partyId },
      });
      if (!party) {
        throw new Error("Party not found.");
      }

      let selectedCheque = null;
      if (method === "CHEQUE" && normalizedDirection === "PAY") {
        const chequeId = String(req.body.chequeId ?? "").trim();
        if (!chequeId) {
          throw new Error("Please select an available cheque.");
        }
        if (party.type !== "SUPPLIER") {
          throw new Error(
            "Cheque payment is only allowed to supplier parties.",
          );
        }

        selectedCheque = await tx.cheque.findUnique({
          where: { id: chequeId },
        });
        if (!selectedCheque || selectedCheque.status !== "AVAILABLE") {
          throw new Error("Selected cheque is not available.");
        }

        const chequeAmount = Number(selectedCheque.amount ?? 0);
        if (Math.abs(chequeAmount - amount) > 0.0001) {
          throw new Error("Payment amount must match selected cheque amount.");
        }
      }

      const allocations = [];
      if (
        normalizedDirection === "RECEIVE" &&
        !req.body.billId &&
        !req.body.chemicalPurchaseId &&
        !req.body.rexinePurchaseId &&
        !req.body.materialPurchaseId
      ) {
        if (method === "CHEQUE") {
          throw new Error("Please select a bill when receiving by cheque.");
        }

        const bills = await tx.bill.findMany({
          where: {
            partyId: req.params.partyId,
            type: "CREDIT",
          },
          include: { payments: true },
          orderBy: { date: "asc" },
        });

        let remainingToAllocate = amount;
        for (const bill of bills) {
          if (remainingToAllocate <= 0) break;
          const total = Number(bill.total ?? 0);
          const totalPaid = (bill.payments ?? []).reduce(
            (sum, p) => sum + Number(p.amount ?? 0),
            0,
          );
          const remaining = Math.max(total - totalPaid, 0);
          if (remaining <= 0) continue;
          const applied = Math.min(remaining, remainingToAllocate);
          allocations.push({ amount: applied, billId: bill.id });
          remainingToAllocate -= applied;
        }

        if (remainingToAllocate > 0) {
          allocations.push({ amount: remainingToAllocate, billId: null });
        }
      } else {
        if (normalizedDirection === "RECEIVE" && req.body.billId) {
          const bill = await tx.bill.findUnique({
            where: { id: req.body.billId },
            include: { payments: true },
          });
          if (!bill || bill.partyId !== req.params.partyId) {
            throw new Error("Selected bill does not belong to this party.");
          }
          const total = Number(bill.total ?? 0);
          const totalPaid = (bill.payments ?? []).reduce(
            (sum, p) => sum + Number(p.amount ?? 0),
            0,
          );
          const remaining = Math.max(total - totalPaid, 0);
          if (remaining <= 0) {
            throw new Error("Selected bill is already fully paid.");
          }
          if (amount > remaining) {
            throw new Error("Payment exceeds selected bill remaining amount.");
          }
        }

        allocations.push({
          amount,
          billId: req.body.billId ?? null,
          chemicalPurchaseId: req.body.chemicalPurchaseId ?? null,
          rexinePurchaseId: req.body.rexinePurchaseId ?? null,
          materialPurchaseId: req.body.materialPurchaseId ?? null,
        });
      }

      const createdPayments = [];
      for (const allocation of allocations) {
        const created = await tx.partyPayment.create({
          data: {
            partyId: req.params.partyId,
            date: paymentDate,
            amount: allocation.amount,
            method,
            reference,
            description,
            billId: allocation.billId ?? null,
            chemicalPurchaseId: allocation.chemicalPurchaseId ?? null,
            rexinePurchaseId: allocation.rexinePurchaseId ?? null,
            materialPurchaseId: allocation.materialPurchaseId ?? null,
          },
        });
        createdPayments.push(created);
      }

      if (method === "CHEQUE") {
        if (!createdPayments.length) {
          throw new Error("Unable to create cheque payment.");
        }

        if (normalizedDirection === "PAY") {
          await tx.cheque.update({
            where: { id: selectedCheque.id },
            data: {
              status: "USED",
              usedPaymentId: createdPayments[0].id,
              usedPartyId: req.params.partyId,
              notes: chequeNotes || selectedCheque.notes,
              chequeNumber: chequeNumber || selectedCheque.chequeNumber,
            },
          });
        } else {
          await tx.cheque.create({
            data: {
              date: paymentDate,
              amount,
              chequeNumber: chequeNumber || null,
              notes: chequeNotes || description || null,
              sourcePartyId: req.params.partyId,
              sourcePaymentId: createdPayments[0].id,
              status: "AVAILABLE",
            },
          });
        }
      }

      if (!isCash) {
        const balance = normalizedDirection === "RECEIVE" ? -amount : amount;
        await tx.partyLedgerEntry.create({
          data: {
            partyId: req.params.partyId,
            date: paymentDate,
            reference,
            description,
            balance,
          },
        });
      }

      await createSystemRoznamchaEntry(tx, {
        date: paymentDate,
        amount: normalizedDirection === "RECEIVE" ? -amount : amount,
        description,
        partyId: req.params.partyId,
        paymentType: method,
        sourceSystem:
          normalizedDirection === "RECEIVE"
            ? "PARTY_PAYMENT_RECEIVED"
            : "PARTY_PAYMENT_PAID",
      });

      return createdPayments[0];
    })
    .catch((error) => {
      res
        .status(400)
        .json({ error: error.message ?? "Failed to record payment." });
      return null;
    });

  if (!payment) return;

  res.status(201).json(payment);
};
