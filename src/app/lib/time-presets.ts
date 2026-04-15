import {
  getDateKey,
  getMonthKey,
  toPakistanBoundaryDate,
} from "./utils";

export type FilterTimePreset =
  | "DAILY"
  | "WEEKLY"
  | "MONTHLY"
  | "YEARLY"
  | "THIS_MONTH"
  | "CUSTOM";

export const FILTER_TIME_PRESET_OPTIONS: Array<{
  value: FilterTimePreset;
  label: string;
}> = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY", label: "Yearly" },
  { value: "THIS_MONTH", label: "This Month" },
  { value: "CUSTOM", label: "Custom Date Range" },
];

export const getPresetDateRange = (preset: FilterTimePreset, now: Date) => {
  const todayKey = getDateKey(now);

  if (preset === "DAILY") {
    return {
      from: toPakistanBoundaryDate(todayKey, "start"),
      to: toPakistanBoundaryDate(todayKey, "end"),
    };
  }

  if (preset === "WEEKLY") {
    const calendarDay = new Date(`${todayKey}T00:00:00Z`).getUTCDay();
    const mondayOffset = (calendarDay + 6) % 7;
    const startKey = getDateKey(
      new Date(`${todayKey}T00:00:00Z`).getTime() - mondayOffset * 86400000,
    );
    const endKey = getDateKey(
      new Date(`${startKey}T00:00:00Z`).getTime() + 6 * 86400000,
    );
    return {
      from: toPakistanBoundaryDate(startKey, "start"),
      to: toPakistanBoundaryDate(endKey, "end"),
    };
  }

  if (preset === "MONTHLY" || preset === "THIS_MONTH") {
    const monthKey = getMonthKey(now);
    const [year, month] = monthKey.split("-").map(Number);
    const monthEnd = new Date(Date.UTC(year, month, 0));
    return {
      from: toPakistanBoundaryDate(`${monthKey}-01`, "start"),
      to: toPakistanBoundaryDate(
        `${monthKey}-${String(monthEnd.getUTCDate()).padStart(2, "0")}`,
        "end",
      ),
    };
  }

  if (preset === "YEARLY") {
    const year = todayKey.slice(0, 4);
    return {
      from: toPakistanBoundaryDate(`${year}-01-01`, "start"),
      to: toPakistanBoundaryDate(`${year}-12-31`, "end"),
    };
  }

  return null;
};
