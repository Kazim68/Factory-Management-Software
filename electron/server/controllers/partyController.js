import prisma from "../prisma.js";
import { toDate, withDateRange } from "../utils/date.js";
import { createSystemRoznamchaEntry } from "../utils/roznamcha.js";

export const listParties = async (req, res) => {
  const parties = await prisma.party.findMany({ orderBy: { name: "asc" } });
  res.json(parties);
};

export const createParty = async (req, res) => {
  const party = await prisma.party.create({
    data: {
      name: req.body.name,
      type: req.body.type,
      // Balance is derived from ledger entries; keep opening balance neutral.
      openingBalance: 0,
    },
  });
  res.status(201).json(party);
};

export const updateParty = async (req, res) => {
  const party = await prisma.party.update({
    where: { id: req.params.partyId },
    data: {
      name: req.body.name,
      type: req.body.type,
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
    (payment) =>
      String(payment.method ?? "CASH").toUpperCase() === "CASH"
  );

  const makeKey = (entry) => {
    const amount = Number(entry.amount ?? entry.balance ?? 0);
    const reference = entry.reference ?? "";
    const description = entry.description ?? "";
    const date = entry.date instanceof Date ? entry.date.toISOString() : `${entry.date}`;
    return `${entry.partyId}|${date}|${amount}|${reference}|${description}`;
  };

  const cashKeys = new Set(cashPayments.map((payment) => makeKey(payment)));

  const filteredLedger = ledger.filter((entry) => !cashKeys.has(makeKey(entry)));

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
      }
    )
  );
};

export const createPartyPayment = async (req, res) => {
  const rawMethod = (req.body.method ?? "CASH").toString().toUpperCase();
  const method =
    rawMethod === "KHATA" || rawMethod === "BANK"
      ? "CREDIT"
      : ["CASH", "CREDIT"].includes(rawMethod)
        ? rawMethod
    : "CASH";
  const isCash = method === "CASH";
  const direction = (req.body.direction ?? "PAY").toString().toUpperCase();
  const normalizedDirection =
    direction === "RECEIVE" || direction === "PAY" ? direction : "PAY";
  const amount = Math.abs(Number(req.body.amount ?? 0));
  const reference =
    req.body.reference ?? (isCash ? "Cash Payment" : "Khata Settlement");
  const description =
    req.body.description ?? (isCash ? "Cash payment" : "Khata settlement");

  const paymentDate = new Date(req.body.date);
  const payment = await prisma.$transaction(async (tx) => {
      const allocations = [];
      if (
        normalizedDirection === "RECEIVE" &&
        !req.body.billId &&
        !req.body.chemicalPurchaseId &&
        !req.body.rexinePurchaseId &&
        !req.body.materialPurchaseId
      ) {
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
            0
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
            0
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
    }).catch((error) => {
      res.status(400).json({ error: error.message ?? "Failed to record payment." });
      return null;
    });

  if (!payment) return;

  res.status(201).json(payment);
};
