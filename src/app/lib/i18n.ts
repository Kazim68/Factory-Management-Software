export type AppLanguage = "en" | "ur";

export const APP_LANGUAGE_STORAGE_KEY = "factory_app_language";

export const LANGUAGE_OPTIONS: Array<{ value: AppLanguage; label: string }> = [
  { value: "en", label: "English" },
  { value: "ur", label: "اردو" },
];

const DEFAULT_LANGUAGE: AppLanguage = "en";

const EXACT_TRANSLATIONS: Record<string, string> = {
  English: "English",
  Urdu: "اردو",
  Dashboard: "ڈیش بورڈ",
  Roznamcha: "روزنامچہ",
  "Stock Control": "اسٹاک کنٹرول",
  "Production Control": "پروڈکشن کنٹرول",
  Bills: "بلز",
  Cheques: "چیکس",
  Labor: "لیبر",
  "Party (Customers)": "پارٹی (کسٹمرز)",
  "Party (Suppliers)": "پارٹی (سپلائرز)",
  Configuration: "کنفیگریشن",
  Users: "صارفین",
  "Audit Logs": "آڈٹ لاگز",
  "Factory Management": "فیکٹری مینجمنٹ",
  "Page Failed To Load": "صفحہ لوڈ نہیں ہوسکا",
  "Sign In": "سائن اِن",
  Username: "صارف نام",
  Password: "پاس ورڈ",
  Logout: "لاگ آؤٹ",
  Language: "زبان",
  Search: "تلاش",
  Balance: "بیلنس",
  "Reset Filters": "فلٹر ری سیٹ کریں",
  Print: "پرنٹ",
  "Print List": "فہرست پرنٹ کریں",
  "Print Bill": "بل پرنٹ کریں",
  Add: "شامل کریں",
  Edit: "ترمیم",
  Update: "اپڈیٹ",
  Delete: "حذف کریں",
  Save: "محفوظ کریں",
  Cancel: "منسوخ کریں",
  Close: "بند کریں",
  Date: "تاریخ",
  From: "سے",
  To: "تک",
  Today: "آج",
  "This Week": "اس ہفتے",
  "This Month": "اس مہینے",
  "Custom Date": "حسبِ منشا تاریخ",
  "Custom Date Range": "حسبِ منشا تاریخ",
  "All Dates": "تمام تاریخیں",
  "All Entries": "تمام اندراجات",
  "All Balances": "تمام بیلنس",
  "Positive Balance": "مثبت بیلنس",
  "Negative Balance": "منفی بیلنس",
  "Zero Balance": "صفر بیلنس",
  Payable: "قابل ادا",
  Receivable: "قابل وصول",
  Cash: "نقد",
  Bank: "بینک",
  Cheque: "چیک",
  Khata: "کھاتہ",
  Ledger: "لیجر",
  "Customer Profile": "کسٹمر پروفائل",
  "Supplier Profile": "سپلائر پروفائل",
  "Supplier Ledger": "سپلائر لیجر",
  "Purchase Bills": "خریداری بلز",
  Customer: "کسٹمر",
  Supplier: "سپلائر",
  Status: "اسٹیٹس",
  Type: "قسم",
  Method: "طریقہ",
  Amount: "رقم",
  Description: "تفصیل",
  Total: "کل",
  Paid: "ادا شدہ",
  Remaining: "بقیہ",
  Pending: "زیر التوا",
  "Pending bills": "زیر التوا بلز",
  Quantity: "مقدار",
  Price: "قیمت",
  Rate: "ریٹ",
  Rows: "قطاریں",
  Previous: "پچھلا",
  Next: "اگلا",
  "More pages": "مزید صفحات",
  Loading: "لوڈ ہو رہا ہے",
  Role: "کردار",
  Admin: "ایڈمن",
  "Super Admin": "سپر ایڈمن",
  "Sub Admin": "سب ایڈمن",
  "No results found.": "کوئی نتیجہ نہیں ملا۔",
  "Select option": "آپشن منتخب کریں",
  "Type to search...": "تلاش کیلئے ٹائپ کریں...",
  "No parties yet": "ابھی کوئی پارٹی موجود نہیں۔",
  "No customers found for this customer.": "اس کسٹمر کے لیے کوئی بل نہیں ملا۔",
  "Payment Mode": "ادائیگی کا طریقہ",
  "Added To Khata": "کھاتے میں شامل",
  "Gross Total": "مجموعی کل",
  "Current Balance": "موجودہ بیلنس",
  "Bill Summary": "بل خلاصہ",
  "Product Details": "مصنوعات کی تفصیل",
  "Product Name": "مصنوعہ کا نام",
  "Customer Details": "کسٹمر کی تفصیل",
  "Walk-in Customer": "واک اِن کسٹمر",
  "Contact Numbers": "رابطہ نمبر",
  Address: "پتہ",
  Invoice: "انوائس",
  "Invoice No": "انوائس نمبر",
  "Invoice Number": "انوائس نمبر",
  "Billing Date": "بل کی تاریخ",
  "Customer Name": "کسٹمر کا نام",
  "Customer Phone": "کسٹمر فون",
  "Sales Invoice": "سیلز انوائس",
  "Bill No": "بل نمبر",
  "Total Quantity": "کل مقدار",
  "Total Amount": "کل رقم",
  "Entry Type": "اندراج کی قسم",
  "Record Payment": "ادائیگی درج کریں",
  "Dozen": "درجن",
  "Pairs": "جوڑے",
  "Size": "سائز",
  "Standard Size": "معیاری سائز",
  "Select method": "طریقہ منتخب کریں",
  "Select bill": "بل منتخب کریں",
  "No pending bills": "کوئی زیر التوا بل نہیں",
  "Select cheque": "چیک منتخب کریں",
  "No available cheques": "کوئی دستیاب چیک نہیں",
  "Search cheque...": "چیک تلاش کریں...",
  "Search bill...": "بل تلاش کریں...",
  "Search supplier...": "سپلائر تلاش کریں...",
  "Search customer...": "کسٹمر تلاش کریں...",
  "Search party...": "پارٹی تلاش کریں...",
  "Search article...": "آرٹیکل تلاش کریں...",
  "Search payment type...": "ادائیگی کی قسم تلاش کریں...",
  "Search unit...": "یونٹ تلاش کریں...",
  "Search reference or note...": "ریفرنس یا نوٹ تلاش کریں...",
  "Search bill number or status...": "بل نمبر یا اسٹیٹس تلاش کریں...",
  "Search customer name...": "کسٹمر کا نام تلاش کریں...",
  "Enter username": "صارف نام درج کریں",
  "Enter password": "پاس ورڈ درج کریں",
  "Default admin": "ڈیفالٹ ایڈمن",
  "Use your credentials to continue. Default admin:": "جاری رکھنے کے لیے اپنی اسناد استعمال کریں۔ ڈیفالٹ ایڈمن:",
  "Welcome back": "خوش آمدید",
  "Login failed": "لاگ اِن ناکام ہوگیا",
  "Logged out successfully": "کامیابی سے لاگ آؤٹ ہوگیا",
  "Invalid username or password": "غلط صارف نام یا پاس ورڈ",
  "Username already exists": "یہ صارف نام پہلے سے موجود ہے",
  "User not found": "صارف نہیں ملا",
  "At least one admin or super admin user is required": "کم از کم ایک ایڈمن یا سپر ایڈمن صارف ضروری ہے",
  "Loading parties...": "پارٹیاں لوڈ ہو رہی ہیں...",
  "Loading suppliers...": "سپلائرز لوڈ ہو رہے ہیں...",
  "Loading bills...": "بلز لوڈ ہو رہے ہیں...",
  "Loading purchases...": "خریداریاں لوڈ ہو رہی ہیں...",
  "Loading purchase records...": "خریداری کا ریکارڈ لوڈ ہو رہا ہے...",
  "Loading payment types...": "ادائیگی کی اقسام لوڈ ہو رہی ہیں...",
  "No ledger entries yet.": "ابھی کوئی لیجر اندراج موجود نہیں۔",
  "No bills found for this customer.": "اس کسٹمر کے لیے کوئی بل نہیں ملا۔",
  "No purchases found for this supplier.": "اس سپلائر کے لیے کوئی خریداری نہیں ملی۔",
  "No bills available to print.": "پرنٹ کرنے کے لیے کوئی بل موجود نہیں۔",
  "No bills match the current filters.": "موجودہ فلٹرز سے کوئی بل نہیں ملا۔",
  "No purchases match the current filters.": "موجودہ فلٹرز سے کوئی خریداری نہیں ملی۔",
  "No purchases available to print.": "پرنٹ کرنے کے لیے کوئی خریداری موجود نہیں۔",
  "No ledger rows available to print.": "پرنٹ کرنے کے لیے لیجر قطاریں موجود نہیں۔",
  "Unable to open print preview.": "پرنٹ پیش نظارہ نہیں کھل سکا۔",
  "Unable to open bills print preview.": "بلز کا پرنٹ پیش نظارہ نہیں کھل سکا۔",
  "Unable to open purchases print preview.": "خریداریوں کا پرنٹ پیش نظارہ نہیں کھل سکا۔",
  "Unable to open bill print preview.": "بل کا پرنٹ پیش نظارہ نہیں کھل سکا۔",
  "Failed to load parties.": "پارٹیاں لوڈ نہیں ہوسکیں۔",
  "Failed to load customer bills.": "کسٹمر بلز لوڈ نہیں ہوسکے۔",
  "Failed to load supplier purchases.": "سپلائر کی خریداریاں لوڈ نہیں ہوسکیں۔",
  "Failed to load party ledger.": "پارٹی لیجر لوڈ نہیں ہوسکا۔",
  "Failed to record payment.": "ادائیگی درج نہیں ہوسکی۔",
  "Payment recorded": "ادائیگی درج ہوگئی",
  "Bill created": "بل بن گیا",
  "Bill updated": "بل اپڈیٹ ہوگیا",
  "Bill deleted": "بل حذف ہوگیا",
  "Bill verified": "بل تصدیق ہوگیا",
  "Supplier Purchase Report": "سپلائر خریداری رپورٹ",
  "Labor Work Entries": "لیبر ورک اندراجات",
  "Production Control Orders": "پروڈکشن کنٹرول آرڈرز",
  "Pressman Orders": "پریس مین آرڈرز",
  "Generated on": "تیار ہونے کی تاریخ",
  "Generated At": "تیار ہونے کا وقت",
  Filters: "فلٹرز",
  "Type Filters": "قسم کے فلٹرز",
  "Time Filter": "وقت کا فلٹر",
  "Date Range": "تاریخی حدود",
  "Total Rows": "کل قطاریں",
  Department: "شعبہ",
  "All Departments": "تمام شعبے",
  All: "تمام",
  Orders: "آرڈرز",
  Item: "آئٹم",
  Payment: "ادائیگی",
  "Quantity (Dozen)": "مقدار (درجن)",
  "Price / Pair": "قیمت / جوڑا",
  "Price / Dozen": "قیمت / درجن",
  "A-Mall Qty": "اے مال مقدار",
  "Completed Qty": "مکمل مقدار",
  "No work entries for selected filters.": "منتخب فلٹرز کے لیے کوئی ورک اندراج نہیں ملا۔",
  "No orders in this subsection.": "اس ذیلی حصے میں کوئی آرڈر نہیں ہے۔",
  "No pressman orders for this date.": "اس تاریخ کے لیے کوئی پریس مین آرڈر نہیں ہے۔",
  "Raw Material": "خام مال",
  Unknown: "نامعلوم",
  "Unable to open print window.": "پرنٹ ونڈو نہیں کھل سکی۔",
  "Failed to generate printable report.": "پرنٹ کے لیے رپورٹ تیار نہیں ہو سکی۔",
  "Failed to generate printable work entries.": "پرنٹ کے لیے ورک اندراجات تیار نہیں ہو سکے۔",
  "Failed to generate printable department report.": "پرنٹ کے لیے ڈپارٹمنٹ رپورٹ تیار نہیں ہو سکی۔",
  "Failed to generate printable daily report.": "پرنٹ کے لیے روزانہ رپورٹ تیار نہیں ہو سکی۔",
  "Search purchase type or item...": "خریداری کی قسم یا آئٹم تلاش کریں...",
  "All purchases": "تمام خریداریاں",
};

