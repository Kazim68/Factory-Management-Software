import prisma from "../prisma.js";
import {
  endOfDay,
  formatDateKey,
  formatDateTime,
  getMonthEnd,
  getMonthStart,
  getWeekStart,
  startOfDay,
  toDate,
} from "../utils/date.js";
import {
  formatPrintNumber,
  getPrintDirection,
  getPrintFontFamily,
  getPrintLocale,
  getPrintTextAlign,
  normalizePrintLanguage,
  translatePrintList,
  translatePrintText,
} from "../utils/printLanguage.js";
import { resolveDeletedWhere } from "../utils/softDelete.js";

const toDbPaymentType = (paymentType) => {
  const normalized = String(paymentType ?? "CASH").toUpperCase();
  if (normalized === "KHATA") return "CREDIT";
  if (normalized === "CHEQUE") return "CHEQUE";
  return normalized === "CREDIT" ? "CREDIT" : "CASH";
};

const isKhata = (paymentType) =>
  ["CREDIT", "KHATA"].includes(String(paymentType ?? "CASH").toUpperCase());

const toPurchasePaymentLabel = (paymentType) => {
  const normalized = String(paymentType ?? "KHATA").toUpperCase();
  if (normalized === "KHATA" || normalized === "CREDIT") return "Khata";
  if (normalized === "CHEQUE") return "Cheque";
  if (normalized === "BANK") return "Bank";
  return "Cash";
};

