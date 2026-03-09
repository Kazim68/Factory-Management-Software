import prisma from "../prisma.js";
import {
  LABOR_DEPARTMENT_IDS,
  getLaborDepartmentLabel,
  normalizeLaborDepartment,
} from "../constants/laborDepartments.js";

const STAGE_BY_DEPARTMENT = {
  PRESSMAN: "STAGE_PRESSMAN",
  UPPERMAN: "STAGE_UPPERMAN",
  PRINTING: "STAGE_PRINTING",
  DC: "STAGE_DC",
  MACHINEMAN: "STAGE_MACHINEMAN",
  PACKING: "STAGE_PACKING",
};

const NEXT_DEPARTMENT = {
  DC: "MACHINEMAN",
  MACHINEMAN: "PACKING",
};

const toNumber = (value) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const computeStatus = (completedDozen, quantityDozen) => {
  if (completedDozen <= 0) return "INCOMPLETE";
  if (completedDozen >= quantityDozen) return "COMPLETE";
  return "PARTIALLY_COMPLETE";
};

const toApiOrder = (order) => {
  const quantityDozen = toNumber(order.quantityDozen);
  const completedDozen = toNumber(order.completedDozen);
  const forwardedDozen = toNumber(order.forwardedDozen);
  return {
    ...order,
    departmentLabel: getLaborDepartmentLabel(order.department),
    quantityDozen,
    completedDozen,
    forwardedDozen,
    pricePerDozen: toNumber(order.pricePerDozen),
    status: computeStatus(completedDozen, quantityDozen),
  };
};

