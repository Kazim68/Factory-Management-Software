export const toDate = (value) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
};

export const withDateRange = (start, end) => {
  const range = {};
  if (start) range.gte = start;
  if (end) range.lte = end;
  return Object.keys(range).length ? range : undefined;
};

export const groupByPeriod = (items, keyFn) =>
  items.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) {
      acc[key] = { key, total: 0, items: [] };
    }
    acc[key].items.push(item);
    acc[key].total += Number(item.amount ?? item.totalAmount ?? 0);
    return acc;
  }, {});