const PURCHASE_PRINT_TYPES = new Set(["CHEMICAL", "REXINE", "MATERIAL"]);
const PURCHASE_PRINT_PRESETS = new Set([
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "YEARLY",
  "CUSTOM",
  "THIS_MONTH",
]);

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const formatMoney = (value, language) =>
  `Rs ${formatPrintNumber(value, language, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatPrintDate = (value, language) => {
  return formatDateTime(value, getPrintLocale(language, "date"), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

const parsePrintTypes = (typesValue) => {
  if (!typesValue) return ["CHEMICAL", "REXINE", "MATERIAL"];
  const parsed = String(typesValue)
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter((item) => PURCHASE_PRINT_TYPES.has(item));
  return parsed.length
    ? [...new Set(parsed)]
    : ["CHEMICAL", "REXINE", "MATERIAL"];
};

const getPrintDateRange = ({ timePreset, start, end }) => {
  const preset = PURCHASE_PRINT_PRESETS.has(
    String(timePreset ?? "").toUpperCase(),
  )
    ? String(timePreset).toUpperCase()
    : "THIS_MONTH";

  const now = new Date();

  if (preset === "CUSTOM") {
    const customStart = start ? toDate(start, "start") : null;
    const customEnd = end ? toDate(end, "end") : null;
    return {
      preset,
      from:
        customStart && !Number.isNaN(customStart.getTime())
          ? customStart
          : null,
      to: customEnd && !Number.isNaN(customEnd.getTime()) ? customEnd : null,
    };
  }

  if (preset === "DAILY") {
    return { preset, from: startOfDay(now), to: endOfDay(now) };
  }

  if (preset === "WEEKLY") {
    const weekStart = getWeekStart(now);
    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
    return {
      preset,
      from: weekStart,
      to: endOfDay(weekEnd),
    };
  }

  if (preset === "YEARLY") {
    const currentYear = formatDateKey(now).slice(0, 4);
    const startYear = startOfDay(`${currentYear}-01-01`);
    const endYear = endOfDay(`${currentYear}-12-31`);
    return { preset, from: startYear, to: endYear };
  }

  return { preset, from: getMonthStart(now), to: getMonthEnd(now) };
};

const whereDateRange = (from, to) => {
  const date = {};
  if (from) date.gte = from;
  if (to) date.lte = to;
  return Object.keys(date).length ? { date } : {};
};

export const getPrintableSupplierPurchases = async (req, res) => {
  const language = normalizePrintLanguage(req.query.lang);
  const selectedTypes = parsePrintTypes(req.query.types);
  const range = getPrintDateRange({
    timePreset: req.query.timePreset,
    start: req.query.start,
    end: req.query.end,
  });

  const where = whereDateRange(range.from, range.to);

  const [chemicalData, rexineData, materialData] = await Promise.all([
    selectedTypes.includes("CHEMICAL")
      ? prisma.chemicalPurchase.findMany({
          where: { ...where, deletedAt: null },
          include: { party: true },
          orderBy: { date: "desc" },
        })
      : Promise.resolve([]),
    selectedTypes.includes("REXINE")
      ? prisma.rexinePurchase.findMany({
          where: { ...where, deletedAt: null },
          include: { party: true },
          orderBy: { date: "desc" },
        })
      : Promise.resolve([]),
    selectedTypes.includes("MATERIAL")
      ? prisma.materialPurchase.findMany({
          where: { ...where, deletedAt: null },
          include: { party: true, article: true, unit: true },
          orderBy: { date: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const rows = [
    ...chemicalData.map((entry) => ({
      date: entry.date,
      supplierName:
        entry.party?.name || translatePrintText("Unknown", language),
      type: translatePrintText("CHEMICAL", language),
      itemName: translatePrintText("Raw Material", language),
      quantity: `${formatPrintNumber(entry.quantityKg, language)} ${translatePrintText("kg", language)}`,
      rate: `${formatMoney(entry.ratePerKg, language)}/${translatePrintText("kg", language)}`,
      total: Number(entry.totalAmount ?? 0),
      paymentType: translatePrintText(
        toPurchasePaymentLabel(entry.paymentType),
        language,
      ),
    })),
    ...rexineData.map((entry) => ({
      date: entry.date,
      supplierName:
        entry.party?.name || translatePrintText("Unknown", language),
      type: translatePrintText("REXINE", language),
      itemName: translatePrintText("Raw Material", language),
      quantity: `${formatPrintNumber(entry.quantityMeter, language)} ${translatePrintText("meter", language)}`,
      rate: `${formatMoney(entry.ratePerMeter, language)}/${translatePrintText("meter", language)}`,
      total: Number(entry.totalAmount ?? 0),
      paymentType: translatePrintText(
        toPurchasePaymentLabel(entry.paymentType),
        language,
      ),
    })),
    ...materialData.map((entry) => {
      const unitLabel = entry.unit?.symbol || entry.unit?.name || "unit";
      return {
        date: entry.date,
        supplierName:
          entry.party?.name || translatePrintText("Unknown", language),
        type: translatePrintText("MATERIAL", language),
        itemName: entry.article?.name || "-",
        quantity: `${formatPrintNumber(entry.quantity, language)} ${unitLabel}`,
        rate: `${formatMoney(entry.pricePerUnit, language)}/${unitLabel}`,
        total: Number(entry.totalAmount ?? 0),
        paymentType: translatePrintText(
          toPurchasePaymentLabel(entry.paymentType),
          language,
        ),
      };
    }),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const grandTotal = rows.reduce((sum, row) => sum + row.total, 0);

  const htmlRows = rows
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(formatPrintDate(row.date, language))}</td>
        <td>${escapeHtml(row.supplierName)}</td>
        <td>${escapeHtml(row.type)}</td>
        <td>${escapeHtml(row.itemName)}</td>
        <td>${escapeHtml(row.quantity)}</td>
        <td>${escapeHtml(row.rate)}</td>
        <td>${escapeHtml(formatMoney(row.total, language))}</td>
        <td>${escapeHtml(row.paymentType)}</td>
      </tr>
    `,
    )
    .join("");

  const title = translatePrintText("Supplier Purchase Report", language);
  const generatedAt = formatDateTime(
    new Date(),
    getPrintLocale(language, "date"),
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    },
  );
  const fromText = range.from ? formatPrintDate(range.from, language) : "-";
  const toText = range.to ? formatPrintDate(range.to, language) : "-";
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
        .totals { margin-top: 12px; text-align: ${direction === "rtl" ? "left" : "right"}; font-weight: 700; }
        @media print { body { padding: 8px; } }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">
        <p><strong>${escapeHtml(translatePrintText("Generated At", language))}:</strong> ${escapeHtml(generatedAt)}</p>
        <p><strong>${escapeHtml(translatePrintText("Type Filters", language))}:</strong> ${escapeHtml(translatePrintList(selectedTypes, language))}</p>
        <p><strong>${escapeHtml(translatePrintText("Time Filter", language))}:</strong> ${escapeHtml(translatePrintText(range.preset, language))}</p>
        <p><strong>${escapeHtml(translatePrintText("Date Range", language))}:</strong> ${escapeHtml(fromText)} ${escapeHtml(translatePrintText("To", language))} ${escapeHtml(toText)}</p>
        <p><strong>${escapeHtml(translatePrintText("Total Rows", language))}:</strong> ${rows.length}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>${escapeHtml(translatePrintText("Date", language))}</th>
            <th>${escapeHtml(translatePrintText("Supplier", language))}</th>
            <th>${escapeHtml(translatePrintText("Type", language))}</th>
            <th>${escapeHtml(translatePrintText("Item", language))}</th>
            <th>${escapeHtml(translatePrintText("Quantity", language))}</th>
            <th>${escapeHtml(translatePrintText("Rate", language))}</th>
            <th>${escapeHtml(translatePrintText("Total", language))}</th>
            <th>${escapeHtml(translatePrintText("Payment", language))}</th>
          </tr>
        </thead>
        <tbody>
          ${htmlRows || `<tr><td colspan="8">${escapeHtml(translatePrintText("No records found for selected filters.", language))}</td></tr>`}
        </tbody>
      </table>
      <div class="totals">${escapeHtml(translatePrintText("Grand Total", language))}: ${escapeHtml(formatMoney(grandTotal, language))}</div>
      <script>window.onload = () => { window.focus(); window.print(); };</script>
    </body>
  </html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
};

