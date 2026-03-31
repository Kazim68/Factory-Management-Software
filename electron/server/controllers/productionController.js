import prisma from "../prisma.js";
import {
  LABOR_DEPARTMENT_IDS,
  normalizeLaborDepartment,
} from "../constants/laborDepartments.js";
import {
  getLaborDepartmentLabelFromMap,
  getLaborDepartmentLabelMap,
} from "../services/laborDepartmentService.js";

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

const getAllowedNextDepartments = (department) => {
  const currentIndex = DEPARTMENT_FLOW.indexOf(department);
  if (currentIndex === -1) return [];
  return DEPARTMENT_FLOW.slice(currentIndex + 1);
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
  { department, articleId, quantityDozen, source, pricePerDozen = 0 },
) => {
  if (quantityDozen <= 0) return;

  const where = {
    department,
    articleId,
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
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    }),
    getLaborDepartmentLabelMap(),
  ]);

  res.json(
    rows
      .map((row) => toApiOrder(row, labelMap))
      .filter((row) => getOrderProgressDozen(row) < row.quantityDozen),
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
      packingLabor: true,
    },
  });

  const labelMap = await getLaborDepartmentLabelMap();
  res.status(201).json(toApiOrder(order, labelMap));
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
      packingLabor: true,
    },
  });

  const labelMap = await getLaborDepartmentLabelMap();
  res.json(toApiOrder(updated, labelMap));
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
    if (hasPriceUpdate && normalizedPricePerDozen <= 0) {
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
    if (hasMachinemanPriceUpdate && normalizedMachinemanPrice <= 0) {
      res
        .status(400)
        .json({ error: "Machineman price must be greater than 0." });
      return;
    }
    if (hasPackingPriceUpdate && normalizedPackingPrice <= 0) {
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
      } else if (row.department !== "PRESSMAN" && !row.laborId) {
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

        if (isMergedFinal && row.packingLaborId) {
          const packingRatePerDozen = toNumber(row.packingPricePerDozen);
          if (packingRatePerDozen > 0) {
            await tx.laborWorkEntry.create({
              data: {
                laborId: row.packingLaborId,
                articleId: row.articleId,
                startDate: new Date(),
                endDate: new Date(),
                quantity: progressDelta,
                rate: packingRatePerDozen,
                total: progressDelta * packingRatePerDozen,
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
            quantityDozen: upperForwarded,
            source: "STAGE_FLOW",
          });
        }

        if (ptawaForwarded > 0) {
          await createOrExpandQueueOrder(tx, {
            department: "PRINTING",
            articleId: row.articleId,
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
  const [orders, stockEntries] = await Promise.all([
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
  let packedStockDozen = 0;
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
      packedStockDozen += progress;
      readyStockDozen += Math.max(quantity - progress, 0);
      continue;
    }

    // Stock starts when rows reach Machineman queue from DC completion.
    if (row.department === "MACHINEMAN") {
      readyStockDozen += Math.max(quantity - forwarded, 0);
    }
  }

  for (const entry of stockEntries) {
    const quantity = toNumber(entry.quantityDozen);
    if (entry.mode === "PACKED") {
      packedStockDozen += quantity;
    } else {
      readyStockDozen += quantity;
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
  const mode = normalizeStockMode(req.query.mode);
  const search = String(req.query.q ?? "")
    .trim()
    .toLowerCase();
  const isPackedMode = mode === "PACKED";

  const [orders, stockEntries] = await Promise.all([
    prisma.productionOrder.findMany({
      select: {
        department: true,
        articleId: true,
        quantityDozen: true,
        completedDozen: true,
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
    let contributionB = 0;
    let contributionC = 0;
    if (isPackedMode) {
      if (MERGED_FINAL_DEPARTMENTS.includes(row.department)) {
        contributionA = completed;
        contributionB = bMall;
        contributionC = cMall;
      }
    } else if (MERGED_FINAL_DEPARTMENTS.includes(row.department)) {
      contributionA = Math.max(quantity - progress, 0);
    }

    if (contributionA <= 0 && contributionB <= 0 && contributionC <= 0) {
      continue;
    }

    const prev = quantityByArticle.get(row.articleId) ?? {
      articleId: row.articleId,
      articleName: row.article?.name ?? "-",
      articleCode: row.article?.code ?? null,
      quantityDozen: 0,
      bMallDozen: 0,
      cMallDozen: 0,
    };
    prev.quantityDozen += contributionA;
    prev.bMallDozen += contributionB;
    prev.cMallDozen += contributionC;
    quantityByArticle.set(row.articleId, prev);
  }

  for (const entry of stockEntries) {
    if (entry.mode !== mode) continue;

    const contribution = toNumber(entry.quantityDozen);
    if (contribution <= 0) continue;

    const prev = quantityByArticle.get(entry.articleId) ?? {
      articleId: entry.articleId,
      articleName: entry.article?.name ?? "-",
      articleCode: entry.article?.code ?? null,
      quantityDozen: 0,
    };
    prev.quantityDozen += contribution;
    quantityByArticle.set(entry.articleId, prev);
  }

  const rows = Array.from(quantityByArticle.values())
    .filter((row) => {
      if (!search) return true;
      const haystack =
        `${row.articleName} ${row.articleCode ?? ""}`.toLowerCase();
      return haystack.includes(search);
    })
    .sort((a, b) => a.articleName.localeCompare(b.articleName));

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
    }))
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
