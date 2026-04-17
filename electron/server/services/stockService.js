const MERGED_FINAL_DEPARTMENTS = ["MACHINEMAN", "PACKING"];

export const MALL_STOCK_TYPES = ["B_MALL", "C_MALL"];
export const STOCK_MOVEMENT_DIRECTIONS = ["IN", "OUT"];

export const toNumber = (value) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export const normalizeSize = (value) => {
  const normalized = String(value ?? "").trim();
  return normalized || "-";
};

export const getStockVariantKey = (articleId, size) =>
  `${articleId}::${normalizeSize(size)}`;

export const normalizeMallStockType = (value, fallback = "B_MALL") => {
  const normalized = String(value ?? fallback).trim().toUpperCase();
  return MALL_STOCK_TYPES.includes(normalized) ? normalized : fallback;
};

export const normalizeStockMovementDirection = (value, fallback = "OUT") => {
  const normalized = String(value ?? fallback).trim().toUpperCase();
  return STOCK_MOVEMENT_DIRECTIONS.includes(normalized) ? normalized : fallback;
};

export const getPackedStockSnapshot = async (
  tx,
  { excludeBillId = null } = {},
) => {
  const [orders, stockEntries, billLines, mallMovements] = await Promise.all([
    tx.productionOrder.findMany({
      where: { deletedAt: null },
      select: {
        department: true,
        articleId: true,
        size: true,
        completedDozen: true,
        bMallDozen: true,
        cMallDozen: true,
        article: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    }),
    tx.stockEntry.findMany({
      where: { mode: "PACKED", deletedAt: null },
      select: {
        articleId: true,
        quantityDozen: true,
        article: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    }),
    tx.billLine.findMany({
      where: {
        deletedAt: null,
        bill: {
          status: "CONFIRMED",
          deletedAt: null,
          ...(excludeBillId ? { id: { not: excludeBillId } } : {}),
        },
      },
      select: {
        articleId: true,
        size: true,
        quantity: true,
      },
    }),
    tx.mallStockMovement.findMany({
      where: { deletedAt: null },
      select: {
        mallType: true,
        direction: true,
        quantityDozen: true,
      },
    }),
  ]);

  const packedRowsByVariant = new Map();
  let packedBMallDozen = 0;
  let packedCMallDozen = 0;

  const upsertPackedRow = ({
    articleId,
    articleName,
    articleCode = null,
    size,
    quantityDozen,
  }) => {
    if (!articleId) return;
    const normalizedQuantity = toNumber(quantityDozen);
    if (normalizedQuantity === 0) return;

    const normalizedSize = normalizeSize(size);
    const variantKey = getStockVariantKey(articleId, normalizedSize);
    const previous = packedRowsByVariant.get(variantKey) ?? {
      articleId,
      articleName: articleName ?? "-",
      articleCode,
      size: normalizedSize,
      quantityDozen: 0,
      bMallDozen: 0,
      cMallDozen: 0,
    };

    previous.quantityDozen += normalizedQuantity;
    packedRowsByVariant.set(variantKey, previous);
  };

  for (const row of orders) {
    if (!MERGED_FINAL_DEPARTMENTS.includes(row.department)) continue;

    upsertPackedRow({
      articleId: row.articleId,
      articleName: row.article?.name,
      articleCode: row.article?.code ?? null,
      size: row.size,
      quantityDozen: row.completedDozen,
    });

    packedBMallDozen += toNumber(row.bMallDozen);
    packedCMallDozen += toNumber(row.cMallDozen);
  }

  for (const entry of stockEntries) {
    upsertPackedRow({
      articleId: entry.articleId,
      articleName: entry.article?.name,
      articleCode: entry.article?.code ?? null,
      size: "-",
      quantityDozen: entry.quantityDozen,
    });
  }

  for (const line of billLines) {
    const variantKey = getStockVariantKey(line.articleId, line.size);
    const previous = packedRowsByVariant.get(variantKey);
    if (!previous) continue;
    previous.quantityDozen -= toNumber(line.quantity);
    packedRowsByVariant.set(variantKey, previous);
  }

  for (const movement of mallMovements) {
    const quantityDozen = toNumber(movement.quantityDozen);
    const delta = movement.direction === "IN" ? quantityDozen : -quantityDozen;
    if (movement.mallType === "B_MALL") {
      packedBMallDozen += delta;
    } else if (movement.mallType === "C_MALL") {
      packedCMallDozen += delta;
    }
  }

  const packedRows = Array.from(packedRowsByVariant.values())
    .map((row) => ({
      ...row,
      quantityDozen: Math.max(toNumber(row.quantityDozen), 0),
      bMallDozen: 0,
      cMallDozen: 0,
    }))
    .filter((row) => row.quantityDozen > 0)
    .sort((a, b) => {
      const byArticle = a.articleName.localeCompare(b.articleName);
      if (byArticle !== 0) return byArticle;
      return a.size.localeCompare(b.size);
    });

  const packedAMallDozen = packedRows.reduce(
    (sum, row) => sum + toNumber(row.quantityDozen),
    0,
  );

  return {
    packedRows,
    packedAMallDozen,
    packedBMallDozen: Math.max(packedBMallDozen, 0),
    packedCMallDozen: Math.max(packedCMallDozen, 0),
  };
};