export const createCombinedSupplierPurchase = async (req, res) => {
  const { date, partyId, rows } = req.body ?? {};

  if (!partyId) {
    res.status(400).json({ error: "Supplier is required." });
    return;
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "At least one purchase row is required." });
    return;
  }

  const normalizedRows = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const type = String(row?.type ?? "").toUpperCase();
    const quantity = Number(row?.quantity ?? 0);
    const rate = Number(row?.rate ?? 0);
    const articleId = row?.articleId ? String(row.articleId) : undefined;

    if (!["CHEMICAL", "REXINE", "MATERIAL"].includes(type)) {
      res.status(400).json({ error: `Invalid row type at row ${index + 1}.` });
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      res.status(400).json({
        error: `Quantity must be greater than 0 at row ${index + 1}.`,
      });
      return;
    }
    if (!Number.isFinite(rate) || rate <= 0) {
      res
        .status(400)
        .json({ error: `Rate must be greater than 0 at row ${index + 1}.` });
      return;
    }
    if (type === "MATERIAL" && !articleId) {
      res
        .status(400)
        .json({ error: `Article is required for material row ${index + 1}.` });
      return;
    }

    normalizedRows.push({
      type,
      quantity,
      rate,
      articleId,
      totalAmount: quantity * rate,
    });
  }

  const grossTotal = normalizedRows.reduce(
    (sum, row) => sum + row.totalAmount,
    0,
  );
  const dbPurchasePaymentType = "CREDIT";

  const result = await prisma
    .$transaction(async (tx) => {
      const party = await tx.party.findUnique({ where: { id: partyId } });
      if (!party || party.deletedAt || party.type !== "SUPPLIER") {
        throw new Error("Selected party must be a supplier.");
      }

      const created = [];
      for (const row of normalizedRows) {
        if (row.type === "CHEMICAL") {
          const purchase = await tx.chemicalPurchase.create({
            data: {
              date: toDate(date, "start"),
              partyId,
              quantityKg: row.quantity,
              ratePerKg: row.rate,
              totalAmount: row.totalAmount,
              paymentType: dbPurchasePaymentType,
            },
          });

          if (isKhata(purchase.paymentType)) {
            await tx.partyLedgerEntry.create({
              data: {
                partyId,
                date: purchase.date,
                reference: "Chemical Purchase",
                description: req.body.description,
                balance: -Number(purchase.totalAmount),
                chemicalPurchaseId: purchase.id,
              },
            });
          }

          created.push({ type: "CHEMICAL", id: purchase.id });
          continue;
        }

        if (row.type === "REXINE") {
          const purchase = await tx.rexinePurchase.create({
            data: {
              date: toDate(date, "start"),
              partyId,
              quantityMeter: row.quantity,
              ratePerMeter: row.rate,
              totalAmount: row.totalAmount,
              paymentType: dbPurchasePaymentType,
            },
          });

          if (isKhata(purchase.paymentType)) {
            await tx.partyLedgerEntry.create({
              data: {
                partyId,
                date: purchase.date,
                reference: "Rexine Purchase",
                description: req.body.description,
                balance: -Number(purchase.totalAmount),
                rexinePurchaseId: purchase.id,
              },
            });
          }

          created.push({ type: "REXINE", id: purchase.id });
          continue;
        }

        const purchase = await tx.materialPurchase.create({
          data: {
            date: toDate(date, "start"),
            partyId,
            articleId: row.articleId,
            quantity: row.quantity,
            pricePerUnit: row.rate,
            totalAmount: row.totalAmount,
            paymentType: dbPurchasePaymentType,
          },
        });

        if (isKhata(purchase.paymentType)) {
          await tx.partyLedgerEntry.create({
            data: {
              partyId,
              date: purchase.date,
              reference: "Material Purchase",
              description: req.body.description,
              balance: -Number(purchase.totalAmount),
              materialPurchaseId: purchase.id,
            },
          });
        }

        created.push({ type: "MATERIAL", id: purchase.id });
      }

      return {
        grossTotal,
        amountPaid: 0,
        paymentType: "KHATA",
        created,
      };
    })
    .catch((error) => {
      res
        .status(400)
        .json({ error: error.message ?? "Failed to save purchases." });
      return null;
    });

  if (!result) return;
  res.status(201).json(result);
};

