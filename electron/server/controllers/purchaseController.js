import prisma from "../prisma.js";

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
        paymentType: paymentType ?? "CASH",
      },
    });

    const expense = await tx.expenseEntry.create({
      data: {
        date: new Date(date),
        categoryId: req.body.categoryId,
        partyId,
        module: "CHEMICAL",
        amount: totalAmount,
        description: req.body.description,
        chemicalPurchaseId: purchase.id,
      },
    });

    if (purchase.partyId && purchase.paymentType === "CREDIT") {
      await tx.partyLedgerEntry.create({
        data: {
          partyId: purchase.partyId,
          date: purchase.date,
          reference: "Chemical Purchase",
          description: req.body.description,
          debit: 0,
          credit: purchase.totalAmount,
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
        paymentType: req.body.paymentType,
      },
    });

    await tx.expenseEntry.updateMany({
      where: { chemicalPurchaseId: updated.id },
      data: {
        date: req.body.date ? new Date(req.body.date) : undefined,
        partyId: req.body.partyId,
        categoryId: req.body.categoryId,
        amount: req.body.totalAmount,
        description: req.body.description,
      },
    });

    const existingLedger = await tx.partyLedgerEntry.findFirst({
      where: { chemicalPurchaseId: updated.id },
    });

    if (updated.partyId && updated.paymentType === "CREDIT") {
      if (existingLedger) {
        await tx.partyLedgerEntry.update({
          where: { id: existingLedger.id },
          data: {
            partyId: updated.partyId,
            date: updated.date,
            reference: "Chemical Purchase",
            description: req.body.description,
            debit: 0,
            credit: updated.totalAmount,
          },
        });
      } else {
        await tx.partyLedgerEntry.create({
          data: {
            partyId: updated.partyId,
            date: updated.date,
            reference: "Chemical Purchase",
            description: req.body.description,
            debit: 0,
            credit: updated.totalAmount,
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
        paymentType: paymentType ?? "CASH",
      },
    });

    const expense = await tx.expenseEntry.create({
      data: {
        date: new Date(date),
        categoryId: req.body.categoryId,
        partyId,
        module: "REXINE",
        amount: totalAmount,
        description: req.body.description,
        rexinePurchaseId: purchase.id,
      },
    });

    if (purchase.partyId && purchase.paymentType === "CREDIT") {
      await tx.partyLedgerEntry.create({
        data: {
          partyId: purchase.partyId,
          date: purchase.date,
          reference: "Rexine Purchase",
          description: req.body.description,
          debit: 0,
          credit: purchase.totalAmount,
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
        paymentType: req.body.paymentType,
      },
    });

    await tx.expenseEntry.updateMany({
      where: { rexinePurchaseId: updated.id },
      data: {
        date: req.body.date ? new Date(req.body.date) : undefined,
        partyId: req.body.partyId,
        categoryId: req.body.categoryId,
        amount: req.body.totalAmount,
        description: req.body.description,
      },
    });

    const existingLedger = await tx.partyLedgerEntry.findFirst({
      where: { rexinePurchaseId: updated.id },
    });

    if (updated.partyId && updated.paymentType === "CREDIT") {
      if (existingLedger) {
        await tx.partyLedgerEntry.update({
          where: { id: existingLedger.id },
          data: {
            partyId: updated.partyId,
            date: updated.date,
            reference: "Rexine Purchase",
            description: req.body.description,
            debit: 0,
            credit: updated.totalAmount,
          },
        });
      } else {
        await tx.partyLedgerEntry.create({
          data: {
            partyId: updated.partyId,
            date: updated.date,
            reference: "Rexine Purchase",
            description: req.body.description,
            debit: 0,
            credit: updated.totalAmount,
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
        paymentType: paymentType ?? "CASH",
      },
    });

    const expense = await tx.expenseEntry.create({
      data: {
        date: new Date(date),
        categoryId: req.body.categoryId,
        partyId,
        module: "MATERIAL",
        amount: totalAmount,
        description: req.body.description,
        materialPurchaseId: purchase.id,
      },
    });

    if (purchase.partyId && purchase.paymentType === "CREDIT") {
      await tx.partyLedgerEntry.create({
        data: {
          partyId: purchase.partyId,
          date: purchase.date,
          reference: "Material Purchase",
          description: req.body.description,
          debit: 0,
          credit: purchase.totalAmount,
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
        paymentType: req.body.paymentType,
      },
    });

    await tx.expenseEntry.updateMany({
      where: { materialPurchaseId: updated.id },
      data: {
        date: req.body.date ? new Date(req.body.date) : undefined,
        partyId: req.body.partyId,
        categoryId: req.body.categoryId,
        amount: req.body.totalAmount,
        description: req.body.description,
      },
    });

    const existingLedger = await tx.partyLedgerEntry.findFirst({
      where: { materialPurchaseId: updated.id },
    });

    if (updated.partyId && updated.paymentType === "CREDIT") {
      if (existingLedger) {
        await tx.partyLedgerEntry.update({
          where: { id: existingLedger.id },
          data: {
            partyId: updated.partyId,
            date: updated.date,
            reference: "Material Purchase",
            description: req.body.description,
            debit: 0,
            credit: updated.totalAmount,
          },
        });
      } else {
        await tx.partyLedgerEntry.create({
          data: {
            partyId: updated.partyId,
            date: updated.date,
            reference: "Material Purchase",
            description: req.body.description,
            debit: 0,
            credit: updated.totalAmount,
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
