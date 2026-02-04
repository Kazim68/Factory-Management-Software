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

export const getPartyLedger = async (req, res) => {
  const start = toDate(req.query.start);
  const end = toDate(req.query.end);
  const ledger = await prisma.partyLedgerEntry.findMany({
    where: {
      partyId: req.params.partyId,
      date: withDateRange(start, end),
    },
    orderBy: { date: "asc" },
  });
  res.json(ledger);
};

export const createPartyPayment = async (req, res) => {
  const payment = await prisma.partyPayment.create({
    data: {
      partyId: req.params.partyId,
      date: new Date(req.body.date),
      amount: req.body.amount,
      method: req.body.method ?? "CASH",
      reference: req.body.reference,
      description: req.body.description,
      billId: req.body.billId,
      chemicalPurchaseId: req.body.chemicalPurchaseId,
      rexinePurchaseId: req.body.rexinePurchaseId,
      materialPurchaseId: req.body.materialPurchaseId,
    },
  });

  await prisma.partyLedgerEntry.create({
    data: {
      partyId: req.params.partyId,
      date: new Date(req.body.date),
      reference: req.body.reference ?? "Payment",
      description: req.body.description,
      debit: req.body.amount,
      credit: 0,
    },
  });

  res.status(201).json(payment);
};