export const createChemicalPurchase = async (req, res) => {
  const { date, partyId, quantityKg, ratePerKg, totalAmount, paymentType } =
    req.body;

  const result = await prisma.$transaction(async (tx) => {
    const purchase = await tx.chemicalPurchase.create({
      data: {
        date: toDate(date, "start"),
        partyId,
        quantityKg,
        ratePerKg,
        totalAmount,
        paymentType: toDbPaymentType(paymentType ?? "CASH"),
      },
    });

    const expense = await tx.expenseEntry.create({
      data: {
        date: toDate(date, "start"),
        partyId,
        module: "CHEMICAL",
        paymentType: purchase.paymentType,
        amount: totalAmount,
        description: req.body.description,
        chemicalPurchaseId: purchase.id,
        source: "SYSTEM",
        sourceSystem: "CHEMICAL_PURCHASE",
      },
    });

    if (purchase.partyId && isKhata(purchase.paymentType)) {
      await tx.partyLedgerEntry.create({
        data: {
          partyId: purchase.partyId,
          date: purchase.date,
          reference: "Chemical Purchase",
          description: req.body.description,
          balance: -Number(purchase.totalAmount),
          chemicalPurchaseId: purchase.id,
        },
      });
    }

    return { purchase, expense };
  });

  res.status(201).json(result);
};

export const listChemicalPurchases = async (req, res) => {
  const purchases = await prisma.chemicalPurchase.findMany({
    where: resolveDeletedWhere(req.query.deleted),
    include: { party: true, expenses: true },
    orderBy: { date: "desc" },
  });
  res.json(purchases);
};

