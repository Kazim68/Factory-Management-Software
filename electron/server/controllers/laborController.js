import prisma from "../prisma.js";
import { groupByPeriod, toDate, withDateRange } from "../utils/date.js";

export const listLaborProfiles = async (req, res) => {
  const profiles = await prisma.laborProfile.findMany({
    include: { category: true, paymentType: true },
    orderBy: { name: "asc" },
  });
  res.json(profiles);
};

export const createLaborProfile = async (req, res) => {
  const profile = await prisma.laborProfile.create({
    data: {
      name: req.body.name,
      categoryId: req.body.categoryId,
      paymentTypeId: req.body.paymentTypeId,
      defaultRate: req.body.defaultRate,
    },
  });
  res.status(201).json(profile);
};

export const updateLaborProfile = async (req, res) => {
  const profile = await prisma.laborProfile.update({
    where: { id: req.params.laborId },
    data: {
      name: req.body.name,
      categoryId: req.body.categoryId,
      paymentTypeId: req.body.paymentTypeId,
      defaultRate: req.body.defaultRate,
    },
  });
  res.json(profile);
};

export const deleteLaborProfile = async (req, res) => {
  await prisma.laborProfile.delete({ where: { id: req.params.laborId } });
  res.status(204).end();
};

export const upsertLaborRate = async (req, res) => {
  const rate = await prisma.laborRate.upsert({
    where: {
      laborId_articleId_unitId: {
        laborId: req.body.laborId,
        articleId: req.body.articleId,
        unitId: req.body.unitId ?? null,
      },
    },
    create: {
      laborId: req.body.laborId,
      articleId: req.body.articleId,
      unitId: req.body.unitId,
      rate: req.body.rate,
    },
    update: {
      rate: req.body.rate,
    },
  });
  res.status(201).json(rate);
};

export const createLaborWorkEntry = async (req, res) => {
  const entry = await prisma.laborWorkEntry.create({
    data: {
      laborId: req.body.laborId,
      articleId: req.body.articleId,
      unitId: req.body.unitId,
      startDate: new Date(req.body.startDate),
      endDate: new Date(req.body.endDate),
      quantity: req.body.quantity,
      rate: req.body.rate,
      total: req.body.total,
    },
  });
  res.status(201).json(entry);
};

export const updateLaborWorkEntry = async (req, res) => {
  const entry = await prisma.laborWorkEntry.update({
    where: { id: req.params.workId },
    data: {
      laborId: req.body.laborId,
      articleId: req.body.articleId,
      unitId: req.body.unitId,
      startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
      endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
      quantity: req.body.quantity,
      rate: req.body.rate,
      total: req.body.total,
    },
  });
  res.json(entry);
};

export const deleteLaborWorkEntry = async (req, res) => {
  await prisma.laborWorkEntry.delete({ where: { id: req.params.workId } });
  res.status(204).end();
};

export const createLaborAdvance = async (req, res) => {
  const advance = await prisma.laborAdvance.create({
    data: {
      laborId: req.body.laborId,
      date: new Date(req.body.date),
      amount: req.body.amount,
      reason: req.body.reason,
    },
  });

  const expense = await prisma.expenseEntry.create({
    data: {
      date: new Date(req.body.date),
      categoryId: req.body.categoryId,
      partyId: req.body.partyId,
      laborId: req.body.laborId,
      module: "LABOR",
      amount: req.body.amount,
      description: req.body.reason,
      laborAdvanceId: advance.id,
    },
  });

  res.status(201).json({ advance, expense });
};

export const updateLaborAdvance = async (req, res) => {
  const advance = await prisma.laborAdvance.update({
    where: { id: req.params.advanceId },
    data: {
      laborId: req.body.laborId,
      date: req.body.date ? new Date(req.body.date) : undefined,
      amount: req.body.amount,
      reason: req.body.reason,
    },
  });

  const expense = await prisma.expenseEntry.findFirst({
    where: { laborAdvanceId: advance.id },
  });

  if (expense) {
    await prisma.expenseEntry.update({
      where: { id: expense.id },
      data: {
        date: req.body.date ? new Date(req.body.date) : undefined,
        amount: req.body.amount,
        description: req.body.reason,
        categoryId: req.body.categoryId,
      },
    });
  }

  res.json(advance);
};

export const deleteLaborAdvance = async (req, res) => {
  await prisma.$transaction(async (tx) => {
    await tx.expenseEntry.deleteMany({
      where: { laborAdvanceId: req.params.advanceId },
    });
    await tx.laborAdvance.delete({ where: { id: req.params.advanceId } });
  });

  res.status(204).end();
};

export const getLaborLedger = async (req, res) => {
  const start = toDate(req.query.start);
  const end = toDate(req.query.end);
  const [workEntries, advances] = await Promise.all([
    prisma.laborWorkEntry.findMany({
      where: {
        laborId: req.params.laborId,
        startDate: withDateRange(start, end),
      },
      orderBy: { startDate: "asc" },
    }),
    prisma.laborAdvance.findMany({
      where: {
        laborId: req.params.laborId,
        date: withDateRange(start, end),
      },
      orderBy: { date: "asc" },
    }),
  ]);

  const totalEarnings = workEntries.reduce(
    (sum, entry) => sum + Number(entry.total),
    0
  );
  const totalAdvances = advances.reduce(
    (sum, entry) => sum + Number(entry.amount),
    0
  );

  res.json({
    workEntries,
    advances,
    totalEarnings,
    totalAdvances,
    netPayable: totalEarnings - totalAdvances,
  });
};

export const getWeeklyLaborSummary = async (req, res) => {
  const start = toDate(req.query.start);
  const end = toDate(req.query.end);
  const entries = await prisma.laborWorkEntry.findMany({
    where: { startDate: withDateRange(start, end) },
    orderBy: { startDate: "asc" },
  });

  const grouped = groupByPeriod(entries, (entry) => {
    const date = new Date(entry.startDate);
    const day = date.getUTCDay() || 7;
    const weekStart = new Date(date);
    weekStart.setUTCDate(date.getUTCDate() - day + 1);
    return weekStart.toISOString().slice(0, 10);
  });

  res.json(Object.values(grouped));
};

export const getMonthlyLaborSummary = async (req, res) => {
  const start = toDate(req.query.start);
  const end = toDate(req.query.end);
  const entries = await prisma.laborWorkEntry.findMany({
    where: { startDate: withDateRange(start, end) },
    orderBy: { startDate: "asc" },
  });

  const grouped = groupByPeriod(entries, (entry) =>
    entry.startDate.toISOString().slice(0, 7)
  );

  res.json(Object.values(grouped));
};
