import prisma from "../prisma.js";
import { toDate, withDateRange } from "../utils/date.js";

export const listParties = async (req, res) => {
  const parties = await prisma.party.findMany({ orderBy: { name: "asc" } });
  res.json(parties);
};

export const createParty = async (req, res) => {
  const party = await prisma.party.create({
    data: {
      name: req.body.name,
      type: req.body.type,
      openingBalance: req.body.openingBalance ?? 0,
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
      openingBalance: req.body.openingBalance,
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
    const amount = Number(entry.amount ?? entry.debit ?? entry.credit ?? 0);
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
    debit: 0,
    credit: 0,
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
      debit: 0,
      credit: 0,
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
      debit: 0,
      credit: 0,
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
      debit: 0,
      credit: 0,
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
    return isCash
      ? { ...entry, cash: Number(entry.debit ?? entry.credit ?? 0), isCash: true }
      : entry;
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
  const method = ["CASH", "CREDIT", "BANK"].includes(rawMethod)
    ? rawMethod
    : "CASH";
  const isCash = method === "CASH";
  const reference =
    req.body.reference ?? (isCash ? "Cash Payment" : "Payment");
  const description =
    req.body.description ?? (isCash ? "Cash payment" : undefined);

  const payment = await prisma.partyPayment.create({
    data: {
      partyId: req.params.partyId,
      date: new Date(req.body.date),
      amount: req.body.amount,
      method,
      reference,
      description,
      billId: req.body.billId,
      chemicalPurchaseId: req.body.chemicalPurchaseId,
      rexinePurchaseId: req.body.rexinePurchaseId,
      materialPurchaseId: req.body.materialPurchaseId,
    },
  });

  if (!isCash) {
    await prisma.partyLedgerEntry.create({
      data: {
        partyId: req.params.partyId,
        date: new Date(req.body.date),
        reference,
        description,
        debit: req.body.amount,
        credit: 0,
      },
    });
  }

  res.status(201).json(payment);
};
