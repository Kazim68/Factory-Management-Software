import prisma from "../prisma.js";
import { toDate, withDateRange } from "../utils/date.js";

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const getWeekStart = (date) => {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
};

const getMonthStart = (date) => {
  const d = startOfDay(date);
  d.setDate(1);
  return d;
};

const getMonthEnd = (date) => {
  const d = endOfDay(date);
  d.setMonth(d.getMonth() + 1, 0);
  return d;
};

const toIsoDay = (date) => startOfDay(date).toISOString().slice(0, 10);

const normalizeDateRange = ({ start, end, period }) => {
  const parsedStart = toDate(start);
  const parsedEnd = toDate(end);
  const now = new Date();

  const finalEnd = parsedEnd ? endOfDay(parsedEnd) : endOfDay(now);
  let finalStart = parsedStart ? startOfDay(parsedStart) : null;

  if (!finalStart) {
    if (period === "daily") {
      finalStart = startOfDay(finalEnd);
    } else if (period === "weekly") {
      finalStart = getWeekStart(finalEnd);
    } else {
      finalStart = getMonthStart(finalEnd);
    }
  }

  if (finalStart > finalEnd) {
    const error = new Error("Invalid date range: start must be before end.");
    error.statusCode = 400;
    throw error;
  }

  return { start: finalStart, end: finalEnd };
};

const getBucketKey = (date, period) => {
  if (period === "daily") {
    return toIsoDay(date);
  }
  if (period === "weekly") {
    return toIsoDay(getWeekStart(date));
  }
  return new Date(date).toISOString().slice(0, 7);
};

const ensureBucket = (map, key) => {
  if (!map.has(key)) {
    map.set(key, {
      key,
      totalInflow: 0,
      totalOutflow: 0,
      netCashFlow: 0,
      entryCount: 0,
      moduleBreakdown: {},
    });
  }
  return map.get(key);
};

const ensureLaborBucket = (map, key) => {
  if (!map.has(key)) {
    map.set(key, {
      key,
      totalEarnings: 0,
      totalAdvances: 0,
      totalPaidCash: 0,
      netPayable: 0,
      laborCount: 0,
      labors: [],
    });
  }
  return map.get(key);
};

const updateLaborRow = (byLabor, laborId, laborName, updater) => {
  if (!laborId) return;
  if (!byLabor[laborId]) {
    byLabor[laborId] = {
      laborId,
      laborName,
      totalEarnings: 0,
      totalAdvances: 0,
      totalPaidCash: 0,
      netPayable: 0,
    };
  }
  updater(byLabor[laborId]);
};

