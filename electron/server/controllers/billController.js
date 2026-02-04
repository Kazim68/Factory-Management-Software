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