const createOrExpandQueueOrder = async (
  tx,
  {
    department,
    articleId,
    quantityDozen,
    source,
    exclusionSource,
    pricePerDozen = 0,
  }
) => {
  if (quantityDozen <= 0) return;

  const where = {
    department,
    articleId,
    laborId: null,
    isClosed: false,
    ...(source ? { source } : {}),
    ...(exclusionSource ? { NOT: { source: exclusionSource } } : {}),
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

  const rows = await prisma.productionOrder.findMany({
    where: {
      ...(departmentQuery ? { department: departmentQuery } : {}),
      isClosed: false,
    },
    include: {
      article: true,
      labor: true,
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  res.json(
    rows
      .map(toApiOrder)
      .filter((row) => row.completedDozen < row.quantityDozen)
  );
};

export const createProductionOrder = async (req, res) => {
  const department = normalizeLaborDepartment(req.body.department);
  const quantityDozen = Math.abs(toNumber(req.body.quantityDozen));
  const pricePerDozen = Math.abs(toNumber(req.body.pricePerDozen));

  if (!req.body.articleId) {
    res.status(400).json({ error: "Article is required." });
    return;
  }
  if (quantityDozen <= 0) {
    res.status(400).json({ error: "Quantity must be greater than 0." });
    return;
  }

  await assertDepartmentLaborMatch(department, req.body.laborId).catch((error) => {
    res.status(400).json({ error: error.message });
  });
  if (res.headersSent) return;

  const order = await prisma.productionOrder.create({
    data: {
      department,
      stage: STAGE_BY_DEPARTMENT[department],
      articleId: req.body.articleId,
      laborId: req.body.laborId || null,
      quantityDozen,
      pricePerDozen,
      completedDozen: 0,
      forwardedDozen: 0,
      source: "MANUAL",
      isClosed: false,
    },
    include: {
      article: true,
      labor: true,
    },
  });

  res.status(201).json(toApiOrder(order));
};

export const updateProductionOrder = async (req, res) => {
  const existing = await prisma.productionOrder.findUnique({
    where: { id: req.params.orderId },
  });
  if (!existing) {
    res.status(404).json({ error: "Order not found." });
    return;
  }
  if (existing.department !== "PRESSMAN") {
    res.status(400).json({ error: "Only pressman orders can be edited." });
    return;
  }

  const quantityDozen =
    req.body.quantityDozen === undefined
      ? undefined
      : Math.abs(toNumber(req.body.quantityDozen));
  const pricePerDozen =
    req.body.pricePerDozen === undefined
      ? undefined
      : Math.abs(toNumber(req.body.pricePerDozen));

  const nextQuantity = quantityDozen ?? toNumber(existing.quantityDozen);
  if (nextQuantity <= 0) {
    res.status(400).json({ error: "Quantity must be greater than 0." });
    return;
  }

  const updated = await prisma.productionOrder.update({
    where: { id: req.params.orderId },
    data: {
      articleId: req.body.articleId,
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
    },
  });

  res.json(toApiOrder(updated));
};

export const assignProductionOrderLabor = async (req, res) => {
  const existing = await prisma.productionOrder.findUnique({
    where: { id: req.params.orderId },
  });
  if (!existing) {
    res.status(404).json({ error: "Order not found." });
    return;
  }

  const laborId = req.body.laborId || null;
  const pricePerDozenInput = req.body.pricePerDozen;
  const hasPriceUpdate = pricePerDozenInput !== undefined && pricePerDozenInput !== null;
  const normalizedPricePerDozen = hasPriceUpdate
    ? Math.abs(toNumber(pricePerDozenInput))
    : undefined;
  if (hasPriceUpdate && normalizedPricePerDozen <= 0) {
    res.status(400).json({ error: "Price must be greater than 0." });
    return;
  }
  await assertDepartmentLaborMatch(existing.department, laborId).catch((error) => {
    res.status(400).json({ error: error.message });
  });
  if (res.headersSent) return;

  const order = await prisma.productionOrder.update({
    where: { id: req.params.orderId },
    data: {
      laborId,
      pricePerDozen: hasPriceUpdate ? normalizedPricePerDozen : undefined,
    },
    include: {
      article: true,
      labor: true,
    },
  });

  res.json(toApiOrder(order));
};

export const updateProductionOrderCompletion = async (req, res) => {
  const completedInput = Math.abs(toNumber(req.body.completedDozen));

  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.productionOrder.findUnique({
      where: { id: req.params.orderId },
    });
    if (!row) {
      throw new Error("Order not found.");
    }
    if (row.department !== "PRESSMAN" && !row.laborId) {
      throw new Error("Assign labor before marking this order done.");
    }

    const rowQty = toNumber(row.quantityDozen);
    const rowCompleted = toNumber(row.completedDozen);
    const rowForwarded = toNumber(row.forwardedDozen);
    const clampedCompleted = Math.min(Math.max(completedInput, 0), rowQty);
    if (clampedCompleted < rowCompleted) {
      throw new Error("Completed quantity cannot be reduced.");
    }
    const progressDelta = Math.max(0, clampedCompleted - rowCompleted);

    const patch = {
      completedDozen: clampedCompleted,
      isClosed: clampedCompleted >= rowQty,
      closedAt: clampedCompleted >= rowQty ? new Date() : null,
    };

    await tx.productionOrder.update({
      where: { id: row.id },
      data: patch,
    });

    if (progressDelta > 0 && row.laborId) {
      const baseRatePerDozen = toNumber(row.pricePerDozen);
      const isUpperman = row.department === "UPPERMAN";
      const quantity = isUpperman ? progressDelta * 12 : progressDelta;
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
    }

    if (row.department === "PRESSMAN") {
      const releasable = Math.max(0, clampedCompleted - rowForwarded);
      if (releasable > 0) {
        await createOrExpandQueueOrder(tx, {
          department: "UPPERMAN",
          articleId: row.articleId,
          quantityDozen: releasable,
          source: "PRESSMAN_FLOW",
        });
        await createOrExpandQueueOrder(tx, {
          department: "PRINTING",
          articleId: row.articleId,
          quantityDozen: releasable,
          source: "PRESSMAN_FLOW",
        });
      }
      await tx.productionOrder.update({
        where: { id: row.id },
        data: { forwardedDozen: clampedCompleted },
      });
    } else if (row.department === "UPPERMAN" || row.department === "PRINTING") {
      const [upperRows, printingRows, dcRows] = await Promise.all([
        tx.productionOrder.findMany({
          where: { department: "UPPERMAN", articleId: row.articleId },
          select: { completedDozen: true },
        }),
        tx.productionOrder.findMany({
          where: { department: "PRINTING", articleId: row.articleId },
          select: { completedDozen: true },
        }),
        tx.productionOrder.findMany({
          where: {
            department: "DC",
            articleId: row.articleId,
            source: "UPPER_PRINT_PARALLEL",
          },
          select: { quantityDozen: true },
        }),
      ]);

      const upperCompleted = upperRows.reduce(
        (sum, item) => sum + toNumber(item.completedDozen),
        0
      );
      const printingCompleted = printingRows.reduce(
        (sum, item) => sum + toNumber(item.completedDozen),
        0
      );
      const parallelReady = Math.min(upperCompleted, printingCompleted);
      const alreadyReleasedToDc = dcRows.reduce(
        (sum, item) => sum + toNumber(item.quantityDozen),
        0
      );
      const releasable = Math.max(0, parallelReady - alreadyReleasedToDc);

      if (releasable > 0) {
        await createOrExpandQueueOrder(tx, {
          department: "DC",
          articleId: row.articleId,
          quantityDozen: releasable,
          source: "UPPER_PRINT_PARALLEL",
        });
      }

      await tx.productionOrder.update({
        where: { id: row.id },
        data: { forwardedDozen: clampedCompleted },
      });
    } else {
      const releasable = Math.max(0, clampedCompleted - rowForwarded);
      const nextDepartment = NEXT_DEPARTMENT[row.department];
      if (nextDepartment && releasable > 0) {
        await createOrExpandQueueOrder(tx, {
          department: nextDepartment,
          articleId: row.articleId,
          quantityDozen: releasable,
          source: "STAGE_FLOW",
          exclusionSource: "UPPER_PRINT_PARALLEL",
        });
      }
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
      },
    });
  }).catch((error) => {
    res.status(400).json({ error: error.message ?? "Failed to update completion." });
    return null;
  });

  if (!result) return;
  res.json(toApiOrder(result));
};

