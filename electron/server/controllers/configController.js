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

export const updateUnit = async (req, res) => {
  const unit = await prisma.unit.update({
    where: { id: req.params.unitId },
    data: {
      name: req.body.name,
      symbol: req.body.symbol,
    },
  });
  res.json(unit);
};

export const deleteUnit = async (req, res) => {
  await prisma.unit.delete({ where: { id: req.params.unitId } });
  res.status(204).end();
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

export const updateArticle = async (req, res) => {
  const article = await prisma.article.update({
    where: { id: req.params.articleId },
    data: {
      name: req.body.name,
      code: req.body.code,
    },
  });
  res.json(article);
};

export const deleteArticle = async (req, res) => {
  await prisma.article.delete({ where: { id: req.params.articleId } });
  res.status(204).end();
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

export const updateLaborCategory = async (req, res) => {
  const category = await prisma.laborCategory.update({
    where: { id: req.params.categoryId },
    data: { name: req.body.name },
  });
  res.json(category);
};

export const deleteLaborCategory = async (req, res) => {
  await prisma.laborCategory.delete({ where: { id: req.params.categoryId } });
  res.status(204).end();
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

export const updatePaymentType = async (req, res) => {
  const type = await prisma.paymentCalculationType.update({
    where: { id: req.params.paymentTypeId },
    data: {
      name: req.body.name,
      unitId: req.body.unitId ?? null,
    },
    include: { unit: true },
  });
  res.json(type);
};

export const deletePaymentType = async (req, res) => {
  await prisma.paymentCalculationType.delete({
    where: { id: req.params.paymentTypeId },
  });
  res.status(204).end();
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

export const updateExpenseCategory = async (req, res) => {
  const category = await prisma.expenseCategory.update({
    where: { id: req.params.expenseCategoryId },
    data: { name: req.body.name },
  });
  res.json(category);
};

export const deleteExpenseCategory = async (req, res) => {
  await prisma.expenseCategory.delete({
    where: { id: req.params.expenseCategoryId },
  });
  res.status(204).end();
};
