export const LABOR_DEPARTMENTS = [
  { id: "PRESSMAN", name: "Pressman" },
  { id: "UPPERMAN", name: "Upperman" },
  { id: "PRINTING", name: "Printing" },
  { id: "DC", name: "DC" },
  { id: "MACHINEMAN", name: "Machineman" },
  { id: "PACKING", name: "Packing" },
  { id: "MONTHLY_LABOUR", name: "Monthly Labour" },
];

export const LABOR_DEPARTMENT_IDS = LABOR_DEPARTMENTS.map((item) => item.id);

export const PRODUCTION_LABOR_DEPARTMENT_IDS = LABOR_DEPARTMENTS.filter(
  (item) => item.id !== "MONTHLY_LABOUR",
).map((item) => item.id);

export const isLaborDepartment = (value) =>
  LABOR_DEPARTMENT_IDS.includes(String(value ?? "").toUpperCase());

export const normalizeLaborDepartment = (value, fallback = "PRESSMAN") => {
  const normalized = String(value ?? "").toUpperCase();
  return isLaborDepartment(normalized) ? normalized : fallback;
};

export const getLaborDepartmentLabel = (departmentId) =>
  LABOR_DEPARTMENTS.find((item) => item.id === departmentId)?.name ?? departmentId;
