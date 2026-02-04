import prisma from "../prisma.js";

export const listUnits = async (req, res) => {
  const units = await prisma.unit.findMany({ orderBy: { name: "asc" } });
  res.json(units);
};

export const createUnit = async (req, res) => {
  const unit = await prisma.unit.create({
    data: {
      name: req.body.name,
      symbol: req.body.symbol,
    },
  });
  res.status(201).json(unit);
};

export const listArticles = async (req, res) => {
  const articles = await prisma.article.findMany({ orderBy: { name: "asc" } });
  res.json(articles);
};

export const createArticle = async (req, res) => {
  const article = await prisma.article.create({
    data: {
      name: req.body.name,
      code: req.body.code,
    },
  });
  res.status(201).json(article);
};

export const listLaborCategories = async (req, res) => {
  const categories = await prisma.laborCategory.findMany({
    orderBy: { name: "asc" },
  });
  res.json(categories);
};

export const createLaborCategory = async (req, res) => {
  const category = await prisma.laborCategory.create({
    data: { name: req.body.name },
  });
  res.status(201).json(category);
};

export const listPaymentTypes = async (req, res) => {
  const types = await prisma.paymentCalculationType.findMany({
    include: { unit: true },
    orderBy: { name: "asc" },
  });
  res.json(types);
};

export const createPaymentType = async (req, res) => {
  const type = await prisma.paymentCalculationType.create({
    data: {
      name: req.body.name,
      unitId: req.body.unitId,
    },
  });
  res.status(201).json(type);
};

export const listExpenseCategories = async (req, res) => {
  const categories = await prisma.expenseCategory.findMany({
    orderBy: { name: "asc" },
  });
  res.json(categories);
};

export const createExpenseCategory = async (req, res) => {
  const category = await prisma.expenseCategory.create({
    data: { name: req.body.name },
  });
  res.status(201).json(category);
};
