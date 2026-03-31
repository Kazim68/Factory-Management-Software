import prisma from "../prisma.js";
import {
  LABOR_DEPARTMENTS,
  getLaborDepartmentLabel,
  LABOR_DEPARTMENT_IDS,
} from "../constants/laborDepartments.js";

export const getLaborDepartmentLabelMap = async (client = prisma) => {
  const rows = await client.laborDepartmentName.findMany({
    where: {
      department: { in: LABOR_DEPARTMENT_IDS },
    },
    orderBy: { department: "asc" },
  });

  const labels = Object.fromEntries(
    LABOR_DEPARTMENTS.map((department) => [department.id, department.name])
  );

  for (const row of rows) {
    const trimmedName = String(row.name ?? "").trim();
    if (trimmedName) {
      labels[row.department] = trimmedName;
    }
  }

  return labels;
};

export const listLaborDepartments = async (client = prisma) => {
  const labels = await getLaborDepartmentLabelMap(client);
  return LABOR_DEPARTMENTS.map((department) => ({
    id: department.id,
    name: labels[department.id] ?? department.name,
  }));
};

export const getLaborDepartmentLabelFromMap = (departmentId, labelMap) =>
  labelMap?.[departmentId] ?? getLaborDepartmentLabel(departmentId);