export const getStockSummary = async (req, res) => {
  const orders = await prisma.productionOrder.findMany({
    select: {
      department: true,
      quantityDozen: true,
      completedDozen: true,
      forwardedDozen: true,
      isClosed: true,
    },
  });

  let wipDozen = 0;
  let readyStockDozen = 0;
  let packedStockDozen = 0;
  let activeOrders = 0;

  for (const row of orders) {
    const quantity = toNumber(row.quantityDozen);
    const completed = toNumber(row.completedDozen);
    const forwarded = toNumber(row.forwardedDozen);
    if (!row.isClosed && completed < quantity) {
      activeOrders += 1;
    }
    wipDozen += Math.max(quantity - completed, 0);

    if (row.department === "PACKING") {
      packedStockDozen += completed;
      readyStockDozen += Math.max(quantity - completed, 0);
      continue;
    }

    // Stock starts when rows reach Machineman queue from DC completion.
    if (row.department === "MACHINEMAN") {
      readyStockDozen += Math.max(quantity - forwarded, 0);
    }
  }

  res.json({
    activeOrders,
    wipDozen,
    readyStockDozen,
    packedStockDozen,
  });
};

export const listStockByArticle = async (req, res) => {
  const mode = String(req.query.mode ?? "IN_STOCK").toUpperCase();
  const search = String(req.query.q ?? "").trim().toLowerCase();
  const isPackedMode = mode === "PACKED";

  const orders = await prisma.productionOrder.findMany({
    select: {
      department: true,
      articleId: true,
      quantityDozen: true,
      completedDozen: true,
      forwardedDozen: true,
      article: { select: { id: true, name: true, code: true } },
    },
  });

  const quantityByArticle = new Map();
  for (const row of orders) {
    const quantity = toNumber(row.quantityDozen);
    const completed = toNumber(row.completedDozen);
    const forwarded = toNumber(row.forwardedDozen);

    let contribution = 0;
    if (isPackedMode) {
      if (row.department === "PACKING") {
        contribution = completed;
      }
    } else if (row.department === "PACKING") {
      contribution = Math.max(quantity - completed, 0);
    } else if (row.department === "MACHINEMAN") {
      // Reached Machineman means in-stock (until fully packed).
      contribution = Math.max(quantity - forwarded, 0);
    }

    if (contribution <= 0) continue;

    const prev = quantityByArticle.get(row.articleId) ?? {
      articleId: row.articleId,
      articleName: row.article?.name ?? "-",
      articleCode: row.article?.code ?? null,
      quantityDozen: 0,
    };
    prev.quantityDozen += contribution;
    quantityByArticle.set(row.articleId, prev);
  }

  const rows = Array.from(quantityByArticle.values())
    .filter((row) => {
      if (!search) return true;
      const haystack = `${row.articleName} ${row.articleCode ?? ""}`.toLowerCase();
      return haystack.includes(search);
    })
    .sort((a, b) => a.articleName.localeCompare(b.articleName));

  res.json(rows);
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
