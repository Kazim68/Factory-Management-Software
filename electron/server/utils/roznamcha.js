export const createSystemRoznamchaEntry = async (
  tx,
  {
    date,
    amount,
    description,
    module = "MISC",
    partyId,
    laborId,
    sourceSystem,
    paymentType = "CASH",
  }
) => {
  return tx.expenseEntry.create({
    data: {
      date,
      partyId,
      laborId,
      module,
      paymentType,
      amount,
      description,
      source: "SYSTEM",
      sourceSystem,
    },
  });
};