const PHRASE_TRANSLATIONS: Record<string, string> = {
  "Factory Management": "فیکٹری مینجمنٹ",
  Dashboard: "ڈیش بورڈ",
  Roznamcha: "روزنامچہ",
  "Stock Control": "اسٹاک کنٹرول",
  "Production Control": "پروڈکشن کنٹرول",
  "Party (Customers)": "پارٹی (کسٹمرز)",
  "Party (Suppliers)": "پارٹی (سپلائرز)",
  Configuration: "کنفیگریشن",
  "Audit Logs": "آڈٹ لاگز",
  Customer: "کسٹمر",
  Customers: "کسٹمرز",
  Supplier: "سپلائر",
  Suppliers: "سپلائرز",
  Profile: "پروفائل",
  Party: "پارٹی",
  Bills: "بلز",
  Bill: "بل",
  Ledger: "لیجر",
  Search: "تلاش",
  Filter: "فلٹر",
  Filters: "فلٹرز",
  Balance: "بیلنس",
  Current: "موجودہ",
  Payment: "ادائیگی",
  Payments: "ادائیگیاں",
  Method: "طریقہ",
  Status: "اسٹیٹس",
  Type: "قسم",
  Amount: "رقم",
  Description: "تفصیل",
  Date: "تاریخ",
  From: "سے",
  To: "تک",
  Print: "پرنٹ",
  Add: "شامل کریں",
  Edit: "ترمیم",
  Delete: "حذف کریں",
  Update: "اپڈیٹ",
  Save: "محفوظ کریں",
  Cancel: "منسوخ کریں",
  Close: "بند کریں",
  Total: "کل",
  Gross: "مجموعی",
  Pending: "زیر التوا",
  Remaining: "بقیہ",
  Receivable: "قابل وصول",
  Payable: "قابل ادا",
  Cash: "نقد",
  Bank: "بینک",
  Cheque: "چیک",
  Khata: "کھاتہ",
  Loading: "لوڈ ہو رہا ہے",
  Rows: "قطاریں",
  Previous: "پچھلا",
  Next: "اگلا",
  More: "مزید",
  Quantity: "مقدار",
  Price: "قیمت",
  Rate: "ریٹ",
  Department: "شعبہ",
  Purchase: "خریداری",
  Purchases: "خریداریاں",
  "Purchase Bills": "خریداری بلز",
  Report: "رپورٹ",
  Reports: "رپورٹس",
  Daily: "روزانہ",
  Weekly: "ہفتہ وار",
  Monthly: "ماہانہ",
  Yearly: "سالانہ",
  Today: "آج",
  "This Week": "اس ہفتے",
  "This Month": "اس مہینے",
  Custom: "حسبِ منشا",
  Language: "زبان",
  English: "English",
  Urdu: "اردو",
  Login: "لاگ اِن",
  Logout: "لاگ آؤٹ",
  Sign: "سائن",
  Username: "صارف نام",
  Password: "پاس ورڈ",
  Role: "کردار",
  Admin: "ایڈمن",
  User: "صارف",
  Users: "صارفین",
  Revenue: "آمدن",
  Expense: "خرچ",
  Expenses: "اخراجات",
  Profit: "منافع",
  Loss: "نقصان",
  Material: "مٹیریل",
  Chemical: "کیمیکل",
  Rexine: "ریکسین",
  Labor: "لیبر",
  Unit: "یونٹ",
  Article: "آرٹیکل",
  Articles: "آرٹیکلز",
  Verification: "تصدیق",
};

