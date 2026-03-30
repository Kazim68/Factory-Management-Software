import prisma from "../prisma.js";

const toApiCheque = (cheque) => ({
  ...cheque,
  amount: Number(cheque.amount ?? 0),
});

export const listCheques = async (req, res) => {
  const cheques = await prisma.cheque.findMany({
    include: {
      sourceParty: { select: { id: true, name: true, type: true } },
      usedParty: { select: { id: true, name: true, type: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  res.json(cheques.map(toApiCheque));
};

export const listAvailableCheques = async (req, res) => {
  const amountParam = req.query.amount;
  const amount = amountParam == null ? null : Number(amountParam);
  const where = {
    status: "AVAILABLE",
  };

  if (amount != null && Number.isFinite(amount) && amount > 0) {
    where.amount = amount;
  }

  const cheques = await prisma.cheque.findMany({
    where,
    include: {
      sourceParty: { select: { id: true, name: true, type: true } },
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });

  res.json(cheques.map(toApiCheque));
};

export const updateCheque = async (req, res) => {
  const cheque = await prisma.cheque.findUnique({
    where: { id: req.params.chequeId },
  });

  if (!cheque) {
    res.status(404).json({ error: "Cheque not found." });
    return;
  }

  if (cheque.status !== "AVAILABLE") {
    res.status(400).json({ error: "Only available cheques can be edited." });
    return;
  }

  const amountRaw = req.body.amount;
  const amount = amountRaw == null ? undefined : Math.abs(Number(amountRaw));
  if (amountRaw != null && (!Number.isFinite(amount) || amount <= 0)) {
    res.status(400).json({ error: "Cheque amount must be greater than 0." });
    return;
  }

  const updated = await prisma.cheque.update({
    where: { id: cheque.id },
    data: {
      date: req.body.date ? new Date(req.body.date) : undefined,
      amount,
      chequeNumber:
        req.body.chequeNumber == null
          ? undefined
          : String(req.body.chequeNumber).trim() || null,
      notes:
        req.body.notes == null
          ? undefined
          : String(req.body.notes).trim() || null,
    },
    include: {
      sourceParty: { select: { id: true, name: true, type: true } },
      usedParty: { select: { id: true, name: true, type: true } },
    },
  });

  res.json(toApiCheque(updated));
};

export const cashCheque = async (req, res) => {
  const cheque = await prisma.cheque.findUnique({
    where: { id: req.params.chequeId },
  });

  if (!cheque) {
    res.status(404).json({ error: "Cheque not found." });
    return;
  }

  if (cheque.status !== "AVAILABLE") {
    res
      .status(400)
      .json({ error: "Only available cheques can be marked cashed." });
    return;
  }

  const cashDate = req.body.date ? new Date(req.body.date) : new Date();
  const updated = await prisma.cheque.update({
    where: { id: cheque.id },
    data: {
      status: "CASHED",
      cashedAt: cashDate,
      notes:
        req.body.notes == null
          ? cheque.notes
          : String(req.body.notes).trim() || cheque.notes,
    },
    include: {
      sourceParty: { select: { id: true, name: true, type: true } },
      usedParty: { select: { id: true, name: true, type: true } },
    },
  });

  res.json(toApiCheque(updated));
};