export const updateChemicalPurchase = async (req, res) => {
  const purchase = await prisma.$transaction(async (tx) => {
    const updated = await tx.chemicalPurchase.update({
      where: { id: req.params.purchaseId },
      data: {
        date: req.body.date ? toDate(req.body.date, "start") : undefined,
        partyId: req.body.partyId,
        quantityKg: req.body.quantityKg,
        ratePerKg: req.body.ratePerKg,
        totalAmount: req.body.totalAmount,
        paymentType: toDbPaymentType(req.body.paymentType),
      },
    });

    await tx.expenseEntry.updateMany({
      where: { chemicalPurchaseId: updated.id },
      data: {
        date: req.body.date ? toDate(req.body.date, "start") : undefined,
        partyId: req.body.partyId,
        paymentType: updated.paymentType,
        amount: req.body.totalAmount,
        description: req.body.description,
      },
    });

    const existingLedger = await tx.partyLedgerEntry.findFirst({
      where: { chemicalPurchaseId: updated.id },
    });

    if (updated.partyId && isKhata(updated.paymentType)) {
      if (existingLedger) {
        await tx.partyLedgerEntry.update({
          where: { id: existingLedger.id },
          data: {
            partyId: updated.partyId,
            date: updated.date,
            reference: "Chemical Purchase",
            description: req.body.description,
            balance: -Number(updated.totalAmount),
          },
        });
      } else {
        await tx.partyLedgerEntry.create({
          data: {
            partyId: updated.partyId,
            date: updated.date,
            reference: "Chemical Purchase",
            description: req.body.description,
            balance: -Number(updated.totalAmount),
            chemicalPurchaseId: updated.id,
          },
        });
      }
    } else if (existingLedger) {
      await tx.partyLedgerEntry.update({
        where: { id: existingLedger.id },
        data: { deletedAt: new Date() },
      });
    }

    return tx.chemicalPurchase.findUnique({
      where: { id: updated.id },
      include: { party: true, expenses: true },
    });
  });

  res.json(purchase);
};

export const deleteChemicalPurchase = async (req, res) => {
  await prisma.$transaction(async (tx) => {
    const deletedAt = new Date();
    await tx.partyLedgerEntry.updateMany({
      where: { chemicalPurchaseId: req.params.purchaseId, deletedAt: null },
      data: { deletedAt },
    });
    await tx.expenseEntry.updateMany({
      where: { chemicalPurchaseId: req.params.purchaseId, deletedAt: null },
      data: { deletedAt },
    });
    await tx.chemicalPurchase.update({
      where: { id: req.params.purchaseId },
      data: { deletedAt },
    });
  });
  res.status(204).end();
};

export const restoreChemicalPurchase = async (req, res) => {
  const purchase = await prisma.$transaction(async (tx) => {
    await tx.chemicalPurchase.update({
      where: { id: req.params.purchaseId },
      data: { deletedAt: null },
    });
    await tx.partyLedgerEntry.updateMany({
      where: { chemicalPurchaseId: req.params.purchaseId },
      data: { deletedAt: null },
    });
    await tx.expenseEntry.updateMany({
      where: { chemicalPurchaseId: req.params.purchaseId },
      data: { deletedAt: null },
    });
    return tx.chemicalPurchase.findUnique({
      where: { id: req.params.purchaseId },
      include: { party: true, expenses: true },
    });
  });

  res.json(purchase);
};

export const createRexinePurchase = async (req, res) => {
  const {
    date,
    partyId,
    quantityMeter,
    ratePerMeter,
    totalAmount,
    paymentType,
  } = req.body;

  const result = await prisma.$transaction(async (tx) => {
    const purchase = await tx.rexinePurchase.create({
      data: {
        date: toDate(date, "start"),
        partyId,
        quantityMeter,
        ratePerMeter,
        totalAmount,
        paymentType: toDbPaymentType(paymentType ?? "CASH"),
      },
    });

    const expense = await tx.expenseEntry.create({
      data: {
        date: toDate(date, "start"),
        partyId,
        module: "REXINE",
        paymentType: purchase.paymentType,
        amount: totalAmount,
        description: req.body.description,
        rexinePurchaseId: purchase.id,
        source: "SYSTEM",
        sourceSystem: "REXINE_PURCHASE",
      },
    });

    if (purchase.partyId && isKhata(purchase.paymentType)) {
      await tx.partyLedgerEntry.create({
        data: {
          partyId: purchase.partyId,
          date: purchase.date,
          reference: "Rexine Purchase",
          description: req.body.description,
          balance: -Number(purchase.totalAmount),
          rexinePurchaseId: purchase.id,
        },
      });
    }

    return { purchase, expense };
  });

  res.status(201).json(result);
};

export const listRexinePurchases = async (req, res) => {
  const purchases = await prisma.rexinePurchase.findMany({
    where: resolveDeletedWhere(req.query.deleted),
    include: { party: true, expenses: true },
    orderBy: { date: "desc" },
  });
  res.json(purchases);
};

