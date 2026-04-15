const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const APP_TIME_ZONE = "Asia/Karachi";
const PAKISTAN_OFFSET_MS = 5 * 60 * 60 * 1000;

const pad = (value) => String(value).padStart(2, "0");

const toValidDate = (value) => {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const parseDateOnly = (value) => {
  const [year, month, day] = String(value).split("-").map(Number);
  if (![year, month, day].every(Number.isFinite)) return undefined;
  return { year, month, day };
};

const partsToDate = (parts, boundary = "start") => {
  if (!parts) return undefined;
  const hours = boundary === "end" ? 23 : 0;
  const minutes = boundary === "end" ? 59 : 0;
  const seconds = boundary === "end" ? 59 : 0;
  const milliseconds = boundary === "end" ? 999 : 0;

  return new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      hours,
      minutes,
      seconds,
      milliseconds,
    ) - PAKISTAN_OFFSET_MS,
  );
};

export const getPakistanDateParts = (value) => {
  if (!value) return undefined;
  if (typeof value === "string" && DATE_ONLY_PATTERN.test(value.trim())) {
    return parseDateOnly(value.trim());
  }

  const date = toValidDate(value);
  if (!date) return undefined;

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const read = (type) => Number(parts.find((part) => part.type === type)?.value ?? NaN);

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
  };
};

const getPakistanCalendarWeekday = (parts) =>
  new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();

const shiftPakistanPartsByDays = (parts, days) => {
  const shifted = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + days),
  );

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
};

export const formatDateKey = (value) => {
  const parts = getPakistanDateParts(value);
  if (!parts) return "";
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
};

export const formatMonthKey = (value) => {
  const parts = getPakistanDateParts(value);
  if (!parts) return "";
  return `${parts.year}-${pad(parts.month)}`;
};

export const formatDateTime = (
  value,
  locale = "en-GB",
  options = {},
) => {
  const date = toValidDate(value);
  if (!date) return "-";

  return new Intl.DateTimeFormat(locale, {
    timeZone: APP_TIME_ZONE,
    ...options,
  }).format(date);
};

export const startOfDay = (value) =>
  partsToDate(getPakistanDateParts(value), "start");

export const endOfDay = (value) =>
  partsToDate(getPakistanDateParts(value), "end");

export const getWeekStart = (value) => {
  const parts = getPakistanDateParts(value);
  if (!parts) return undefined;
  const day = getPakistanCalendarWeekday(parts);
  const mondayOffset = (day + 6) % 7;
  return partsToDate(shiftPakistanPartsByDays(parts, -mondayOffset), "start");
};

export const getMonthStart = (value) => {
  const parts = getPakistanDateParts(value);
  if (!parts) return undefined;
  return partsToDate({ year: parts.year, month: parts.month, day: 1 }, "start");
};

export const getMonthEnd = (value) => {
  const parts = getPakistanDateParts(value);
  if (!parts) return undefined;
  const monthEnd = new Date(Date.UTC(parts.year, parts.month, 0));
  return partsToDate(
    {
      year: monthEnd.getUTCFullYear(),
      month: monthEnd.getUTCMonth() + 1,
      day: monthEnd.getUTCDate(),
    },
    "end",
  );
};

export const getCurrentDate = () => formatDateKey(new Date());

export const toDate = (value, boundary = "start") => {
  if (!value) return undefined;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    if (boundary === "end") return endOfDay(value);
    if (boundary === "start") return startOfDay(value);
    return new Date(value.getTime());
  }

  const rawValue = String(value).trim();
  if (!rawValue) return undefined;

  if (DATE_ONLY_PATTERN.test(rawValue)) {
    return partsToDate(parseDateOnly(rawValue), boundary);
  }

  const parsed = toValidDate(rawValue);
  if (!parsed) return undefined;
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
