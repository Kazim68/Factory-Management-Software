import { getLocaleForLanguage, getStoredLanguage } from "./i18n";

export const APP_TIME_ZONE = "Asia/Karachi";
const PAKISTAN_OFFSET_MS = 5 * 60 * 60 * 1000;

const pad = (value: number) => String(value).padStart(2, "0");

const toValidDate = (value: string | number | Date) => {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export function getTimeZoneDateParts(value: string | number | Date) {
  const date = toValidDate(value);
  if (!date) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? NaN);

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
  };
}

export function getDateKey(value: string | number | Date): string {
  const parts = getTimeZoneDateParts(value);
  if (!parts) return "";
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function getMonthKey(value: string | number | Date): string {
  const parts = getTimeZoneDateParts(value);
  if (!parts) return "";
  return `${parts.year}-${pad(parts.month)}`;
}

export function getYearKey(value: string | number | Date): string {
  const parts = getTimeZoneDateParts(value);
  return parts ? String(parts.year) : "";
}

export function toPakistanBoundaryDate(
  value: string | number | Date,
  boundary: "start" | "end" = "start",
): Date {
  const parts = getTimeZoneDateParts(value);
  if (!parts) return new Date(NaN);

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
}

export function formatDateTime(
  value: string | number | Date,
  locale = getLocaleForLanguage(getStoredLanguage(), "date"),
  options: Intl.DateTimeFormatOptions = {},
): string {
  const date = toValidDate(value);
  if (!date) return "-";

  return new Intl.DateTimeFormat(locale, {
    timeZone: APP_TIME_ZONE,
    ...options,
  }).format(date);
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(getLocaleForLanguage(getStoredLanguage(), "currency"), {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return formatDateTime(
    date,
    getLocaleForLanguage(getStoredLanguage(), "date"),
    {
    year: "numeric",
    month: "short",
    day: "numeric",
    },
  );
}

export function getCurrentDate(): string {
  return getDateKey(new Date());
}

export function createEditLog(user: string, field: string, oldValue: any, newValue: any) {
  return {
    timestamp: new Date().toISOString(),
    user,
    field,
    oldValue,
    newValue,
  };
}
