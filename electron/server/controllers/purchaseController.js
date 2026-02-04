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
        },
      });
    }

    return { purchase, expense };
  });

  res.status(201).json(result);
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
        },
      });
    }

    return { purchase, expense };
  });

  res.status(201).json(result);
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
        },
      });
    }

    return { purchase, expense };
  });

  res.status(201).json(result);
};
