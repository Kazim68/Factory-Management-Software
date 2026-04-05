import prisma from "../prisma.js";
import { createSystemRoznamchaEntry } from "../utils/roznamcha.js";

const toDbPaymentType = (paymentType) => {
  const normalized = String(paymentType ?? "CASH").toUpperCase();
  if (normalized === "KHATA") return "CREDIT";
  if (normalized === "CHEQUE") return "CHEQUE";
  return normalized === "CREDIT" ? "CREDIT" : "CASH";
};

const isKhata = (paymentType) =>
  ["CREDIT", "KHATA"].includes(String(paymentType ?? "CASH").toUpperCase());

const toNormalizedPurchaseType = (value) =>
  String(value ?? "KHATA").toUpperCase();

const toSupplierPaymentMethod = (paymentType) =>
  paymentType === "CHEQUE"
    ? "CHEQUE"
    : paymentType === "CASH"
      ? "CASH"
      : "CREDIT";

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

const formatMoney = (value) => `Rs ${Number(value ?? 0).toFixed(2)}`;

const formatPrintDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB");
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
  const from = new Date(now);
  const to = new Date(now);

  if (preset === "CUSTOM") {
    const customStart = start ? new Date(`${start}T00:00:00`) : null;
    const customEnd = end ? new Date(`${end}T23:59:59.999`) : null;
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
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    return { preset, from, to };
  }

  if (preset === "WEEKLY") {
    const day = now.getDay();
    const mondayOffset = (day + 6) % 7;
    from.setDate(now.getDate() - mondayOffset);
    from.setHours(0, 0, 0, 0);
    to.setDate(from.getDate() + 6);
    to.setHours(23, 59, 59, 999);
    return { preset, from, to };
  }

  if (preset === "YEARLY") {
    from.setMonth(0, 1);
    from.setHours(0, 0, 0, 0);
    to.setMonth(11, 31);
    to.setHours(23, 59, 59, 999);
    return { preset, from, to };
  }

  from.setDate(1);
  from.setHours(0, 0, 0, 0);
  to.setMonth(now.getMonth() + 1, 0);
  to.setHours(23, 59, 59, 999);
  return { preset, from, to };
};

const whereDateRange = (from, to) => {
  const date = {};
  if (from) date.gte = from;
  if (to) date.lte = to;
  return Object.keys(date).length ? { date } : {};
};

