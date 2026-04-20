import prisma from "../prisma.js";
import {
  formatDateKey,
  formatDateTime,
  formatMonthKey,
  getWeekStart,
  groupByPeriod,
  toDate,
  withDateRange,
} from "../utils/date.js";
import { normalizeLaborDepartment } from "../constants/laborDepartments.js";
import {
  getLaborDepartmentLabelFromMap,
  getLaborDepartmentLabelMap,
} from "../services/laborDepartmentService.js";
import {
  formatPrintNumber,
  getPrintDirection,
  getPrintFontFamily,
  getPrintLocale,
  getPrintTextAlign,
  normalizePrintLanguage,
  translatePrintText,
} from "../utils/printLanguage.js";
import {
  resolveDeletedWhere,
  restoreById,
  softDeleteById,
} from "../utils/softDelete.js";

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

const formatDateText = (value, language) => {
  return formatDateTime(value, getPrintLocale(language, "date"), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

const formatNumberText = (value, language) =>
  formatPrintNumber(value, language, { maximumFractionDigits: 2 });

export const listLaborProfiles = async (req, res) => {
  const { status = "ACTIVE" } = req.query;
  const statusWhere =
    status === "ALL"
      ? undefined
      : {
          status: status === "FIRED" ? "FIRED" : "ACTIVE",
        };

  const [profiles, labelMap] = await Promise.all([
    prisma.laborProfile.findMany({
      where: resolveDeletedWhere(req.query.deleted, statusWhere),
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
      phone: req.body.phone,
      city: req.body.city,
      defaultRate: req.body.defaultRate,
      status: req.body.status,
    },
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
      phone: req.body.phone,
      city: req.body.city,
      defaultRate: req.body.defaultRate,
      status: req.body.status,
    },
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

export const deleteLaborProfile = async (req, res) => {
  await softDeleteById(prisma.laborProfile, req.params.laborId);
  res.status(204).end();
};

export const restoreLaborProfile = async (req, res) => {
  const profile = await restoreById(prisma.laborProfile, req.params.laborId);
  res.json(profile);
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
      startDate: toDate(req.body.startDate, "start"),
      endDate: toDate(req.body.endDate, "start"),
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
      startDate: req.body.startDate ? toDate(req.body.startDate, "start") : undefined,
      endDate: req.body.endDate ? toDate(req.body.endDate, "start") : undefined,
      quantity: req.body.quantity,
      rate: req.body.rate,
      total: req.body.total,
    },
  });
  res.json(entry);
};

export const deleteLaborWorkEntry = async (req, res) => {
  await softDeleteById(prisma.laborWorkEntry, req.params.workId);
  res.status(204).end();
};

export const restoreLaborWorkEntry = async (req, res) => {
  const entry = await restoreById(prisma.laborWorkEntry, req.params.workId);
  res.json(entry);
};

export const listLaborWorkEntries = async (req, res) => {
  const start = toDate(req.query.start, "start");
  const end = toDate(req.query.end, "end");
  const rows = await prisma.laborWorkEntry.findMany({
    where: resolveDeletedWhere(req.query.deleted, {
      startDate: withDateRange(start, end),
    }),
    include: {
      labor: true,
      article: true,
      unit: true,
    },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
  });
  res.json(rows);
};

export const getPrintableLaborWorkEntries = async (req, res) => {
  const language = normalizePrintLanguage(req.query.lang);
  const start = toDate(req.query.start, "start");
  const end = toDate(req.query.end, "end");
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
        deletedAt: null,
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
      const departmentLabel = translatePrintText(
        getLaborDepartmentLabelFromMap(entry.labor?.department, labelMap),
        language,
      );
      return `
        <tr>
          <td>${escapeHtml(formatDateText(entry.startDate, language))}</td>
          <td>${escapeHtml(entry.labor?.name || "-")}</td>
          <td>${escapeHtml(departmentLabel || "-")}</td>
          <td>${escapeHtml(entry.article?.name || "-")}</td>
          <td>${escapeHtml(formatNumberText(entry.quantity, language))}</td>
          <td>${escapeHtml(formatNumberText(entry.rate, language))}</td>
          <td>${escapeHtml(formatNumberText(entry.total, language))}</td>
        </tr>`;
    })
    .join("");

  const title = translatePrintText("Labor Work Entries", language);
  const direction = getPrintDirection(language);
  const textAlign = getPrintTextAlign(language);
  const fontFamily = getPrintFontFamily(language);
  const languageCode = language === "ur" ? "ur" : "en";

  const html = `<!DOCTYPE html>
  <html lang="${languageCode}" dir="${direction}">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(title)}</title>
      <style>
        body { font-family: ${fontFamily}; padding: 18px; color: #111; direction: ${direction}; text-align: ${textAlign}; }
        h1 { margin: 0 0 8px; font-size: 22px; }
        .meta { margin-bottom: 14px; font-size: 13px; }
        .meta p { margin: 3px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #d4d4d4; padding: 7px; text-align: ${textAlign}; font-size: 12px; }
        th { background: #f5f5f5; }
        .totals { margin-top: 12px; font-size: 13px; }
        @media print { body { padding: 8px; } }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">
        <p><strong>${escapeHtml(translatePrintText("Generated At", language))}:</strong> ${escapeHtml(
          formatDateTime(new Date(), getPrintLocale(language, "date"), {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }),
        )}</p>
        <p><strong>${escapeHtml(translatePrintText("Department", language))}:</strong> ${escapeHtml(
          department === "ALL"
            ? translatePrintText("All Departments", language)
            : translatePrintText(
                getLaborDepartmentLabelFromMap(department, labelMap),
                language,
              ),
        )}</p>
        <p><strong>${escapeHtml(translatePrintText("Search", language))}:</strong> ${escapeHtml(search || translatePrintText("All", language))}</p>
        <p><strong>${escapeHtml(translatePrintText("Date Range", language))}:</strong> ${escapeHtml(start ? formatDateText(start, language) : translatePrintText("All", language))} - ${escapeHtml(end ? formatDateText(end, language) : translatePrintText("All", language))}</p>
        <p><strong>${escapeHtml(translatePrintText("Total Rows", language))}:</strong> ${filteredEntries.length}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>${escapeHtml(translatePrintText("Date", language))}</th>
            <th>${escapeHtml(translatePrintText("Labor", language))}</th>
            <th>${escapeHtml(translatePrintText("Department", language))}</th>
            <th>${escapeHtml(translatePrintText("Article", language))}</th>
            <th>${escapeHtml(translatePrintText("Quantity", language))}</th>
            <th>${escapeHtml(translatePrintText("Rate", language))}</th>
            <th>${escapeHtml(translatePrintText("Total", language))}</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="7">${escapeHtml(translatePrintText("No work entries for selected filters.", language))}</td></tr>`}
        </tbody>
      </table>
      <div class="totals">
        <p><strong>${escapeHtml(translatePrintText("Total Amount", language))}:</strong> ${escapeHtml(formatNumberText(totalAmount, language))}</p>
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
      date: toDate(req.body.date, "start"),
      amount: req.body.amount,
      reason: req.body.reason,
    },
  });

  const expense = await prisma.expenseEntry.create({
      data: {
      date: toDate(req.body.date, "start"),
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
      date: req.body.date ? toDate(req.body.date, "start") : undefined,
      amount: req.body.amount,
      reason: req.body.reason,
    },
  });

  const expense = await prisma.expenseEntry.findFirst({
    where: { laborAdvanceId: advance.id, deletedAt: null },
  });

  if (expense) {
    await prisma.expenseEntry.update({
      where: { id: expense.id },
      data: {
        date: req.body.date ? toDate(req.body.date, "start") : undefined,
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
    const deletedAt = new Date();
    await tx.expenseEntry.updateMany({
      where: { laborAdvanceId: req.params.advanceId, deletedAt: null },
      data: { deletedAt },
    });
    await tx.laborAdvance.update({
      where: { id: req.params.advanceId },
      data: { deletedAt },
    });
  });

  res.status(204).end();
};

export const restoreLaborAdvance = async (req, res) => {
  const advance = await prisma.$transaction(async (tx) => {
    const restored = await tx.laborAdvance.update({
      where: { id: req.params.advanceId },
      data: { deletedAt: null },
    });
    await tx.expenseEntry.updateMany({
      where: { laborAdvanceId: req.params.advanceId },
      data: { deletedAt: null },
    });
    return restored;
  });

  res.json(advance);
};

export const listLaborAdvances = async (req, res) => {
  const start = toDate(req.query.start, "start");
  const end = toDate(req.query.end, "end");
  const rows = await prisma.laborAdvance.findMany({
    where: resolveDeletedWhere(req.query.deleted, {
      date: withDateRange(start, end),
      laborId: req.query.laborId || undefined,
    }),
    include: {
      labor: true,
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  res.json(rows);
};

export const getLaborLedger = async (req, res) => {
  const start = toDate(req.query.start, "start");
  const end = toDate(req.query.end, "end");
  const [workEntries, advances] = await Promise.all([
    prisma.laborWorkEntry.findMany({
      where: {
        laborId: req.params.laborId,
        startDate: withDateRange(start, end),
        deletedAt: null,
      },
      orderBy: { startDate: "asc" },
    }),
    prisma.laborAdvance.findMany({
      where: {
        laborId: req.params.laborId,
        date: withDateRange(start, end),
        deletedAt: null,
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
  const start = toDate(req.query.start, "start");
  const end = toDate(req.query.end, "end");
  const entries = await prisma.laborWorkEntry.findMany({
    where: { startDate: withDateRange(start, end), deletedAt: null },
    orderBy: { startDate: "asc" },
  });

  const grouped = groupByPeriod(entries, (entry) => {
    return formatDateKey(getWeekStart(entry.startDate));
  });

  res.json(Object.values(grouped));
};

export const getMonthlyLaborSummary = async (req, res) => {
  const start = toDate(req.query.start, "start");
  const end = toDate(req.query.end, "end");
  const entries = await prisma.laborWorkEntry.findMany({
    where: { startDate: withDateRange(start, end), deletedAt: null },
    orderBy: { startDate: "asc" },
  });

  const grouped = groupByPeriod(entries, (entry) =>
    formatMonthKey(entry.startDate),
  );

  res.json(Object.values(grouped));
};
