import prisma from "../prisma.js";

const buildBillNumber = () => `BILL-${Date.now()}`;

export const listBills = async (req, res) => {
  const bills = await prisma.bill.findMany({
    include: { lines: { include: { article: true } }, party: true },
    orderBy: { date: "desc" },
  });
  res.json(bills);
};

export const createBill = async (req, res) => {
  const { date, partyId, type, status, lines } = req.body;
  const bill = await prisma.bill.create({
    data: {
      billNumber: buildBillNumber(),
      date: new Date(date),
      partyId,
      type: type ?? "CASH",
      status: status ?? "DRAFT",
      total: lines.reduce((sum, line) => sum + Number(line.total), 0),
      lines: {
        create: lines.map((line) => ({
          articleId: line.articleId,
          quantity: line.quantity,
          price: line.price,
          total: line.total,
        })),
      },
    },
    include: { lines: true },
  });

  res.status(201).json(bill);
};

export const confirmBill = async (req, res) => {
  const bill = await prisma.bill.update({
    where: { id: req.params.billId },
    data: { status: "CONFIRMED" },
  });

  if (bill.type === "CREDIT" && bill.partyId) {
    await prisma.partyLedgerEntry.create({
      data: {
        partyId: bill.partyId,
        date: bill.date,
        reference: bill.billNumber,
        description: "Credit bill",
        debit: 0,
        credit: bill.total,
      },
    });
  }

  res.json(bill);
};

export const updateBill = async (req, res) => {
  const { date, partyId, type, status, lines } = req.body;
  const bill = await prisma.$transaction(async (tx) => {
    const updated = await tx.bill.update({
      where: { id: req.params.billId },
      data: {
        date: date ? new Date(date) : undefined,
        partyId,
        type,
        status,
        total: lines ? lines.reduce((sum, line) => sum + Number(line.total), 0) : undefined,
      },
    });

    if (Array.isArray(lines)) {
      await tx.billLine.deleteMany({ where: { billId: updated.id } });
      await tx.billLine.createMany({
        data: lines.map((line) => ({
          billId: updated.id,
          articleId: line.articleId,
          quantity: line.quantity,
          price: line.price,
          total: line.total,
        })),
      });
    }

    return tx.bill.findUnique({
      where: { id: updated.id },
      include: { lines: { include: { article: true } }, party: true },
    });
  });

  res.json(bill);
};

export const deleteBill = async (req, res) => {
  await prisma.$transaction(async (tx) => {
    await tx.billLine.deleteMany({ where: { billId: req.params.billId } });
    await tx.bill.delete({ where: { id: req.params.billId } });
  });
  res.status(204).end();
};