const REGEX_TRANSLATIONS: Array<{
  pattern: RegExp;
  replace: (match: RegExpMatchArray) => string;
}> = [
  {
    pattern: /^Role:\s*(.+)$/i,
    replace: (match) => `کردار: ${translateText(match[1], "ur")}`,
  },
  {
    pattern: /^Welcome\s+(.+)$/i,
    replace: (match) => `خوش آمدید ${match[1]}`,
  },
  {
    pattern: /^Showing\s+(\d+)\s*-\s*(\d+)\s+of\s+(\d+)$/i,
    replace: (match) => `${match[3]} میں سے ${match[1]}-${match[2]} دکھائے جا رہے ہیں`,
  },
  {
    pattern: /^Balance:\s*(.+)$/i,
    replace: (match) => `بیلنس: ${match[1]}`,
  },
  {
    pattern: /^Remaining\s+(.+)$/i,
    replace: (match) => `بقیہ ${match[1]}`,
  },
  {
    pattern: /^Delete\s+(.+)\?$/i,
    replace: (match) => `${translateText(match[1], "ur")} حذف کریں؟`,
  },
  {
    pattern: /^Edit\s+(.+)$/i,
    replace: (match) => `${translateText(match[1], "ur")} میں ترمیم`,
  },
  {
    pattern: /^Add\s+(.+)$/i,
    replace: (match) => `${translateText(match[1], "ur")} شامل کریں`,
  },
  {
    pattern: /^No\s+(.+)\s+yet\.?$/i,
    replace: (match) => `ابھی کوئی ${translateText(match[1], "ur")} موجود نہیں۔`,
  },
  {
    pattern: /^No\s+(.+)\s+found\.?$/i,
    replace: (match) => `کوئی ${translateText(match[1], "ur")} نہیں ملا۔`,
  },
  {
    pattern: /^Search\s+(.+)\.\.\.$/i,
    replace: (match) => `${translateText(match[1], "ur")} تلاش کریں...`,
  },
];

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const preserveWhitespace = (original: string, translated: string) => {
  const leading = original.match(/^\s*/)?.[0] ?? "";
  const trailing = original.match(/\s*$/)?.[0] ?? "";
  return `${leading}${translated}${trailing}`;
};