export const updateRexinePurchase = async (req, res) => {
  const purchase = await prisma.$transaction(async (tx) => {
    const updated = await tx.rexinePurchase.update({
      where: { id: req.params.purchaseId },
      data: {
        date: req.body.date ? toDate(req.body.date, "start") : undefined,
        partyId: req.body.partyId,
        quantityMeter: req.body.quantityMeter,
        ratePerMeter: req.body.ratePerMeter,
        totalAmount: req.body.totalAmount,
        paymentType: toDbPaymentType(req.body.paymentType),
      },
    });

    await tx.expenseEntry.updateMany({
      where: { rexinePurchaseId: updated.id },
      data: {
        date: req.body.date ? toDate(req.body.date, "start") : undefined,
        partyId: req.body.partyId,
        paymentType: updated.paymentType,
        amount: req.body.totalAmount,
        description: req.body.description,
      },
    });

    const existingLedger = await tx.partyLedgerEntry.findFirst({
      where: { rexinePurchaseId: updated.id },
    });

    if (updated.partyId && isKhata(updated.paymentType)) {
      if (existingLedger) {
        await tx.partyLedgerEntry.update({
          where: { id: existingLedger.id },
          data: {
            partyId: updated.partyId,
            date: updated.date,
            reference: "Rexine Purchase",
            description: req.body.description,
            balance: -Number(updated.totalAmount),
          },
        });
      } else {
        await tx.partyLedgerEntry.create({
          data: {
            partyId: updated.partyId,
            date: updated.date,
            reference: "Rexine Purchase",
            description: req.body.description,
            balance: -Number(updated.totalAmount),
            rexinePurchaseId: updated.id,
          },
        });
      }
    } else if (existingLedger) {
      await tx.partyLedgerEntry.update({
        where: { id: existingLedger.id },
        data: { deletedAt: new Date() },
      });
    }

    return tx.rexinePurchase.findUnique({
      where: { id: updated.id },
      include: { party: true, expenses: true },
    });
  });

  res.json(purchase);
};

export const deleteRexinePurchase = async (req, res) => {
  await prisma.$transaction(async (tx) => {
    const deletedAt = new Date();
    await tx.partyLedgerEntry.updateMany({
      where: { rexinePurchaseId: req.params.purchaseId, deletedAt: null },
      data: { deletedAt },
    });
    await tx.expenseEntry.updateMany({
      where: { rexinePurchaseId: req.params.purchaseId, deletedAt: null },
      data: { deletedAt },
    });
    await tx.rexinePurchase.update({
      where: { id: req.params.purchaseId },
      data: { deletedAt },
    });
  });
  res.status(204).end();
};

export const restoreRexinePurchase = async (req, res) => {
  const purchase = await prisma.$transaction(async (tx) => {
    await tx.rexinePurchase.update({
      where: { id: req.params.purchaseId },
      data: { deletedAt: null },
    });
    await tx.partyLedgerEntry.updateMany({
      where: { rexinePurchaseId: req.params.purchaseId },
      data: { deletedAt: null },
    });
    await tx.expenseEntry.updateMany({
      where: { rexinePurchaseId: req.params.purchaseId },
      data: { deletedAt: null },
    });
    return tx.rexinePurchase.findUnique({
      where: { id: req.params.purchaseId },
      include: { party: true, expenses: true },
    });
  });

  res.json(purchase);
};

export const createMaterialPurchase = async (req, res) => {
  const {
    date,
    partyId,
    articleId,
    unitId,
    quantity,
    pricePerUnit,
    totalAmount,
    paymentType,
  } = req.body;

  const result = await prisma.$transaction(async (tx) => {
    const purchase = await tx.materialPurchase.create({
      data: {
        date: toDate(date, "start"),
        partyId,
        articleId,
        unitId,
        quantity,
        pricePerUnit,
        totalAmount,
        paymentType: toDbPaymentType(paymentType ?? "CASH"),
      },
    });

    const expense = await tx.expenseEntry.create({
      data: {
        date: toDate(date, "start"),
        partyId,
        module: "MATERIAL",
        paymentType: purchase.paymentType,
        amount: totalAmount,
        description: req.body.description,
        materialPurchaseId: purchase.id,
        source: "SYSTEM",
        sourceSystem: "MATERIAL_PURCHASE",
      },
    });

    if (purchase.partyId && isKhata(purchase.paymentType)) {
      await tx.partyLedgerEntry.create({
        data: {
          partyId: purchase.partyId,
          date: purchase.date,
          reference: "Material Purchase",
          description: req.body.description,
          balance: -Number(purchase.totalAmount),
          materialPurchaseId: purchase.id,
        },
      });
    }

    return { purchase, expense };
  });

  res.status(201).json(result);
};

