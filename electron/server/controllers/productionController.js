import prisma from "../prisma.js";
import {
  LABOR_DEPARTMENT_IDS,
  normalizeLaborDepartment,
} from "../constants/laborDepartments.js";
import {
  getLaborDepartmentLabelFromMap,
  getLaborDepartmentLabelMap,
} from "../services/laborDepartmentService.js";
import { createSystemRoznamchaEntry } from "../utils/roznamcha.js";
import {
  getPackedStockSnapshot,
  normalizeMallStockType,
  normalizeSize,
  normalizeStockMovementDirection,
  toNumber,
} from "../services/stockService.js";
import { formatDateTime, toDate } from "../utils/date.js";
import {
  formatPrintNumber,
  getPrintDirection,
  getPrintFontFamily,
  getPrintLocale,
  getPrintTextAlign,
  normalizePrintLanguage,
  translatePrintText,
} from "../utils/printLanguage.js";

const STAGE_BY_DEPARTMENT = {
  PRESSMAN: "STAGE_PRESSMAN",
  UPPERMAN: "STAGE_UPPERMAN",
  PRINTING: "STAGE_PRINTING",
  DC: "STAGE_DC",
  MACHINEMAN: "STAGE_MACHINEMAN",
  PACKING: "STAGE_PACKING",
};

const DEPARTMENT_FLOW = [
  "PRESSMAN",
  "UPPERMAN",
  "PRINTING",
  "DC",
  "MACHINEMAN",
];

const MERGED_FINAL_DEPARTMENTS = ["MACHINEMAN", "PACKING"];

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const getAllowedNextDepartments = (department) => {
  const currentIndex = DEPARTMENT_FLOW.indexOf(department);
  if (currentIndex === -1) return [];
  return DEPARTMENT_FLOW.slice(currentIndex + 1);
};

const computeStatus = (completedDozen, quantityDozen) => {
  if (completedDozen <= 0) return "INCOMPLETE";
  if (completedDozen >= quantityDozen) return "COMPLETE";
  return "PARTIALLY_COMPLETE";
};

const statusLabel = (status, language = "en") => {
  if (status === "PARTIALLY_COMPLETE") {
    return translatePrintText("Partially Complete", language);
  }
  if (status === "COMPLETE") return translatePrintText("Complete", language);
  return translatePrintText("Incomplete", language);
};

const formatRateValue = (value) => {
  const numericValue = toNumber(value);
  return String(Number(numericValue.toFixed(4)));
};

const toDisplayDepartmentPrice = (department, pricePerDozen) => {
  if (department === "UPPERMAN") {
    return formatRateValue(toNumber(pricePerDozen) / 12);
  }
  return formatRateValue(pricePerDozen);
};

const getOrderProgressDozen = (order) => {
  const aMall = toNumber(order.completedDozen);
  if (!MERGED_FINAL_DEPARTMENTS.includes(order.department)) return aMall;
  return aMall + toNumber(order.bMallDozen) + toNumber(order.cMallDozen);
};

const toApiOrder = (order, labelMap) => {
  const quantityDozen = toNumber(order.quantityDozen);
  const completedDozen = toNumber(order.completedDozen);
  const bMallDozen = toNumber(order.bMallDozen);
  const cMallDozen = toNumber(order.cMallDozen);
  const forwardedDozen = toNumber(order.forwardedDozen);
  const progressDozen = getOrderProgressDozen(order);
  return {
    ...order,
    departmentLabel: getLaborDepartmentLabelFromMap(order.department, labelMap),
    quantityDozen,
    completedDozen,
    bMallDozen,
    cMallDozen,
    forwardedDozen,
    pricePerDozen: toNumber(order.pricePerDozen),
    packingPricePerDozen: toNumber(order.packingPricePerDozen),
    status: computeStatus(progressDozen, quantityDozen),
  };
};

const normalizeStockMode = (value, fallback = "IN_STOCK") => {
  const normalized = String(value ?? fallback).toUpperCase();
  return normalized === "PACKED" ? "PACKED" : fallback;
};

const createOrExpandQueueOrder = async (
  tx,
  { department, articleId, size, quantityDozen, source, pricePerDozen = 0 },
) => {
  if (quantityDozen <= 0) return;

  const where = {
    department,
    articleId,
    size,
    laborId: null,
    isClosed: false,
    ...(source ? { source } : {}),
  };

  const existing = await tx.productionOrder.findFirst({
    where,
    orderBy: { createdAt: "asc" },
  });

  if (existing) {
    await tx.productionOrder.update({
      where: { id: existing.id },
      data: {
        quantityDozen: toNumber(existing.quantityDozen) + quantityDozen,
      },
    });
    return;
  }

  await tx.productionOrder.create({
    data: {
      department,
      stage: STAGE_BY_DEPARTMENT[department],
      articleId,
      size,
      quantityDozen,
      pricePerDozen,
      completedDozen: 0,
      forwardedDozen: 0,
      source: source ?? "STAGE_FLOW",
      laborId: null,
      isClosed: false,
    },
  });
};

const assertDepartmentLaborMatch = async (department, laborId) => {
  if (!laborId) return;
  const labor = await prisma.laborProfile.findUnique({
    where: { id: laborId },
    select: { id: true, department: true, status: true },
  });
  if (!labor || labor.status !== "ACTIVE") {
    throw new Error("Selected labor is not active.");
  }
  if (labor.department !== department) {
    throw new Error("Selected labor does not belong to this department.");
  }
};

export const listProductionOrders = async (req, res) => {
  const departmentQuery = req.query.department
    ? normalizeLaborDepartment(req.query.department, "")
    : "";

  const [rows, labelMap] = await Promise.all([
    prisma.productionOrder.findMany({
      where: {
        ...(departmentQuery ? { department: departmentQuery } : {}),
        isClosed: false,
      },
      include: {
        article: true,
        labor: true,
        packingLabor: true,
      },
      orderBy: [{ orderDate: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }],
    }),
    getLaborDepartmentLabelMap(),
  ]);

  res.json(
    rows
      .map((row) => toApiOrder(row, labelMap))
      .filter((row) => getOrderProgressDozen(row) < row.quantityDozen),
  );
};