export const isAppLanguage = (value: unknown): value is AppLanguage =>
  value === "en" || value === "ur";

export const getStoredLanguage = (): AppLanguage => {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  const stored = window.localStorage.getItem(APP_LANGUAGE_STORAGE_KEY);
  return isAppLanguage(stored) ? stored : DEFAULT_LANGUAGE;
};

export const setStoredLanguage = (language: AppLanguage) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, language);
};

export const getLocaleForLanguage = (
  language: AppLanguage,
  type: "date" | "currency" | "default" = "default",
) => {
  if (language === "ur") {
    if (type === "currency") return "ur-PK";
    return "ur-PK";
  }

  if (type === "currency") return "en-PK";
  if (type === "date") return "en-GB";
  return "en";
};

export const getDirectionForLanguage = (language: AppLanguage) =>
  language === "ur" ? "rtl" : "ltr";

export const translateText = (
  input: string,
  language: AppLanguage = getStoredLanguage(),
): string => {
  if (language === "en" || !input) return input;

  if (input.includes("\n")) {
    return input
      .split("\n")
      .map((line) => translateText(line, language))
      .join("\n");
  }

  const normalized = normalizeWhitespace(input);
  if (!normalized) return input;

  const exact = EXACT_TRANSLATIONS[normalized];
  if (exact) {
    return preserveWhitespace(input, exact);
  }

  for (const rule of REGEX_TRANSLATIONS) {
    const match = normalized.match(rule.pattern);
    if (match) {
      return preserveWhitespace(input, rule.replace(match));
    }
  }

  let translated = normalized;

  const orderedPhrases = Object.entries(PHRASE_TRANSLATIONS).sort(
    ([left], [right]) => right.length - left.length,
  );

  for (const [source, target] of orderedPhrases) {
    translated = translated.replace(
      new RegExp(`\\b${escapeRegExp(source)}\\b`, "gi"),
      target,
    );
  }

  return preserveWhitespace(input, translated);
};

export const translateRows = (
  rows: Array<Array<string | number>>,
  language: AppLanguage = getStoredLanguage(),
) =>
  rows.map((row) =>
    row.map((value) =>
      typeof value === "string" ? translateText(value, language) : value,
    ),
  );