export const getPrintableSupplierPurchases = async (req, res) => {
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
          where,
          include: { party: true },
          orderBy: { date: "desc" },
        })
      : Promise.resolve([]),
    selectedTypes.includes("REXINE")
      ? prisma.rexinePurchase.findMany({
          where,
          include: { party: true },
          orderBy: { date: "desc" },
        })
      : Promise.resolve([]),
    selectedTypes.includes("MATERIAL")
      ? prisma.materialPurchase.findMany({
          where,
          include: { party: true, article: true, unit: true },
          orderBy: { date: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const rows = [
    ...chemicalData.map((entry) => ({
      date: entry.date,
      supplierName: entry.party?.name || "Unknown",
      type: "CHEMICAL",
      itemName: "Raw Material",
      quantity: `${Number(entry.quantityKg)} kg`,
      rate: `${formatMoney(entry.ratePerKg)}/kg`,
      total: Number(entry.totalAmount ?? 0),
      paymentType: entry.paymentType,
    })),
    ...rexineData.map((entry) => ({
      date: entry.date,
      supplierName: entry.party?.name || "Unknown",
      type: "REXINE",
      itemName: "Raw Material",
      quantity: `${Number(entry.quantityMeter)} meter`,
      rate: `${formatMoney(entry.ratePerMeter)}/meter`,
      total: Number(entry.totalAmount ?? 0),
      paymentType: entry.paymentType,
    })),
    ...materialData.map((entry) => {
      const unitLabel = entry.unit?.symbol || entry.unit?.name || "unit";
      return {
        date: entry.date,
        supplierName: entry.party?.name || "Unknown",
        type: "MATERIAL",
        itemName: entry.article?.name || "-",
        quantity: `${Number(entry.quantity)} ${unitLabel}`,
        rate: `${formatMoney(entry.pricePerUnit)}/${unitLabel}`,
        total: Number(entry.totalAmount ?? 0),
        paymentType: entry.paymentType,
      };
    }),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const grandTotal = rows.reduce((sum, row) => sum + row.total, 0);

  const htmlRows = rows
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(formatPrintDate(row.date))}</td>
        <td>${escapeHtml(row.supplierName)}</td>
        <td>${escapeHtml(row.type)}</td>
        <td>${escapeHtml(row.itemName)}</td>
        <td>${escapeHtml(row.quantity)}</td>
        <td>${escapeHtml(row.rate)}</td>
        <td>${escapeHtml(formatMoney(row.total))}</td>
        <td>${escapeHtml(row.paymentType)}</td>
      </tr>
    `,
    )
    .join("");

  const title = "Supplier Purchase Report";
  const generatedAt = new Date().toLocaleString("en-GB");
  const fromText = range.from ? formatPrintDate(range.from) : "-";
  const toText = range.to ? formatPrintDate(range.to) : "-";

  const html = `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(title)}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 18px; color: #111; }
        h1 { margin: 0 0 8px; font-size: 22px; }
        .meta { margin-bottom: 14px; font-size: 13px; }
        .meta p { margin: 3px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #d4d4d4; padding: 7px; text-align: left; font-size: 12px; }
        th { background: #f5f5f5; }
        .totals { margin-top: 12px; text-align: right; font-weight: 700; }
        @media print { body { padding: 8px; } }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">
        <p><strong>Generated At:</strong> ${escapeHtml(generatedAt)}</p>
        <p><strong>Type Filters:</strong> ${escapeHtml(selectedTypes.join(", "))}</p>
        <p><strong>Time Filter:</strong> ${escapeHtml(range.preset)}</p>
        <p><strong>Date Range:</strong> ${escapeHtml(fromText)} to ${escapeHtml(toText)}</p>
        <p><strong>Total Rows:</strong> ${rows.length}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Supplier</th>
            <th>Type</th>
            <th>Item</th>
            <th>Quantity</th>
            <th>Rate</th>
            <th>Total</th>
            <th>Payment</th>
          </tr>
        </thead>
        <tbody>
          ${htmlRows || '<tr><td colspan="8">No records found for selected filters.</td></tr>'}
        </tbody>
      </table>
      <div class="totals">Grand Total: ${escapeHtml(formatMoney(grandTotal))}</div>
      <script>window.onload = () => { window.focus(); window.print(); };</script>
    </body>
  </html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
};

export const createCombinedSupplierPurchase = async (req, res) => {
  const { date, partyId, paymentType, amountPaid, chequeId, rows } =
    req.body ?? {};

  if (!partyId) {
    res.status(400).json({ error: "Supplier is required." });
    return;
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "At least one purchase row is required." });
    return;
  }

  const normalizedPaymentType = toNormalizedPurchaseType(paymentType);
  if (!["KHATA", "CASH", "CHEQUE"].includes(normalizedPaymentType)) {
    res.status(400).json({ error: "Invalid payment type." });
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
  const safeAmountPaid = Number.isFinite(Number(amountPaid))
    ? Math.max(0, Number(amountPaid))
    : 0;

  if (normalizedPaymentType === "KHATA" && safeAmountPaid > grossTotal) {
    res
      .status(400)
      .json({ error: "Amount paid cannot exceed gross total for khata." });
    return;
  }

  if (normalizedPaymentType === "CHEQUE" && !chequeId) {
    res.status(400).json({ error: "Please select a cheque." });
    return;
  }

  const dbPurchasePaymentType =
    normalizedPaymentType === "CASH" ? "CASH" : "CREDIT";

  const result = await prisma
    .$transaction(async (tx) => {
      const party = await tx.party.findUnique({ where: { id: partyId } });
      if (!party || party.type !== "SUPPLIER") {
        throw new Error("Selected party must be a supplier.");
      }

      let selectedCheque = null;
      if (normalizedPaymentType === "CHEQUE") {
        selectedCheque = await tx.cheque.findUnique({
          where: { id: chequeId },
        });
        if (!selectedCheque || selectedCheque.status !== "AVAILABLE") {
          throw new Error("Selected cheque is not available.");
        }

        const chequeAmount = Number(selectedCheque.amount ?? 0);
        if (Math.abs(chequeAmount - safeAmountPaid) > 0.0001) {
          throw new Error("Amount paid must match selected cheque amount.");
        }
      }

      const created = [];
      for (const row of normalizedRows) {
        if (row.type === "CHEMICAL") {
          const purchase = await tx.chemicalPurchase.create({
            data: {
              date: new Date(date),
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
              date: new Date(date),
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
            date: new Date(date),
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

      let payment = null;
      if (safeAmountPaid > 0) {
        const method = toSupplierPaymentMethod(normalizedPaymentType);
        if (normalizedPaymentType !== "CASH") {
          payment = await tx.partyPayment.create({
            data: {
              partyId,
              date: new Date(date),
              amount: safeAmountPaid,
              method,
              reference: "Supplier Purchase Payment",
              description: "Supplier purchase payment",
            },
          });

          await tx.partyLedgerEntry.create({
            data: {
              partyId,
              date: new Date(date),
              reference: "Supplier Purchase Payment",
              description: "Supplier purchase payment",
              balance: safeAmountPaid,
            },
          });
        }

        await createSystemRoznamchaEntry(tx, {
          date: new Date(date),
          amount: safeAmountPaid,
          description: "Supplier purchase payment",
          partyId,
          paymentType: method,
          sourceSystem: "PARTY_PAYMENT_PAID",
        });

        if (method === "CHEQUE") {
          await tx.cheque.update({
            where: { id: selectedCheque.id },
            data: {
              status: "USED",
              usedPaymentId: payment.id,
              usedPartyId: partyId,
              notes: selectedCheque.notes,
              chequeNumber: selectedCheque.chequeNumber,
            },
          });
        }
      }

      return {
        grossTotal,
        amountPaid: safeAmountPaid,
        paymentType: normalizedPaymentType,
        created,
        payment,
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
        date: new Date(date),
        partyId,
        quantityKg,
        ratePerKg,
        totalAmount,
        paymentType: toDbPaymentType(paymentType ?? "CASH"),
      },
    });

    const expense = await tx.expenseEntry.create({
      data: {
        date: new Date(date),
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
        date: req.body.date ? new Date(req.body.date) : undefined,
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
        date: req.body.date ? new Date(req.body.date) : undefined,
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
      await tx.partyLedgerEntry.delete({ where: { id: existingLedger.id } });
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
    await tx.partyLedgerEntry.deleteMany({
      where: { chemicalPurchaseId: req.params.purchaseId },
    });
    await tx.expenseEntry.deleteMany({
      where: { chemicalPurchaseId: req.params.purchaseId },
    });
    await tx.chemicalPurchase.delete({ where: { id: req.params.purchaseId } });
  });
  res.status(204).end();
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
        date: new Date(date),
        partyId,
        quantityMeter,
        ratePerMeter,
        totalAmount,
        paymentType: toDbPaymentType(paymentType ?? "CASH"),
      },
    });

    const expense = await tx.expenseEntry.create({
      data: {
        date: new Date(date),
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
        date: req.body.date ? new Date(req.body.date) : undefined,
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
        date: req.body.date ? new Date(req.body.date) : undefined,
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
      await tx.partyLedgerEntry.delete({ where: { id: existingLedger.id } });
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
    await tx.partyLedgerEntry.deleteMany({
      where: { rexinePurchaseId: req.params.purchaseId },
    });
    await tx.expenseEntry.deleteMany({
      where: { rexinePurchaseId: req.params.purchaseId },
    });
    await tx.rexinePurchase.delete({ where: { id: req.params.purchaseId } });
  });
  res.status(204).end();
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
        date: new Date(date),
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
        date: new Date(date),
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
        date: req.body.date ? new Date(req.body.date) : undefined,
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
        date: req.body.date ? new Date(req.body.date) : undefined,
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
      await tx.partyLedgerEntry.delete({ where: { id: existingLedger.id } });
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
    await tx.partyLedgerEntry.deleteMany({
      where: { materialPurchaseId: req.params.purchaseId },
    });
    await tx.expenseEntry.deleteMany({
      where: { materialPurchaseId: req.params.purchaseId },
    });
    await tx.materialPurchase.delete({ where: { id: req.params.purchaseId } });
  });
  res.status(204).end();
};