export const getPrintableProductionOrders = async (req, res) => {
  const language = normalizePrintLanguage(req.query.lang);
  const [rows, labelMap] = await Promise.all([
    prisma.productionOrder.findMany({
      where: {
        isClosed: false,
      },
      include: {
        article: true,
        labor: true,
        packingLabor: true,
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    }),
    getLaborDepartmentLabelMap(),
  ]);

  const apiRows = rows
    .map((row) => toApiOrder(row, labelMap))
    .filter((row) => getOrderProgressDozen(row) < Number(row.quantityDozen));

  const sectionDepartments = DEPARTMENT_FLOW;
  const direction = getPrintDirection(language);
  const textAlign = getPrintTextAlign(language);
  const fontFamily = getPrintFontFamily(language);
  const languageCode = language === "ur" ? "ur" : "en";
  const title = translatePrintText("Production Control Orders", language);

  const sectionHtml = sectionDepartments
    .map((department) => {
      const departmentLabel = translatePrintText(
        getLaborDepartmentLabelFromMap(department, labelMap),
        language,
      );
      const sectionRows = apiRows.filter((row) => {
        const belongsToMergedFinal =
          department === "MACHINEMAN" &&
          MERGED_FINAL_DEPARTMENTS.includes(row.department);
        return row.department === department || belongsToMergedFinal;
      });

      const rowHtml = sectionRows
          .map((row) => {
            const laborText = MERGED_FINAL_DEPARTMENTS.includes(department)
              ? `${row.labor?.name || "-"} / ${row.packingLabor?.name || "-"}`
              : row.labor?.name || "-";
            const priceText = MERGED_FINAL_DEPARTMENTS.includes(department)
              ? `${formatPrintNumber(formatRateValue(row.pricePerDozen), language, {
                  maximumFractionDigits: 4,
                })} / ${formatPrintNumber(
                  formatRateValue(row.packingPricePerDozen),
                  language,
                  {
                    maximumFractionDigits: 4,
                  },
                )}`
              : formatPrintNumber(
                  toDisplayDepartmentPrice(department, row.pricePerDozen),
                  language,
                  {
                    maximumFractionDigits: 4,
                  },
                );

            return `
            <tr>
              <td>${escapeHtml(row.article?.name || "-")}</td>
              <td>${escapeHtml(row.size || "-")}</td>
              <td>${escapeHtml(laborText)}</td>
              <td>${escapeHtml(formatPrintNumber(row.quantityDozen, language))}</td>
              <td>${escapeHtml(priceText)}</td>
              <td>${escapeHtml(formatPrintNumber(row.completedDozen, language))}</td>
              <td>${escapeHtml(statusLabel(row.status, language))}</td>
            </tr>`;
          })
          .join("");

      return `
        <section class="section">
          <h2>${escapeHtml(departmentLabel)} ${escapeHtml(
            translatePrintText("Orders", language),
          )}</h2>
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(translatePrintText("Article", language))}</th>
                <th>${escapeHtml(translatePrintText("Size", language))}</th>
                <th>${escapeHtml(translatePrintText("Labor", language))}</th>
                <th>${escapeHtml(
                  translatePrintText("Quantity (Dozen)", language),
                )}</th>
                <th>${escapeHtml(
                  translatePrintText(
                    department === "UPPERMAN"
                      ? "Price / Pair"
                      : "Price / Dozen",
                    language,
                  ),
                )}</th>
                <th>${escapeHtml(
                  translatePrintText(
                    MERGED_FINAL_DEPARTMENTS.includes(department)
                      ? "A-Mall Qty"
                      : "Completed Qty",
                    language,
                  ),
                )}</th>
                <th>${escapeHtml(translatePrintText("Status", language))}</th>
              </tr>
            </thead>
            <tbody>
              ${rowHtml || `<tr><td colspan="7">${escapeHtml(translatePrintText("No orders in this subsection.", language))}</td></tr>`}
            </tbody>
          </table>
        </section>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
  <html lang="${languageCode}" dir="${direction}">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(title)}</title>
      <style>
        body { font-family: ${fontFamily}; padding: 18px; color: #111; direction: ${direction}; text-align: ${textAlign}; }
        h1 { margin: 0 0 8px; font-size: 22px; }
        h2 { margin: 18px 0 8px; font-size: 17px; }
        .meta { margin-bottom: 14px; font-size: 13px; }
        .meta p { margin: 3px 0; }
        .section { margin-bottom: 16px; break-inside: avoid; page-break-inside: avoid; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #d4d4d4; padding: 7px; text-align: ${textAlign}; font-size: 12px; }
        th { background: #f5f5f5; }
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
        <p><strong>${escapeHtml(translatePrintText("Total Rows", language))}:</strong> ${apiRows.length}</p>
      </div>
      ${sectionHtml}
      <script>window.onload = () => { window.focus(); window.print(); };</script>
    </body>
  </html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
};

export const getPrintableDailyPressmanOrders = async (req, res) => {
  const language = normalizePrintLanguage(req.query.lang);
  const dateStr = req.query.date;
  if (!dateStr) {
    res.status(400).json({ error: "Date query parameter is required." });
    return;
  }

  // Parse start and end of the specified date to filter `orderDate`
  const startOfDay = toDate(dateStr, "start");
  const endOfDayValue = toDate(dateStr, "end");

  const [rows, labelMap] = await Promise.all([
    prisma.productionOrder.findMany({
      where: {
        department: "PRESSMAN",
        isClosed: false,
        orderDate: {
          gte: startOfDay,
          lte: endOfDayValue,
        },
      },
      include: {
        article: true,
        labor: true,
        packingLabor: true,
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    }),
    getLaborDepartmentLabelMap(),
  ]);

  const apiRows = rows
    .map((row) => toApiOrder(row, labelMap))
    .filter((row) => getOrderProgressDozen(row) < Number(row.quantityDozen));

  const rowHtml = apiRows
    .map((row) => {
      const laborText = row.labor?.name || "-";
      return `
        <tr>
          <td>${escapeHtml(row.article?.name || "-")}</td>
          <td>${escapeHtml(row.size || "-")}</td>
          <td>${escapeHtml(laborText)}</td>
          <td>${escapeHtml(formatPrintNumber(row.quantityDozen, language))}</td>
          <td>${escapeHtml(
            formatPrintNumber(row.pricePerDozen, language, {
              maximumFractionDigits: 4,
            }),
          )}</td>
          <td>${escapeHtml(formatPrintNumber(row.completedDozen, language))}</td>
          <td>${escapeHtml(statusLabel(row.status, language))}</td>
        </tr>`;
    })
    .join("");

  const formattedDate = formatDateTime(
    startOfDay,
    getPrintLocale(language, "date"),
    {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  );
  const direction = getPrintDirection(language);
  const textAlign = getPrintTextAlign(language);
  const fontFamily = getPrintFontFamily(language);
  const languageCode = language === "ur" ? "ur" : "en";
  const title = translatePrintText("Pressman Orders", language);

  const sectionHtml = `
    <section class="section">
      <table>
        <thead>
          <tr>
            <th>${escapeHtml(translatePrintText("Article", language))}</th>
            <th>${escapeHtml(translatePrintText("Size", language))}</th>
            <th>${escapeHtml(translatePrintText("Labor", language))}</th>
            <th>${escapeHtml(translatePrintText("Quantity (Dozen)", language))}</th>
            <th>${escapeHtml(translatePrintText("Price / Dozen", language))}</th>
            <th>${escapeHtml(translatePrintText("Completed Qty", language))}</th>
            <th>${escapeHtml(translatePrintText("Status", language))}</th>
          </tr>
        </thead>
        <tbody>
          ${rowHtml || `<tr><td colspan="7">${escapeHtml(translatePrintText("No pressman orders for this date.", language))}</td></tr>`}
        </tbody>
      </table>
    </section>`;

  const html = `<!DOCTYPE html>
  <html lang="${languageCode}" dir="${direction}">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(title)} - ${escapeHtml(formattedDate)}</title>
      <style>
        body { font-family: ${fontFamily}; padding: 18px; color: #111; direction: ${direction}; text-align: ${textAlign}; }
        h1 { margin: 0 0 8px; font-size: 22px; }
        h2 { margin: 18px 0 8px; font-size: 17px; }
        .meta { margin-bottom: 14px; font-size: 13px; }
        .meta p { margin: 3px 0; }
        .section { margin-bottom: 16px; break-inside: avoid; page-break-inside: avoid; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #d4d4d4; padding: 7px; text-align: ${textAlign}; font-size: 12px; }
        th { background: #f5f5f5; }
        @media print { body { padding: 8px; } }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">
        <p><strong>${escapeHtml(translatePrintText("Date", language))}:</strong> ${escapeHtml(formattedDate)}</p>
        <p><strong>${escapeHtml(translatePrintText("Generated At", language))}:</strong> ${escapeHtml(
          formatDateTime(new Date(), getPrintLocale(language, "date"), {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }),
        )}</p>
        <p><strong>${escapeHtml(translatePrintText("Total Rows", language))}:</strong> ${apiRows.length}</p>
      </div>
      ${sectionHtml}
      <script>window.onload = () => { window.focus(); window.print(); };</script>
    </body>
  </html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
};

export const createProductionOrder = async (req, res) => {
  const department = normalizeLaborDepartment(req.body.department);
  const quantityDozen = Math.abs(toNumber(req.body.quantityDozen));
  const pricePerDozen = Math.abs(toNumber(req.body.pricePerDozen));
  const size = String(req.body.size ?? "").trim();
  const orderDate = req.body.orderDate
    ? toDate(req.body.orderDate, "start")
    : new Date();

  if (!req.body.articleId) {
    res.status(400).json({ error: "Article is required." });
    return;
  }
  if (!size) {
    res.status(400).json({ error: "Size is required." });
    return;
  }
  if (quantityDozen <= 0) {
    res.status(400).json({ error: "Quantity must be greater than 0." });
    return;
  }

  await assertDepartmentLaborMatch(department, req.body.laborId).catch(
    (error) => {
      res.status(400).json({ error: error.message });
    },
  );
  if (res.headersSent) return;

  const order = await prisma.productionOrder.create({
    data: {
      department,
      stage: STAGE_BY_DEPARTMENT[department],
      articleId: req.body.articleId,
      size,
      laborId: req.body.laborId || null,
      quantityDozen,
      pricePerDozen,
      completedDozen: 0,
      forwardedDozen: 0,
      orderDate,
      source: "MANUAL",
      isClosed: false,
    },
    include: {
      article: true,
      labor: true,
      packingLabor: true,
    },
  });

  const labelMap = await getLaborDepartmentLabelMap();
  res.status(201).json(toApiOrder(order, labelMap));
};

export const createBulkProductionOrders = async (req, res) => {
  const department = normalizeLaborDepartment(req.body.department);
  const orderDate = req.body.orderDate
    ? toDate(req.body.orderDate, "start")
    : new Date();
  const items = req.body.items;

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "At least one item is required." });
    return;
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.articleId) {
      res.status(400).json({ error: `Item ${i + 1}: Article is required.` });
      return;
    }
    const size = String(item.size ?? "").trim();
    if (!size) {
      res.status(400).json({ error: `Item ${i + 1}: Size is required.` });
      return;
    }
    const quantityDozen = Math.abs(toNumber(item.quantityDozen));
    if (quantityDozen <= 0) {
      res.status(400).json({ error: `Item ${i + 1}: Quantity must be greater than 0.` });
      return;
    }
    if (item.laborId) {
      try {
        await assertDepartmentLaborMatch(department, item.laborId);
      } catch (error) {
        res.status(400).json({ error: `Item ${i + 1}: ${error.message}` });
        return;
      }
    }
  }

  const orders = await prisma.$transaction(async (tx) => {
    const created = [];
    for (const item of items) {
      const size = String(item.size ?? "").trim();
      const quantityDozen = Math.abs(toNumber(item.quantityDozen));
      const pricePerDozen = Math.abs(toNumber(item.pricePerDozen));
      const order = await tx.productionOrder.create({
        data: {
          department,
          stage: STAGE_BY_DEPARTMENT[department],
          articleId: item.articleId,
          size,
          laborId: item.laborId || null,
          quantityDozen,
          pricePerDozen,
          completedDozen: 0,
          forwardedDozen: 0,
          orderDate,
          source: "MANUAL",
          isClosed: false,
        },
        include: {
          article: true,
          labor: true,
          packingLabor: true,
        },
      });
      created.push(order);
    }
    return created;
  });

  const labelMap = await getLaborDepartmentLabelMap();
  res.status(201).json(orders.map((order) => toApiOrder(order, labelMap)));
};

export const updateProductionOrder = async (req, res) => {
  const existing = await prisma.productionOrder.findUnique({
    where: { id: req.params.orderId },
  });
  if (!existing) {
    res.status(404).json({ error: "Order not found." });
    return;
  }

  const quantityDozen =
    req.body.quantityDozen === undefined
      ? undefined
      : Math.abs(toNumber(req.body.quantityDozen));
  const size =
    req.body.size === undefined
      ? undefined
      : String(req.body.size ?? "").trim();
  const pricePerDozen =
    req.body.pricePerDozen === undefined
      ? undefined
      : Math.abs(toNumber(req.body.pricePerDozen));
  if (size !== undefined && !size) {
    res.status(400).json({ error: "Size is required." });
    return;
  }

  const nextQuantity = quantityDozen ?? toNumber(existing.quantityDozen);
  if (nextQuantity <= 0) {
    res.status(400).json({ error: "Quantity must be greater than 0." });
    return;
  }
  const currentProgress = getOrderProgressDozen(existing);
  if (quantityDozen !== undefined && quantityDozen < currentProgress) {
    res.status(400).json({
      error: `Quantity cannot be less than ${currentProgress} dozen already completed.`,
    });
    return;
  }
  const currentForwarded = toNumber(existing.forwardedDozen);
  if (quantityDozen !== undefined && quantityDozen < currentForwarded) {
    res.status(400).json({
      error: `Quantity cannot be less than ${currentForwarded} dozen already forwarded.`,
    });
    return;
  }

  const updated = await prisma.productionOrder.update({
    where: { id: req.params.orderId },
    data: {
      articleId: req.body.articleId,
      size,
      quantityDozen,
      pricePerDozen,
      completedDozen:
        quantityDozen === undefined
          ? undefined
          : Math.min(toNumber(existing.completedDozen), quantityDozen),
      forwardedDozen:
        quantityDozen === undefined
          ? undefined
          : Math.min(toNumber(existing.forwardedDozen), quantityDozen),
    },
    include: {
      article: true,
      labor: true,
      packingLabor: true,
    },
  });

  const labelMap = await getLaborDepartmentLabelMap();
  res.json(toApiOrder(updated, labelMap));
};

export const deleteProductionOrder = async (req, res) => {
  const existing = await prisma.productionOrder.findUnique({
    where: { id: req.params.orderId },
  });
  if (!existing) {
    res.status(404).json({ error: "Order not found." });
    return;
  }

  const progress = getOrderProgressDozen(existing);
  const forwarded = toNumber(existing.forwardedDozen);
  if (progress > 0 || forwarded > 0) {
    res.status(400).json({
      error:
        "Only orders with no completed or forwarded work can be deleted.",
    });
    return;
  }

  await prisma.productionOrder.delete({
    where: { id: req.params.orderId },
  });

  res.status(204).end();
};

export const assignProductionOrderLabor = async (req, res) => {
  const existing = await prisma.productionOrder.findUnique({
    where: { id: req.params.orderId },
  });
  if (!existing) {
    res.status(404).json({ error: "Order not found." });
    return;
  }

  const isMergedFinal = MERGED_FINAL_DEPARTMENTS.includes(existing.department);

  const laborId = req.body.laborId || null;
  const pricePerDozenInput = req.body.pricePerDozen;
  const hasPriceUpdate =
    pricePerDozenInput !== undefined && pricePerDozenInput !== null;
  const normalizedPricePerDozen = hasPriceUpdate
    ? Math.abs(toNumber(pricePerDozenInput))
    : undefined;

  if (!isMergedFinal) {
    if (
      hasPriceUpdate &&
      normalizedPricePerDozen <= 0 &&
      laborId !== null
    ) {
      res.status(400).json({ error: "Price must be greater than 0." });
      return;
    }
    await assertDepartmentLaborMatch(existing.department, laborId).catch(
      (error) => {
        res.status(400).json({ error: error.message });
      },
    );
    if (res.headersSent) return;
  }

  const machinamanLaborIdRaw =
    req.body.machinemanLaborId === undefined
      ? undefined
      : req.body.machinemanLaborId;
  const packingLaborIdRaw =
    req.body.packingLaborId === undefined ? undefined : req.body.packingLaborId;
  const machinamanLaborId =
    machinamanLaborIdRaw === undefined
      ? undefined
      : machinamanLaborIdRaw || null;
  const packingLaborId =
    packingLaborIdRaw === undefined ? undefined : packingLaborIdRaw || null;

  const machinamanPriceInput = req.body.machinemanPricePerDozen;
  const hasMachinemanPriceUpdate =
    machinamanPriceInput !== undefined && machinamanPriceInput !== null;
  const normalizedMachinemanPrice = hasMachinemanPriceUpdate
    ? Math.abs(toNumber(machinamanPriceInput))
    : undefined;

  const packingPriceInput = req.body.packingPricePerDozen;
  const hasPackingPriceUpdate =
    packingPriceInput !== undefined && packingPriceInput !== null;
  const normalizedPackingPrice = hasPackingPriceUpdate
    ? Math.abs(toNumber(packingPriceInput))
    : undefined;

  if (isMergedFinal) {
    if (
      hasMachinemanPriceUpdate &&
      normalizedMachinemanPrice <= 0 &&
      machinamanLaborId !== null
    ) {
      res
        .status(400)
        .json({ error: "Machineman price must be greater than 0." });
      return;
    }
    if (
      hasPackingPriceUpdate &&
      normalizedPackingPrice <= 0 &&
      packingLaborId !== null
    ) {
      res.status(400).json({ error: "Packing price must be greater than 0." });
      return;
    }
    if (machinamanLaborId !== undefined) {
      await assertDepartmentLaborMatch("MACHINEMAN", machinamanLaborId).catch(
        (error) => {
          res.status(400).json({ error: error.message });
        },
      );
      if (res.headersSent) return;
    }
    if (packingLaborId !== undefined) {
      await assertDepartmentLaborMatch("PACKING", packingLaborId).catch(
        (error) => {
          res.status(400).json({ error: error.message });
        },
      );
      if (res.headersSent) return;
    }
  }

  const order = await prisma.productionOrder.update({
    where: { id: req.params.orderId },
    data: {
      laborId:
        isMergedFinal && machinamanLaborId !== undefined
          ? machinamanLaborId
          : laborId,
      pricePerDozen:
        isMergedFinal && hasMachinemanPriceUpdate
          ? normalizedMachinemanPrice
          : hasPriceUpdate
            ? normalizedPricePerDozen
            : undefined,
      packingLaborId:
        isMergedFinal && packingLaborId !== undefined
          ? packingLaborId
          : undefined,
      packingPricePerDozen:
        isMergedFinal && hasPackingPriceUpdate
          ? normalizedPackingPrice
          : undefined,
    },
    include: {
      article: true,
      labor: true,
      packingLabor: true,
    },
  });

  const labelMap = await getLaborDepartmentLabelMap();
  res.json(toApiOrder(order, labelMap));
};

export const updateProductionOrderCompletion = async (req, res) => {
  const completedInput = Math.abs(toNumber(req.body.completedDozen));
  const bMallDeltaInput = Math.abs(toNumber(req.body.bMallDozenDelta));
  const cMallDeltaInput = Math.abs(toNumber(req.body.cMallDozenDelta));
  const upperDozenDeltaInput = Math.abs(toNumber(req.body.upperDozenDelta));
  const ptawaDozenDeltaInput = Math.abs(toNumber(req.body.ptawaDozenDelta));
  const requestedNextDepartmentRaw =
    req.body.nextDepartment == null
      ? ""
      : String(req.body.nextDepartment).trim();
  const requestedNextDepartment = requestedNextDepartmentRaw
    ? normalizeLaborDepartment(requestedNextDepartmentRaw, "")
    : null;
  if (requestedNextDepartmentRaw && !requestedNextDepartment) {
    res.status(400).json({ error: "Invalid next department." });
    return;
  }

  const upperNextDepartmentRaw =
    req.body.upperNextDepartment == null
      ? ""
      : String(req.body.upperNextDepartment).trim();
  const upperNextDepartment = upperNextDepartmentRaw
    ? normalizeLaborDepartment(upperNextDepartmentRaw, "")
    : null;
  if (upperNextDepartmentRaw && !upperNextDepartment) {
    res.status(400).json({ error: "Invalid upper department." });
    return;
  }

  const ptawaNextDepartmentRaw =
    req.body.ptawaNextDepartment == null
      ? ""
      : String(req.body.ptawaNextDepartment).trim();
  const ptawaNextDepartment = ptawaNextDepartmentRaw
    ? normalizeLaborDepartment(ptawaNextDepartmentRaw, "")
    : null;
  if (ptawaNextDepartmentRaw && !ptawaNextDepartment) {
    res.status(400).json({ error: "Invalid ptawa department." });
    return;
  }

  const result = await prisma
    .$transaction(async (tx) => {
      const row = await tx.productionOrder.findUnique({
        where: { id: req.params.orderId },
      });
      if (!row) {
        throw new Error("Order not found.");
      }
      const isMergedFinal = MERGED_FINAL_DEPARTMENTS.includes(row.department);
      if (isMergedFinal) {
        if (!row.laborId || !row.packingLaborId) {
          throw new Error(
            "Assign both Machineman and Packing labors before marking this order done.",
          );
        }
      } else if (!row.laborId) {
        throw new Error("Assign labor before marking this order done.");
      }

      const rowQty = toNumber(row.quantityDozen);
      const rowCompleted = toNumber(row.completedDozen);
      const rowBMall = toNumber(row.bMallDozen);
      const rowCMall = toNumber(row.cMallDozen);
      const rowProgress = getOrderProgressDozen(row);
      const rowForwarded = toNumber(row.forwardedDozen);
      const allowedNextDepartments = getAllowedNextDepartments(row.department);
      const isPressman = row.department === "PRESSMAN";
      const isPrinting = row.department === "PRINTING";
      if (
        !isPressman &&
        requestedNextDepartment &&
        !allowedNextDepartments.includes(requestedNextDepartment)
      ) {
        throw new Error(
          "Selected next department is not valid for this order.",
        );
      }
      if (isPrinting && requestedNextDepartment) {
        throw new Error("Printing done does not allow department assignment.");
      }
      if (isPressman && requestedNextDepartment) {
        throw new Error(
          "Use upper/ptawa department fields for pressman done flow.",
        );
      }
      if (isPressman && bMallDeltaInput > 0) {
        throw new Error("B-mall is not allowed for pressman flow.");
      }
      if (isPressman && cMallDeltaInput > 0) {
        throw new Error("C-mall is not allowed for pressman flow.");
      }
      if (isPressman && upperDozenDeltaInput <= 0) {
        throw new Error("Upper quantity must be greater than 0.");
      }
      if (isPressman && !upperNextDepartment) {
        throw new Error("Upper department is required.");
      }
      if (isPressman && upperNextDepartment === "PRINTING") {
        throw new Error(
          "Upper can be assigned to any department except printing.",
        );
      }
      if (
        isPressman &&
        upperNextDepartment &&
        !allowedNextDepartments.includes(upperNextDepartment)
      ) {
        throw new Error("Selected upper department is not valid.");
      }
      if (
        isPressman &&
        ptawaNextDepartment &&
        ptawaNextDepartment !== "PRINTING"
      ) {
        throw new Error("Ptawa can only be assigned to printing.");
      }

      const clampedCompleted = Math.min(Math.max(completedInput, 0), rowQty);
      if (clampedCompleted < rowCompleted) {
        throw new Error("Completed quantity cannot be reduced.");
      }
      const aMallDelta = Math.max(0, clampedCompleted - rowCompleted);
      const bMallDelta = isMergedFinal ? bMallDeltaInput : 0;
      const cMallDelta = isMergedFinal ? cMallDeltaInput : 0;
      if (!isMergedFinal && (bMallDeltaInput > 0 || cMallDeltaInput > 0)) {
        throw new Error(
          "B-mall and C-mall values are only allowed for Machineman + Packing stage.",
        );
      }

      const progressDelta = aMallDelta + bMallDelta + cMallDelta;
      const remaining = Math.max(rowQty - rowProgress, 0);
      if (!isPressman && progressDelta > remaining) {
        throw new Error(
          `You can mark up to ${remaining} dozen only for this order.`,
        );
      }

      const nextBMall = rowBMall + bMallDelta;
      const nextCMall = rowCMall + cMallDelta;
      const nextProgress = isMergedFinal
        ? clampedCompleted + nextBMall + nextCMall
        : clampedCompleted;

      const patch = {
        completedDozen: clampedCompleted,
        bMallDozen: isMergedFinal ? nextBMall : undefined,
        cMallDozen: isMergedFinal ? nextCMall : undefined,
        isClosed: nextProgress >= rowQty,
        closedAt: nextProgress >= rowQty ? new Date() : null,
      };

      await tx.productionOrder.update({
        where: { id: row.id },
        data: patch,
      });

      if (aMallDelta > 0 && row.laborId) {
        const baseRatePerDozen = toNumber(row.pricePerDozen);
        const isUpperman = row.department === "UPPERMAN";
        const quantity = isUpperman ? aMallDelta * 12 : aMallDelta;
        const rate = isUpperman ? baseRatePerDozen / 12 : baseRatePerDozen;

        await tx.laborWorkEntry.create({
          data: {
            laborId: row.laborId,
            articleId: row.articleId,
            startDate: new Date(),
            endDate: new Date(),
            quantity,
            rate,
            total: quantity * rate,
          },
        });

        if (isMergedFinal && row.packingLaborId) {
          const packingRatePerDozen = toNumber(row.packingPricePerDozen);
          if (packingRatePerDozen > 0) {
            await tx.laborWorkEntry.create({
              data: {
                laborId: row.packingLaborId,
                articleId: row.articleId,
                startDate: new Date(),
                endDate: new Date(),
                quantity: aMallDelta,
                rate: packingRatePerDozen,
                total: aMallDelta * packingRatePerDozen,
              },
            });
          }
        }
      }

      const releasable = Math.max(0, clampedCompleted - rowForwarded);
      if (isPressman) {
        const upperForwarded = upperNextDepartment ? upperDozenDeltaInput : 0;
        const ptawaForwarded =
          ptawaNextDepartment === "PRINTING" ? ptawaDozenDeltaInput : 0;

        if (upperForwarded > 0) {
          await createOrExpandQueueOrder(tx, {
            department: upperNextDepartment,
            articleId: row.articleId,
            size: row.size,
            quantityDozen: upperForwarded,
            source: "STAGE_FLOW",
          });
        }

        if (ptawaForwarded > 0) {
          await createOrExpandQueueOrder(tx, {
            department: "PRINTING",
            articleId: row.articleId,
            size: row.size,
            quantityDozen: ptawaForwarded,
            source: "STAGE_FLOW",
          });
        }

        const forwardedIncrement = upperForwarded + ptawaForwarded;
        if (forwardedIncrement > 0) {
          await tx.productionOrder.update({
            where: { id: row.id },
            data: { forwardedDozen: rowForwarded + forwardedIncrement },
          });
        }
      } else if (requestedNextDepartment && releasable > 0) {
        await createOrExpandQueueOrder(tx, {
          department: requestedNextDepartment,
          articleId: row.articleId,
          size: row.size,
          quantityDozen: releasable,
          source: "STAGE_FLOW",
        });
        await tx.productionOrder.update({
          where: { id: row.id },
          data: { forwardedDozen: clampedCompleted },
        });
      }

      return tx.productionOrder.findUnique({
        where: { id: row.id },
        include: {
          article: true,
          labor: true,
          packingLabor: true,
        },
      });
    })
    .catch((error) => {
      res
        .status(400)
        .json({ error: error.message ?? "Failed to update completion." });
      return null;
    });

  if (!result) return;
  const labelMap = await getLaborDepartmentLabelMap();
  res.json(toApiOrder(result, labelMap));
};

export const getStockSummary = async (req, res) => {
  const [{ packedAMallDozen, packedBMallDozen, packedCMallDozen }, orders, stockEntries] =
    await Promise.all([
      getPackedStockSnapshot(prisma),
    prisma.productionOrder.findMany({
      select: {
        department: true,
        quantityDozen: true,
        completedDozen: true,
        bMallDozen: true,
        cMallDozen: true,
        forwardedDozen: true,
        isClosed: true,
      },
    }),
    prisma.stockEntry.findMany({
      select: {
        mode: true,
        quantityDozen: true,
      },
    }),
    ]);

  let wipDozen = 0;
  let readyStockDozen = 0;
  let activeOrders = 0;

  for (const row of orders) {
    const quantity = toNumber(row.quantityDozen);
    const completed = toNumber(row.completedDozen);
    const bMall = toNumber(row.bMallDozen);
    const cMall = toNumber(row.cMallDozen);
    const progress = MERGED_FINAL_DEPARTMENTS.includes(row.department)
      ? completed + bMall + cMall
      : completed;
    if (!row.isClosed && progress < quantity) {
      activeOrders += 1;
    }
    wipDozen += Math.max(quantity - progress, 0);

    if (MERGED_FINAL_DEPARTMENTS.includes(row.department)) {
      readyStockDozen += Math.max(quantity - progress, 0);
    }
  }

  for (const entry of stockEntries) {
    const quantity = toNumber(entry.quantityDozen);
    if (entry.mode !== "PACKED") {
      readyStockDozen += quantity;
    }
  }

  const packedStockDozen =
    packedAMallDozen + packedBMallDozen + packedCMallDozen;

  res.json({
    activeOrders,
    wipDozen,
    readyStockDozen,
    packedStockDozen,
    packedAMallDozen,
    packedBMallDozen,
    packedCMallDozen,
  });
};

export const listStockByArticle = async (req, res) => {
  const mode = normalizeStockMode(req.query.mode);
  const search = String(req.query.q ?? "")
    .trim()
    .toLowerCase();
  const isPackedMode = mode === "PACKED";

  if (isPackedMode) {
    const excludeBillId = String(req.query.excludeBillId ?? "").trim() || null;
    const { packedRows } = await getPackedStockSnapshot(prisma, {
      excludeBillId,
    });

    const rows = packedRows.filter((row) => {
      if (!search) return true;
      const haystack =
        `${row.articleName} ${row.size} ${row.articleCode ?? ""}`.toLowerCase();
      return haystack.includes(search);
    });

    res.json(rows);
    return;
  }

  const [orders, stockEntries] = await Promise.all([
    prisma.productionOrder.findMany({
      select: {
        department: true,
        articleId: true,
        size: true,
        quantityDozen: true,
        completedDozen: true,
        bMallDozen: true,
        cMallDozen: true,
        forwardedDozen: true,
        article: { select: { id: true, name: true, code: true } },
      },
    }),
    prisma.stockEntry.findMany({
      select: {
        articleId: true,
        mode: true,
        quantityDozen: true,
        article: { select: { id: true, name: true, code: true } },
      },
    }),
  ]);

  const quantityByArticle = new Map();
  for (const row of orders) {
    const quantity = toNumber(row.quantityDozen);
    const completed = toNumber(row.completedDozen);
    const bMall = toNumber(row.bMallDozen);
    const cMall = toNumber(row.cMallDozen);
    const progress = MERGED_FINAL_DEPARTMENTS.includes(row.department)
      ? completed + bMall + cMall
      : completed;

    let contributionA = 0;
    if (MERGED_FINAL_DEPARTMENTS.includes(row.department)) {
      contributionA = Math.max(quantity - progress, 0);
    }

    if (contributionA <= 0) {
      continue;
    }

    const rowSize = normalizeSize(row.size);
    const mapKey = `${row.articleId}__${rowSize}`;
    const prev = quantityByArticle.get(mapKey) ?? {
      articleId: row.articleId,
      articleName: row.article?.name ?? "-",
      size: rowSize,
      articleCode: row.article?.code ?? null,
      quantityDozen: 0,
      bMallDozen: 0,
      cMallDozen: 0,
    };
    prev.quantityDozen += contributionA;
    quantityByArticle.set(mapKey, prev);
  }

  for (const entry of stockEntries) {
    if (entry.mode !== mode) continue;

    const contribution = toNumber(entry.quantityDozen);
    if (contribution <= 0) continue;

    const mapKey = `${entry.articleId}__-`;
    const prev = quantityByArticle.get(mapKey) ?? {
      articleId: entry.articleId,
      articleName: entry.article?.name ?? "-",
      size: "-",
      articleCode: entry.article?.code ?? null,
      quantityDozen: 0,
      bMallDozen: 0,
      cMallDozen: 0,
    };
    prev.quantityDozen += contribution;
    quantityByArticle.set(mapKey, prev);
  }

  const rows = Array.from(quantityByArticle.values())
    .filter((row) => {
      if (!search) return true;
      const haystack =
        `${row.articleName} ${row.size} ${row.articleCode ?? ""}`.toLowerCase();
      return haystack.includes(search);
    })
    .sort((a, b) => {
      const byArticle = a.articleName.localeCompare(b.articleName);
      if (byArticle !== 0) return byArticle;
      return a.size.localeCompare(b.size);
    });

  res.json(rows);
};

export const listManualStockEntries = async (req, res) => {
  const rows = await prisma.stockEntry.findMany({
    include: {
      article: {
        select: { id: true, name: true, code: true },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  res.json(
    rows.map((row) => ({
      ...row,
      quantityDozen: toNumber(row.quantityDozen),
    })),
  );
};

export const createManualStockEntry = async (req, res) => {
  const quantityDozen = Math.abs(toNumber(req.body.quantityDozen));
  const mode = normalizeStockMode(req.body.mode);
  const note = String(req.body.note ?? "").trim();

  if (!req.body.articleId) {
    res.status(400).json({ error: "Article is required." });
    return;
  }

  if (quantityDozen <= 0) {
    res.status(400).json({ error: "Quantity must be greater than 0." });
    return;
  }

  const entry = await prisma.stockEntry.create({
    data: {
      articleId: req.body.articleId,
      mode,
      quantityDozen,
      note: note || null,
    },
    include: {
      article: {
        select: { id: true, name: true, code: true },
      },
    },
  });

  res.status(201).json({
    ...entry,
    quantityDozen: toNumber(entry.quantityDozen),
  });
};

export const updateManualStockEntry = async (req, res) => {
  const quantityDozen =
    req.body.quantityDozen === undefined
      ? undefined
      : Math.abs(toNumber(req.body.quantityDozen));

  if (quantityDozen !== undefined && quantityDozen <= 0) {
    res.status(400).json({ error: "Quantity must be greater than 0." });
    return;
  }

  const entry = await prisma.stockEntry.update({
    where: { id: req.params.entryId },
    data: {
      articleId: req.body.articleId,
      mode:
        req.body.mode === undefined
          ? undefined
          : normalizeStockMode(req.body.mode),
      quantityDozen,
      note:
        req.body.note === undefined
          ? undefined
          : String(req.body.note).trim() || null,
    },
    include: {
      article: {
        select: { id: true, name: true, code: true },
      },
    },
  });

  res.json({
    ...entry,
    quantityDozen: toNumber(entry.quantityDozen),
  });
};

export const deleteManualStockEntry = async (req, res) => {
  await prisma.stockEntry.delete({
    where: { id: req.params.entryId },
  });
  res.status(204).end();
};

const toApiMallStockMovement = (row) => ({
  ...row,
  quantityDozen: toNumber(row.quantityDozen),
  ratePerDozen:
    row.ratePerDozen == null ? null : toNumber(row.ratePerDozen),
  totalAmount: calculateMallSaleTotal(
    row.quantityDozen,
    row.ratePerDozen,
    row.direction,
  ),
});

const calculateMallSaleTotal = (quantityDozen, ratePerPair, direction) => {
  if (direction !== "OUT" || ratePerPair == null) return null;
  return Number(
    (Math.abs(toNumber(quantityDozen)) * 12 * Math.abs(toNumber(ratePerPair))).toFixed(
      2,
    ),
  );
};

const totalsDiffer = (left, right) => {
  if (left == null && right == null) return false;
  return Math.abs(toNumber(left) - toNumber(right)) > 0.009;
};

const reconcileMallStockMovementRow = async (tx, row) => {
  const correctedTotalAmount = calculateMallSaleTotal(
    row.quantityDozen,
    row.ratePerDozen,
    row.direction,
  );

  if (!totalsDiffer(row.totalAmount, correctedTotalAmount)) {
    return row;
  }

  const updatedRow = await tx.mallStockMovement.update({
    where: { id: row.id },
    data: {
      totalAmount: correctedTotalAmount,
    },
  });

  if (row.roznamchaEntryId && correctedTotalAmount != null) {
    await tx.expenseEntry.update({
      where: { id: row.roznamchaEntryId },
      data: {
        amount: -correctedTotalAmount,
      },
    });
  }

  return updatedRow;
};

const getMallSaleSourceSystem = (mallType) =>
  mallType === "C_MALL" ? "C_MALL_SALE" : "B_MALL_SALE";

const getMallSaleDescription = (mallType, reference) => {
  const baseLabel = mallType === "C_MALL" ? "C-Mall sale" : "B-Mall sale";
  return reference ? `${baseLabel} - ${reference}` : baseLabel;
};

const getMallAvailableQuantity = async (tx, mallType) => {
  const snapshot = await getPackedStockSnapshot(tx);
  return mallType === "C_MALL"
    ? snapshot.packedCMallDozen
    : snapshot.packedBMallDozen;
};

export const listMallStockMovements = async (req, res) => {
  const rows = await prisma.$transaction(async (tx) => {
    const fetchedRows = await tx.mallStockMovement.findMany({
      orderBy: [{ date: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }],
    });

    const normalizedRows = [];
    for (const row of fetchedRows) {
      normalizedRows.push(await reconcileMallStockMovementRow(tx, row));
    }

    return normalizedRows;
  });

  res.json(rows.map(toApiMallStockMovement));
};

export const createMallStockMovement = async (req, res) => {
  const mallType = normalizeMallStockType(req.body.mallType, "");
  const direction = normalizeStockMovementDirection(req.body.direction);
  const quantityDozen = Math.abs(toNumber(req.body.quantityDozen));
  const ratePerDozenInput = Math.abs(toNumber(req.body.ratePerDozen));
  const date = req.body.date ? toDate(req.body.date, "start") : new Date();
  const reference = String(req.body.reference ?? "").trim();
  const note = String(req.body.note ?? "").trim();

  if (!mallType) {
    res.status(400).json({ error: "Mall type is required." });
    return;
  }
  if (quantityDozen <= 0) {
    res.status(400).json({ error: "Quantity must be greater than 0." });
    return;
  }
  if (Number.isNaN(date.getTime())) {
    res.status(400).json({ error: "Valid date is required." });
    return;
  }
  if (direction === "OUT" && ratePerDozenInput <= 0) {
    res.status(400).json({ error: "Price per pair must be greater than 0." });
    return;
  }

  if (direction === "OUT") {
    const availableQuantity = await getMallAvailableQuantity(prisma, mallType);
    if (quantityDozen > availableQuantity) {
      res.status(400).json({
        error: `Only ${availableQuantity} dozen is available in ${mallType === "B_MALL" ? "B-Mall" : "C-Mall"} stock.`,
      });
      return;
    }
  }

  const totalAmount = calculateMallSaleTotal(
    quantityDozen,
    ratePerDozenInput,
    direction,
  );

  const entry = await prisma.$transaction(async (tx) => {
    let roznamchaEntryId = null;

    if (direction === "OUT" && totalAmount != null) {
      const roznamchaEntry = await createSystemRoznamchaEntry(tx, {
        date,
        amount: -totalAmount,
        description: getMallSaleDescription(mallType, reference),
        sourceSystem: getMallSaleSourceSystem(mallType),
        paymentType: "CASH",
      });
      roznamchaEntryId = roznamchaEntry.id;
    }

    return tx.mallStockMovement.create({
      data: {
        mallType,
        direction,
        date,
        quantityDozen,
        ratePerDozen: direction === "OUT" ? ratePerDozenInput : null,
        totalAmount,
        reference: reference || null,
        note: note || null,
        roznamchaEntryId,
      },
    });
  });

  res.status(201).json(toApiMallStockMovement(entry));
};

export const updateMallStockMovement = async (req, res) => {
  const existing = await prisma.mallStockMovement.findUnique({
    where: { id: req.params.movementId },
  });

  if (!existing) {
    res.status(404).json({ error: "Mall stock movement not found." });
    return;
  }

  const mallType =
    req.body.mallType === undefined
      ? existing.mallType
      : normalizeMallStockType(req.body.mallType, "");
  const direction =
    req.body.direction === undefined
      ? existing.direction
      : normalizeStockMovementDirection(req.body.direction);
  const quantityDozen =
    req.body.quantityDozen === undefined
      ? toNumber(existing.quantityDozen)
      : Math.abs(toNumber(req.body.quantityDozen));
  const ratePerDozen =
    req.body.ratePerDozen === undefined
      ? existing.ratePerDozen == null
        ? 0
        : toNumber(existing.ratePerDozen)
      : Math.abs(toNumber(req.body.ratePerDozen));
  const date =
    req.body.date === undefined
      ? existing.date
      : toDate(req.body.date, "start");
  const reference =
    req.body.reference === undefined
      ? existing.reference
      : String(req.body.reference ?? "").trim() || null;
  const note =
    req.body.note === undefined
      ? existing.note
      : String(req.body.note ?? "").trim() || null;

  if (!mallType) {
    res.status(400).json({ error: "Mall type is required." });
    return;
  }
  if (quantityDozen <= 0) {
    res.status(400).json({ error: "Quantity must be greater than 0." });
    return;
  }
  if (Number.isNaN(date.getTime())) {
    res.status(400).json({ error: "Valid date is required." });
    return;
  }
  if (direction === "OUT" && ratePerDozen <= 0) {
    res.status(400).json({ error: "Price per pair must be greater than 0." });
    return;
  }

  if (direction === "OUT") {
    const availableQuantity = await getMallAvailableQuantity(prisma, mallType);
    const existingContribution =
      existing.mallType === mallType
        ? existing.direction === "IN"
          ? toNumber(existing.quantityDozen)
          : -toNumber(existing.quantityDozen)
        : 0;
    const availableWithoutExisting = Math.max(
      availableQuantity - existingContribution,
      0,
    );

    if (quantityDozen > availableWithoutExisting) {
      res.status(400).json({
        error: `Only ${availableWithoutExisting} dozen is available in ${mallType === "B_MALL" ? "B-Mall" : "C-Mall"} stock.`,
      });
      return;
    }
  }

  const totalAmount = calculateMallSaleTotal(
    quantityDozen,
    ratePerDozen,
    direction,
  );

  const entry = await prisma.$transaction(async (tx) => {
    let roznamchaEntryId = existing.roznamchaEntryId ?? null;

    if (direction === "OUT" && totalAmount != null) {
      const roznamchaData = {
        date,
        amount: -totalAmount,
        description: getMallSaleDescription(mallType, reference),
        module: "MISC",
        paymentType: "CASH",
        source: "SYSTEM",
        sourceSystem: getMallSaleSourceSystem(mallType),
      };

      if (existing.roznamchaEntryId) {
        await tx.expenseEntry.update({
          where: { id: existing.roznamchaEntryId },
          data: roznamchaData,
        });
      } else {
        const roznamchaEntry = await createSystemRoznamchaEntry(tx, {
          date,
          amount: -totalAmount,
          description: getMallSaleDescription(mallType, reference),
          sourceSystem: getMallSaleSourceSystem(mallType),
          paymentType: "CASH",
        });
        roznamchaEntryId = roznamchaEntry.id;
      }
    } else if (existing.roznamchaEntryId) {
      await tx.expenseEntry.delete({
        where: { id: existing.roznamchaEntryId },
      });
      roznamchaEntryId = null;
    }

    return tx.mallStockMovement.update({
      where: { id: req.params.movementId },
      data: {
        mallType,
        direction,
        date,
        quantityDozen,
        ratePerDozen: direction === "OUT" ? ratePerDozen : null,
        totalAmount,
        reference,
        note,
        roznamchaEntryId,
      },
    });
  });

  res.json(toApiMallStockMovement(entry));
};

export const deleteMallStockMovement = async (req, res) => {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.mallStockMovement.findUnique({
      where: { id: req.params.movementId },
    });

    if (!existing) {
      throw new Error("Mall stock movement not found.");
    }

    if (existing.roznamchaEntryId) {
      await tx.expenseEntry.delete({
        where: { id: existing.roznamchaEntryId },
      });
    }

    await tx.mallStockMovement.delete({
      where: { id: req.params.movementId },
    });
  }).catch((error) => {
    res
      .status(400)
      .json({ error: error.message ?? "Failed to delete mall stock movement." });
    return null;
  });
  if (res.headersSent) return;
  res.status(204).end();
};

export const listDepartmentLabors = async (req, res) => {
  const profiles = await prisma.laborProfile.findMany({
    where: {
      status: "ACTIVE",
      department: { in: LABOR_DEPARTMENT_IDS },
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, department: true },
  });
  res.json(profiles);
};
