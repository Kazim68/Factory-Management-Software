import prisma from "../prisma.js";
import { groupByPeriod, toDate, withDateRange } from "../utils/date.js";
import { normalizeLaborDepartment } from "../constants/laborDepartments.js";
import {
  getLaborDepartmentLabelFromMap,
  getLaborDepartmentLabelMap,
} from "../services/laborDepartmentService.js";

const withCategory = (profile, labelMap) => ({
  ...profile,
  categoryId: profile.department,
  category: {
    id: profile.department,
    name: getLaborDepartmentLabelFromMap(profile.department, labelMap),
  },
});

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const formatDateText = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB");
};

const formatNumberText = (value) => {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
};

export const listLaborProfiles = async (req, res) => {
  const { status = "ACTIVE" } = req.query;
  const where =
    status === "ALL"
      ? undefined
      : {
          status: status === "FIRED" ? "FIRED" : "ACTIVE",
        };

  const [profiles, labelMap] = await Promise.all([
    prisma.laborProfile.findMany({
      where,
      include: { paymentType: true },
      orderBy: { name: "asc" },
    }),
    getLaborDepartmentLabelMap(),
  ]);
  res.json(profiles.map((profile) => withCategory(profile, labelMap)));
};

export const createLaborProfile = async (req, res) => {
  const department = normalizeLaborDepartment(
    req.body.department ?? req.body.categoryId,
  );
  const labelMap = await getLaborDepartmentLabelMap();
  const profile = await prisma.laborProfile.create({
    data: {
      name: req.body.name,
      department,
      paymentTypeId: req.body.paymentTypeId,
      defaultRate: req.body.defaultRate,
      status: req.body.status,
    },
    include: { paymentType: true },
  });
  res.status(201).json(withCategory(profile, labelMap));
};

export const updateLaborProfile = async (req, res) => {
  const departmentValue = req.body.department ?? req.body.categoryId;
  const labelMap = await getLaborDepartmentLabelMap();
  const profile = await prisma.laborProfile.update({
    where: { id: req.params.laborId },
    data: {
      name: req.body.name,
      department:
        departmentValue === undefined
          ? undefined
          : normalizeLaborDepartment(departmentValue),
      paymentTypeId: req.body.paymentTypeId,
      defaultRate: req.body.defaultRate,
      status: req.body.status,
    },
    include: { paymentType: true },
  });
  res.json(withCategory(profile, labelMap));
};

export const fireLaborProfile = async (req, res) => {
  await prisma.laborProfile.update({
    where: { id: req.params.laborId },
    data: { status: "FIRED" },
  });
  res.status(204).end();
};

export const deleteLaborProfile = fireLaborProfile;

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

export const getPrintableLaborWorkEntries = async (req, res) => {
  const start = toDate(req.query.start);
  const end = toDate(req.query.end);
  const departmentRaw = String(req.query.department ?? "ALL").trim();
  const department =
    departmentRaw && departmentRaw !== "ALL"
      ? normalizeLaborDepartment(departmentRaw, "")
      : "ALL";
  if (departmentRaw !== "ALL" && !department) {
    res.status(400).json({ error: "Invalid department filter." });
    return;
  }

  const search = String(req.query.search ?? "")
    .trim()
    .toLowerCase();

  const [entries, labelMap] = await Promise.all([
    prisma.laborWorkEntry.findMany({
      where: {
        startDate: withDateRange(start, end),
      },
      include: {
        labor: true,
        article: true,
      },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    }),
    getLaborDepartmentLabelMap(),
  ]);

  const filteredEntries = entries.filter((entry) => {
    const departmentOk =
      department === "ALL" || entry.labor?.department === department;
    const searchOk =
      !search ||
      String(entry.labor?.name ?? "")
        .toLowerCase()
        .includes(search);
    return departmentOk && searchOk;
  });

  const totalAmount = filteredEntries.reduce(
    (sum, entry) => sum + Number(entry.total ?? 0),
    0,
  );

  const rowsHtml = filteredEntries
    .map((entry) => {
      const departmentLabel = getLaborDepartmentLabelFromMap(
        entry.labor?.department,
        labelMap,
      );
      return `
        <tr>
          <td>${escapeHtml(formatDateText(entry.startDate))}</td>
          <td>${escapeHtml(entry.labor?.name || "-")}</td>
          <td>${escapeHtml(departmentLabel || "-")}</td>
          <td>${escapeHtml(entry.article?.name || "-")}</td>
          <td>${escapeHtml(formatNumberText(entry.quantity))}</td>
          <td>${escapeHtml(formatNumberText(entry.rate))}</td>
          <td>${escapeHtml(formatNumberText(entry.total))}</td>
        </tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Labor Work Entries</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 18px; color: #111; }
        h1 { margin: 0 0 8px; font-size: 22px; }
        .meta { margin-bottom: 14px; font-size: 13px; }
        .meta p { margin: 3px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #d4d4d4; padding: 7px; text-align: left; font-size: 12px; }
        th { background: #f5f5f5; }
        .totals { margin-top: 12px; font-size: 13px; }
        @media print { body { padding: 8px; } }
      </style>
    </head>
    <body>
      <h1>Labor Work Entries</h1>
      <div class="meta">
        <p><strong>Generated At:</strong> ${escapeHtml(new Date().toLocaleString("en-GB"))}</p>
        <p><strong>Department:</strong> ${escapeHtml(
          department === "ALL"
            ? "All Departments"
            : getLaborDepartmentLabelFromMap(department, labelMap),
        )}</p>
        <p><strong>Search:</strong> ${escapeHtml(search || "All")}</p>
        <p><strong>Date Range:</strong> ${escapeHtml(start ? formatDateText(start) : "All")} - ${escapeHtml(end ? formatDateText(end) : "All")}</p>
        <p><strong>Total Rows:</strong> ${filteredEntries.length}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Labor</th>
            <th>Department</th>
            <th>Article</th>
            <th>Quantity</th>
            <th>Rate</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="7">No work entries for selected filters.</td></tr>'}
        </tbody>
      </table>
      <div class="totals">
        <p><strong>Total Amount:</strong> ${escapeHtml(formatNumberText(totalAmount))}</p>
      </div>
      <script>window.onload = () => { window.focus(); window.print(); };</script>
    </body>
  </html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
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
      partyId: req.body.partyId,
      laborId: req.body.laborId,
      module: "LABOR",
      paymentType: "CASH",
      amount: req.body.amount,
      description: req.body.reason,
      laborAdvanceId: advance.id,
      source: "SYSTEM",
      sourceSystem: "LABOR_ADVANCE",
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
        paymentType: req.body.paymentType
          ? String(req.body.paymentType).toUpperCase() === "KHATA"
            ? "CREDIT"
            : String(req.body.paymentType).toUpperCase() === "CREDIT"
              ? "CREDIT"
              : "CASH"
          : undefined,
        amount: req.body.amount,
        description: req.body.reason,
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
    0,
  );
  const totalAdvances = advances.reduce(
    (sum, entry) => sum + Number(entry.amount),
    0,
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
    entry.startDate.toISOString().slice(0, 7),
  );

  res.json(Object.values(grouped));
};
