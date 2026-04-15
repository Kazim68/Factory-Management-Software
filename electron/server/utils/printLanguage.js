const PRINT_TRANSLATIONS = {
  "Supplier Purchase Report": "سپلائر خریداری رپورٹ",
  "Labor Work Entries": "لیبر ورک اندراجات",
  "Production Control Orders": "پروڈکشن کنٹرول آرڈرز",
  "Pressman Orders": "پریس مین آرڈرز",
  "Generated At": "تیار ہونے کا وقت",
  "Type Filters": "قسم کے فلٹرز",
  "Time Filter": "وقت کا فلٹر",
  "Date Range": "تاریخی حدود",
  From: "سے",
  To: "تک",
  "Total Rows": "کل قطاریں",
  "Grand Total": "گرینڈ ٹوٹل",
  Date: "تاریخ",
  Supplier: "سپلائر",
  Type: "قسم",
  Item: "آئٹم",
  Quantity: "مقدار",
  Rate: "ریٹ",
  Total: "کل",
  Payment: "ادائیگی",
  Department: "شعبہ",
  Search: "تلاش",
  All: "تمام",
  "All Departments": "تمام شعبے",
  Labor: "لیبر",
  Article: "آرٹیکل",
  "Total Amount": "کل رقم",
  Orders: "آرڈرز",
  Size: "سائز",
  "Quantity (Dozen)": "مقدار (درجن)",
  "Price / Pair": "قیمت / جوڑا",
  "Price / Dozen": "قیمت / درجن",
  "A-Mall Qty": "اے مال مقدار",
  "Completed Qty": "مکمل مقدار",
  Status: "اسٹیٹس",
  "No records found for selected filters.": "منتخب فلٹرز کے لیے کوئی ریکارڈ نہیں ملا۔",
  "No work entries for selected filters.": "منتخب فلٹرز کے لیے کوئی ورک اندراج نہیں ملا۔",
  "No orders in this subsection.": "اس ذیلی حصے میں کوئی آرڈر نہیں ہے۔",
  "No pressman orders for this date.": "اس تاریخ کے لیے کوئی پریس مین آرڈر نہیں ہے۔",
  Unknown: "نامعلوم",
  "Raw Material": "خام مال",
  Khata: "کھاتہ",
  Cheque: "چیک",
  Bank: "بینک",
  Cash: "نقد",
  CHEMICAL: "کیمیکل",
  REXINE: "ریکسین",
  MATERIAL: "میٹیریل",
  DAILY: "آج",
  WEEKLY: "اس ہفتے",
  MONTHLY: "ماہانہ",
  YEARLY: "سالانہ",
  CUSTOM: "حسب منشا",
  THIS_MONTH: "اس مہینے",
  "This Month": "اس مہینے",
  Incomplete: "نامکمل",
  "Partially Complete": "جزوی طور پر مکمل",
  Complete: "مکمل",
  Pressman: "پریس مین",
  Upperman: "اپر مین",
  Printing: "پرنٹنگ",
  "D/C": "ڈی سی",
  DC: "ڈی سی",
  Machineman: "مشین مین",
  "Machine Man": "مشین مین",
  Packing: "پیکنگ",
  kg: "کلو",
  meter: "میٹر",
};

export const normalizePrintLanguage = (value) =>
  String(value ?? "").trim().toLowerCase() === "ur" ? "ur" : "en";

export const getPrintDirection = (language) =>
  normalizePrintLanguage(language) === "ur" ? "rtl" : "ltr";

export const getPrintTextAlign = (language) =>
  normalizePrintLanguage(language) === "ur" ? "right" : "left";

export const getPrintLocale = (language, type = "default") => {
  if (normalizePrintLanguage(language) === "ur") {
    return "ur-PK";
  }

  if (type === "date") return "en-GB";
  return "en-US";
};

export const getPrintFontFamily = (language) =>
  normalizePrintLanguage(language) === "ur"
    ? '"Noto Nastaliq Urdu", "Noto Naskh Arabic", "Segoe UI", Tahoma, Arial, sans-serif'
    : "Arial, sans-serif";

export const translatePrintText = (value, language) => {
  const text = String(value ?? "");
  if (normalizePrintLanguage(language) !== "ur") return text;
  return PRINT_TRANSLATIONS[text] ?? text;
};

export const translatePrintList = (values, language) =>
  values.map((value) => translatePrintText(value, language)).join(", ");

export const formatPrintNumber = (
  value,
  language,
  options = { maximumFractionDigits: 2 },
) => {
  const numericValue = Number(value ?? 0);
  if (!Number.isFinite(numericValue)) return "0";
  return numericValue.toLocaleString(getPrintLocale(language), options);
};