export const listMaterialPurchases = async (req, res) => {
  const purchases = await prisma.materialPurchase.findMany({
    where: resolveDeletedWhere(req.query.deleted),
    include: { party: true, article: true, unit: true, expenses: true },
    orderBy: { date: "desc" },
  });
  res.json(purchases);
};

export const updateMaterialPurchase = async (req, res) => {
  const purchase = await prisma.$transaction(async (tx) => {
    const updated = await tx.materialPurchase.update({
      where: { id: req.params.purchaseId },
      data: {
        date: req.body.date ? toDate(req.body.date, "start") : undefined,
        partyId: req.body.partyId,
        articleId: req.body.articleId,
        unitId: req.body.unitId,
        quantity: req.body.quantity,
        pricePerUnit: req.body.pricePerUnit,
        totalAmount: req.body.totalAmount,
        paymentType: toDbPaymentType(req.body.paymentType),
      },
    });

    await tx.expenseEntry.updateMany({
      where: { materialPurchaseId: updated.id },
      data: {
        date: req.body.date ? toDate(req.body.date, "start") : undefined,
        partyId: req.body.partyId,
        paymentType: updated.paymentType,
        amount: req.body.totalAmount,
        description: req.body.description,
      },
    });

    const existingLedger = await tx.partyLedgerEntry.findFirst({
      where: { materialPurchaseId: updated.id },
    });

    if (updated.partyId && isKhata(updated.paymentType)) {
      if (existingLedger) {
        await tx.partyLedgerEntry.update({
          where: { id: existingLedger.id },
          data: {
            partyId: updated.partyId,
            date: updated.date,
            reference: "Material Purchase",
            description: req.body.description,
            balance: -Number(updated.totalAmount),
          },
        });
      } else {
        await tx.partyLedgerEntry.create({
          data: {
            partyId: updated.partyId,
            date: updated.date,
            reference: "Material Purchase",
            description: req.body.description,
            balance: -Number(updated.totalAmount),
            materialPurchaseId: updated.id,
          },
        });
      }
    } else if (existingLedger) {
      await tx.partyLedgerEntry.update({
        where: { id: existingLedger.id },
        data: { deletedAt: new Date() },
      });
    }

    return tx.materialPurchase.findUnique({
      where: { id: updated.id },
      include: { party: true, article: true, unit: true, expenses: true },
    });
  });

  res.json(purchase);
};

export const deleteMaterialPurchase = async (req, res) => {
  await prisma.$transaction(async (tx) => {
    const deletedAt = new Date();
    await tx.partyLedgerEntry.updateMany({
      where: { materialPurchaseId: req.params.purchaseId, deletedAt: null },
      data: { deletedAt },
    });
    await tx.expenseEntry.updateMany({
      where: { materialPurchaseId: req.params.purchaseId, deletedAt: null },
      data: { deletedAt },
    });
    await tx.materialPurchase.update({
      where: { id: req.params.purchaseId },
      data: { deletedAt },
    });
  });
  res.status(204).end();
};

export const restoreMaterialPurchase = async (req, res) => {
  const purchase = await prisma.$transaction(async (tx) => {
    await tx.materialPurchase.update({
      where: { id: req.params.purchaseId },
      data: { deletedAt: null },
    });
    await tx.partyLedgerEntry.updateMany({
      where: { materialPurchaseId: req.params.purchaseId },
      data: { deletedAt: null },
    });
    await tx.expenseEntry.updateMany({
      where: { materialPurchaseId: req.params.purchaseId },
      data: { deletedAt: null },
    });
    return tx.materialPurchase.findUnique({
      where: { id: req.params.purchaseId },
      include: { party: true, article: true, unit: true, expenses: true },
    });
  });

  res.json(purchase);
};