const getMonthKeysBetween = (start, end) => {
  const keys = [];
  const cursor = getMonthStart(start);
  const limit = getMonthStart(end);

  while (cursor <= limit) {
    keys.push(cursor.toISOString().slice(0, 7));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return keys;
};

const isCashLedgerEntry = (entry) => {
  const reference = String(entry.reference ?? "").toLowerCase();
  const description = String(entry.description ?? "").toLowerCase();
  return reference.includes("cash") || description.includes("cash");
};

export const getRoznamchaSummary = async ({ period, start, end }) => {
  const { start: rangeStart, end: rangeEnd } = normalizeDateRange({
    period,
    start,
    end,
  });

  const entries = await prisma.expenseEntry.findMany({
    where: {
      date: withDateRange(rangeStart, rangeEnd),
    },
    orderBy: { date: "asc" },
  });

  const bucketsMap = new Map();
  let totalInflow = 0;
  let totalOutflow = 0;

  for (const entry of entries) {
    const amount = Number(entry.amount ?? 0);
    const bucketKey = getBucketKey(entry.date, period);
    const bucket = ensureBucket(bucketsMap, bucketKey);
    const moduleKey = entry.module ?? "MISC";

    if (!bucket.moduleBreakdown[moduleKey]) {
      bucket.moduleBreakdown[moduleKey] = 0;
    }

    if (amount < 0) {
      const inflow = Math.abs(amount);
      bucket.totalInflow += inflow;
      totalInflow += inflow;
    } else {
      bucket.totalOutflow += amount;
      totalOutflow += amount;
    }

    bucket.moduleBreakdown[moduleKey] += amount;
    bucket.entryCount += 1;
  }

  const buckets = Array.from(bucketsMap.values())
    .map((bucket) => ({
      ...bucket,
      netCashFlow: bucket.totalInflow - bucket.totalOutflow,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  return {
    report: "roznamcha-summary",
    period,
    range: {
      start: rangeStart.toISOString(),
      end: rangeEnd.toISOString(),
    },
    totals: {
      totalInflow,
      totalOutflow,
      netCashFlow: totalInflow - totalOutflow,
      entryCount: entries.length,
    },
    buckets,
  };
};

export const getLaborSummary = async ({ period, start, end }) => {
  const { start: rangeStart, end: rangeEnd } = normalizeDateRange({
    period,
    start,
    end,
  });

  const [workEntries, advances, laborPayments] = await Promise.all([
    prisma.laborWorkEntry.findMany({
      where: {
        startDate: withDateRange(rangeStart, rangeEnd),
      },
      orderBy: { startDate: "asc" },
    }),
    prisma.laborAdvance.findMany({
      where: {
        date: withDateRange(rangeStart, rangeEnd),
      },
      orderBy: { date: "asc" },
    }),
    prisma.expenseEntry.findMany({
      where: {
        module: "LABOR",
        laborAdvanceId: null,
        date: withDateRange(rangeStart, rangeEnd),
      },
      orderBy: { date: "asc" },
    }),
  ]);

  const laborIds = Array.from(
    new Set([
      ...workEntries.map((entry) => entry.laborId),
      ...advances.map((entry) => entry.laborId),
      ...laborPayments.map((entry) => entry.laborId).filter(Boolean),
    ]),
  );

  const laborProfiles = await prisma.laborProfile.findMany({
    where: { id: { in: laborIds } },
    select: { id: true, name: true },
  });

  const laborNameById = laborProfiles.reduce((acc, profile) => {
    acc[profile.id] = profile.name;
    return acc;
  }, {});

  const bucketMap = new Map();
  const byBucketLabor = {};

  const ensureLaborContainer = (bucketKey) => {
    if (!byBucketLabor[bucketKey]) {
      byBucketLabor[bucketKey] = {};
    }
    return byBucketLabor[bucketKey];
  };

  for (const entry of workEntries) {
    const key = getBucketKey(entry.startDate, period);
    const bucket = ensureLaborBucket(bucketMap, key);
    const amount = Number(entry.total ?? 0);
    const byLabor = ensureLaborContainer(key);
    const laborName = laborNameById[entry.laborId] ?? "Unknown";

    bucket.totalEarnings += amount;
    updateLaborRow(byLabor, entry.laborId, laborName, (row) => {
      row.totalEarnings += amount;
    });
  }

  for (const entry of advances) {
    const key = getBucketKey(entry.date, period);
    const bucket = ensureLaborBucket(bucketMap, key);
    const amount = Number(entry.amount ?? 0);
    const byLabor = ensureLaborContainer(key);
    const laborName = laborNameById[entry.laborId] ?? "Unknown";

    bucket.totalAdvances += amount;
    updateLaborRow(byLabor, entry.laborId, laborName, (row) => {
      row.totalAdvances += amount;
    });
  }

  for (const entry of laborPayments) {
    if (!entry.laborId) continue;
    const key = getBucketKey(entry.date, period);
    const bucket = ensureLaborBucket(bucketMap, key);
    const amount = Math.abs(Number(entry.amount ?? 0));
    const byLabor = ensureLaborContainer(key);
    const laborName = laborNameById[entry.laborId] ?? "Unknown";

    bucket.totalPaidCash += amount;
    updateLaborRow(byLabor, entry.laborId, laborName, (row) => {
      row.totalPaidCash += amount;
    });
  }

  const buckets = Array.from(bucketMap.entries())
    .map(([key, bucket]) => {
      const laborRows = Object.values(byBucketLabor[key] ?? {}).map((row) => ({
        ...row,
        netPayable: row.totalEarnings - row.totalAdvances - row.totalPaidCash,
      }));

      laborRows.sort((a, b) => a.laborName.localeCompare(b.laborName));

      return {
        ...bucket,
        netPayable:
          bucket.totalEarnings - bucket.totalAdvances - bucket.totalPaidCash,
        laborCount: laborRows.length,
        labors: laborRows,
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));

  const totals = buckets.reduce(
    (acc, bucket) => {
      acc.totalEarnings += bucket.totalEarnings;
      acc.totalAdvances += bucket.totalAdvances;
      acc.totalPaidCash += bucket.totalPaidCash;
      return acc;
    },
    {
      totalEarnings: 0,
      totalAdvances: 0,
      totalPaidCash: 0,
      netPayable: 0,
    },
  );

  totals.netPayable =
    totals.totalEarnings - totals.totalAdvances - totals.totalPaidCash;

  return {
    report: "labor-summary",
    period,
    range: {
      start: rangeStart.toISOString(),
      end: rangeEnd.toISOString(),
    },
    totals,
    counts: {
      workEntries: workEntries.length,
      advances: advances.length,
      payments: laborPayments.length,
      uniqueLabors: laborIds.length,
    },
    buckets,
  };
};

export const getPartyMonthlyOutstandingSummary = async ({
  period,
  start,
  end,
}) => {
  const { start: rangeStart, end: rangeEnd } = normalizeDateRange({
    period,
    start,
    end,
  });

  const [parties, ledgerEntries] = await Promise.all([
    prisma.party.findMany({
      select: {
        id: true,
        name: true,
        type: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.partyLedgerEntry.findMany({
      where: {
        date: {
          lte: rangeEnd,
        },
      },
      select: {
        id: true,
        partyId: true,
        date: true,
        reference: true,
        description: true,
        balance: true,
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const partyById = parties.reduce((acc, party) => {
    acc[party.id] = party;
    return acc;
  }, {});

  const monthKeys = getMonthKeysBetween(rangeStart, rangeEnd);
  const runningBalanceByParty = {};
  let cursor = 0;

  const buckets = monthKeys.map((monthKey) => {
    const monthEnd = getMonthEnd(`${monthKey}-01`);

    while (
      cursor < ledgerEntries.length &&
      startOfDay(ledgerEntries[cursor].date) <= monthEnd
    ) {
      const entry = ledgerEntries[cursor];
      if (!isCashLedgerEntry(entry)) {
        const current = Number(runningBalanceByParty[entry.partyId] ?? 0);
        runningBalanceByParty[entry.partyId] =
          current + Number(entry.balance ?? 0);
      }
      cursor += 1;
    }

    const partyRows = Object.entries(runningBalanceByParty)
      .map(([partyId, outstanding]) => {
        const numericOutstanding = Number(outstanding ?? 0);
        if (!Number.isFinite(numericOutstanding) || numericOutstanding === 0) {
          return null;
        }

        const party = partyById[partyId];
        return {
          partyId,
          partyName: party?.name ?? "Unknown",
          partyType: party?.type ?? "BOTH",
          outstanding: numericOutstanding,
          receivable: numericOutstanding > 0 ? numericOutstanding : 0,
          payable: numericOutstanding < 0 ? Math.abs(numericOutstanding) : 0,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.outstanding - a.outstanding);

    const totals = partyRows.reduce(
      (acc, row) => {
        acc.totalOutstanding += row.outstanding;
        acc.totalReceivable += row.receivable;
        acc.totalPayable += row.payable;
        return acc;
      },
      {
        totalOutstanding: 0,
        totalReceivable: 0,
        totalPayable: 0,
      },
    );

    return {
      key: monthKey,
      partyCount: partyRows.length,
      ...totals,
      parties: partyRows,
    };
  });

  const totals = buckets.reduce(
    (acc, bucket) => {
      acc.totalOutstanding += bucket.totalOutstanding;
      acc.totalReceivable += bucket.totalReceivable;
      acc.totalPayable += bucket.totalPayable;
      return acc;
    },
    {
      totalOutstanding: 0,
      totalReceivable: 0,
      totalPayable: 0,
    },
  );

  return {
    report: "party-monthly-outstanding",
    period,
    range: {
      start: rangeStart.toISOString(),
      end: rangeEnd.toISOString(),
    },
    totals,
    counts: {
      parties: parties.length,
      ledgerEntries: ledgerEntries.length,
      activeOutstandingParties:
        buckets.length > 0 ? buckets[buckets.length - 1].partyCount : 0,
    },
    buckets,
  };
};

export const getPeriodFromRequest = (periodValue, allowedPeriods) => {
  const fallback = Array.from(allowedPeriods)[0];
  const period = String(periodValue ?? fallback).toLowerCase();

  if (!allowedPeriods.has(period)) {
    const error = new Error(
      `Invalid period '${period}'. Allowed: ${Array.from(allowedPeriods).join(", ")}`,
    );
    error.statusCode = 400;
    throw error;
  }

  return period;
};

export const VALID_ROZNAMCHA_PERIODS = new Set(["daily", "weekly", "monthly"]);
export const VALID_LABOR_PERIODS = new Set(["weekly", "monthly"]);
export const VALID_PARTY_PERIODS = new Set(["monthly"]);
