import type { ApiBill, ApiParty } from "../types/api";
import {
  getDirectionForLanguage,
  getStoredLanguage,
  translateText,
} from "./i18n";
import { formatCurrency, formatDate } from "./utils";

const PAIRS_PER_DOZEN = 12;

const roundMoney = (value: number) => Number(value.toFixed(2));

const formatQuantityValue = (value: number) => String(Number(value.toFixed(2)));

const calculateGrossLineTotal = (quantity: number, price: number) =>
  roundMoney(quantity * PAIRS_PER_DOZEN * price);

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

type PrintBillInvoiceOptions = {
  companyName?: string;
  companySlogan?: string;
  companyContacts?: string[];
  companyAddress?: string;
  fallbackArticleNames?: Map<string, string>;
};

export function printBillInvoice(
  bill: ApiBill,
  options: PrintBillInvoiceOptions = {},
): boolean {
  const printWindow = window.open("", "", "width=800,height=600");
  if (!printWindow) return false;

  const companyName = options.companyName ?? "FineSoft";
  const companySlogan = options.companySlogan ?? "Walk Fine, Feel Soft";
  const companyContacts = options.companyContacts ?? [
    "0311459255",
    "03076077781",
    "03004770172",
  ];
  const companyAddress =
    options.companyAddress ?? "Shahdara, Lahore, Pakistan";
  const fallbackArticleNames = options.fallbackArticleNames;
  const language = getStoredLanguage();
  const direction = getDirectionForLanguage(language);
  const languageCode = language === "ur" ? "ur" : "en";
  const baseTextAlign = direction === "rtl" ? "right" : "left";
  const edgeAlign = direction === "rtl" ? "left" : "right";
  const fontFamily =
    language === "ur"
      ? '"Noto Nastaliq Urdu", "Noto Naskh Arabic", "Segoe UI", Arial, sans-serif'
      : '"Segoe UI", Arial, sans-serif';
  const customerName = bill.party?.name || translateText("Walk-in Customer");
  const customerPhone =
    (
      bill.party as (ApiParty & { phone?: string | null }) | null | undefined
    )?.phone?.trim() || "________________";
  const printTotalQuantityDozen = Number(
    bill.lines
      .reduce((sum, line) => sum + Number(line.quantity ?? 0), 0)
      .toFixed(2),
  );
  const printTotalPairs = printTotalQuantityDozen * PAIRS_PER_DOZEN;
  const printGrandTotal = roundMoney(
    bill.lines.reduce(
      (sum, line) =>
        sum +
        calculateGrossLineTotal(
          Number(line.quantity ?? 0),
          Number(line.price ?? 0),
        ),
      0,
    ),
  );

  const rows = bill.lines
    .map((line) => {
      const articleName =
        line.article?.name ||
        fallbackArticleNames?.get(line.articleId) ||
        translateText("Unknown");
      const quantity = Number(line.quantity ?? 0);
      const grossLineTotal = calculateGrossLineTotal(
        quantity,
        Number(line.price ?? 0),
      );
      const pairs = quantity * PAIRS_PER_DOZEN;
      const sizeLabel = line.size
        ? `${translateText("Size")} ${line.size}`
        : translateText("Standard Size");
      return `
              <tr>
                <td>
                  <span class="product-name">${escapeHtml(articleName)}</span>
                </td>
                <td>
                  <span class="product-sub">${escapeHtml(sizeLabel)}</span>
                </td>
                <td>
                  <span class="quantity-value">${formatQuantityValue(quantity)} ${translateText("Dozen")}</span>
                  <span class="muted-cell">(${formatQuantityValue(pairs)} ${translateText("Pairs")})</span>
                </td>
                <td class="numeric-column">${formatCurrency(Number(line.price ?? 0))}</td>
                <td class="numeric-column">${formatCurrency(grossLineTotal)}</td>
              </tr>
            `;
    })
    .join("");

  const html = `
    <!DOCTYPE html>
    <html lang="${languageCode}" dir="${direction}">
      <head>
        <title>${translateText("Bill")} ${bill.billNumber}</title>
        <style>
          @page {
            size: A4;
            margin: 12mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            font-family: ${fontFamily};
            background: #eef2f7;
            color: #101828;
            direction: ${direction};
            text-align: ${baseTextAlign};
          }
          .invoice {
            width: 100%;
            min-height: calc(297mm - 24mm);
            background: #ffffff;
            border: 1px solid #d8dee8;
            box-shadow: 0 12px 32px rgba(15, 39, 71, 0.08);
            position: relative;
            overflow: hidden;
          }
          .invoice::before {
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 8px;
            background: linear-gradient(90deg, #102a43 0%, #1f4f82 100%);
          }
          .content {
            padding: 20mm 16mm 14mm;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 18px;
            padding-bottom: 18px;
            border-bottom: 2px solid #102a43;
          }
          .brand-block {
            max-width: 65%;
          }
          .brand-label {
            display: inline-block;
            padding: 6px 10px;
            border-radius: 999px;
            background: #e8eff7;
            color: #1f4f82;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: ${direction === "rtl" ? "0" : "0.12em"};
            text-transform: ${direction === "rtl" ? "none" : "uppercase"};
          }
          .company-name {
            margin: 12px 0 6px;
            font-size: 34px;
            line-height: 1;
            font-weight: 800;
            letter-spacing: 0.02em;
            color: #102a43;
          }
          .company-slogan {
            margin: 0;
            color: #52606d;
            font-size: 15px;
            font-style: italic;
          }
          .invoice-badge {
            min-width: 220px;
            padding: 18px 16px;
            border-radius: 16px;
            background: linear-gradient(160deg, #102a43 0%, #243b53 100%);
            color: #ffffff;
          }
          .invoice-badge h2 {
            margin: 0 0 12px;
            font-size: 24px;
            letter-spacing: ${direction === "rtl" ? "0" : "0.08em"};
            text-transform: ${direction === "rtl" ? "none" : "uppercase"};
          }
          .badge-row {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            margin-top: 8px;
            font-size: 13px;
          }
          .badge-row span:first-child {
            color: rgba(255, 255, 255, 0.72);
          }
          .section-grid {
            display: grid;
            grid-template-columns: 1.35fr 0.85fr;
            gap: 16px;
            margin: 18px 0 16px;
          }
          .panel {
            border: 1px solid #d8dee8;
            border-radius: 14px;
            background: #f8fafc;
            padding: 14px 16px;
          }
          .panel-title {
            margin: 0 0 12px;
            color: #102a43;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: ${direction === "rtl" ? "0" : "0.12em"};
            text-transform: ${direction === "rtl" ? "none" : "uppercase"};
          }
          .meta-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px 18px;
          }
          .meta-item span {
            display: block;
          }
          .meta-label {
            margin-bottom: 4px;
            color: #7b8794;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: ${direction === "rtl" ? "0" : "0.08em"};
            text-transform: ${direction === "rtl" ? "none" : "uppercase"};
          }
          .meta-value {
            font-size: 15px;
            font-weight: 600;
            color: #101828;
          }
          .amount-card {
            display: flex;
            flex-direction: column;
            justify-content: center;
            min-height: 100%;
            background: linear-gradient(180deg, #f8fafc 0%, #eef4fb 100%);
          }
          .amount-card .panel-title {
            margin-bottom: 18px;
          }
          .amount-label {
            margin: 0;
            color: #52606d;
            font-size: 13px;
          }
          .amount-value {
            margin: 8px 0 0;
            font-size: 34px;
            font-weight: 800;
            color: #102a43;
            line-height: 1.1;
          }
          .items-title {
            margin: 0 0 10px;
            color: #102a43;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0.12em;
            text-transform: uppercase;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          .items-table {
            table-layout: fixed;
            border: 1px solid #cfd8e3;
            border-radius: 14px;
            overflow: hidden;
          }
          .items-table thead th {
            background: #102a43;
            color: #ffffff;
            font-size: 12px;
            text-transform: ${direction === "rtl" ? "none" : "uppercase"};
            letter-spacing: ${direction === "rtl" ? "0" : "0.06em"};
            padding: 12px 10px;
            text-align: ${baseTextAlign};
          }
          .items-table tbody td {
            padding: 12px 10px;
            border-bottom: 1px solid #e5eaf0;
            font-size: 13px;
            vertical-align: top;
            text-align: ${baseTextAlign};
          }
          .items-table tbody tr:nth-child(even) td {
            background: #f8fafc;
          }
          .items-table tbody tr:last-child td {
            border-bottom: none;
          }
          .quantity-value {
            display: block;
            font-weight: 700;
            color: #101828;
          }
          .numeric-column {
            text-align: right;
            white-space: nowrap;
            font-weight: 700;
            font-variant-numeric: tabular-nums;
            font-feature-settings: "tnum" 1;
            padding-right: 14px;
          }
          .product-name {
            display: block;
            font-weight: 700;
            color: #101828;
          }
          .product-sub {
            display: block;
            margin-top: 4px;
            color: #7b8794;
            font-size: 12px;
          }
          .muted-cell {
            color: #7b8794;
            font-size: 12px;
          }
          .totals-wrap {
            display: flex;
            justify-content: flex-end;
            margin-top: 14px;
          }
          .summary {
            width: 100%;
            max-width: 320px;
            border: 1px solid #d8dee8;
            border-radius: 14px;
            overflow: hidden;
          }
          .summary td {
            padding: 12px 14px;
            font-size: 14px;
            font-weight: 700;
            border-bottom: 1px solid #e5eaf0;
          }
          .summary tr:last-child td {
            border-bottom: none;
            background: #102a43;
            color: #ffffff;
            font-size: 18px;
          }
          .summary td:last-child {
            text-align: right;
            font-variant-numeric: tabular-nums;
            font-feature-settings: "tnum" 1;
          }
          .footer {
            margin-top: 22px;
            padding-top: 14px;
            border-top: 1px dashed #bcccdc;
            display: flex;
            justify-content: space-between;
            gap: 16px;
            align-items: flex-start;
          }
          .footer-block {
            flex: 1;
          }
          .footer-title {
            margin: 0 0 8px;
            color: #102a43;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: ${direction === "rtl" ? "0" : "0.12em"};
            text-transform: ${direction === "rtl" ? "none" : "uppercase"};
          }
          .footer-text {
            margin: 0;
            color: #52606d;
            font-size: 13px;
            line-height: 1.6;
          }
          .footer-text strong {
            color: #101828;
          }
          @media print {
            body {
              background: #ffffff;
            }
            .invoice {
              border: none;
              box-shadow: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="invoice">
          <div class="content">
            <div class="header">
              <div class="brand-block">
                <span class="brand-label">${translateText("Sales Invoice")}</span>
                <h1 class="company-name">${escapeHtml(companyName)}</h1>
                <p class="company-slogan">${escapeHtml(translateText(companySlogan))}</p>
              </div>
              <div class="invoice-badge">
                <h2>${translateText("Invoice")}</h2>
                <div class="badge-row">
                  <span>${translateText("Invoice No")}</span>
                  <strong>${escapeHtml(bill.billNumber)}</strong>
                </div>
                <div class="badge-row">
                  <span>${translateText("Date")}</span>
                  <strong>${escapeHtml(formatDate(bill.date))}</strong>
                </div>
              </div>
            </div>

            <div class="section-grid">
              <div class="panel">
                <h3 class="panel-title">${translateText("Customer Details")}</h3>
                <div class="meta-grid">
                  <div class="meta-item">
                    <span class="meta-label">${translateText("Customer Name")}</span>
                    <span class="meta-value">${escapeHtml(customerName)}</span>
                  </div>
                  <div class="meta-item">
                    <span class="meta-label">${translateText("Customer Phone")}</span>
                    <span class="meta-value">${escapeHtml(customerPhone)}</span>
                  </div>
                  <div class="meta-item">
                    <span class="meta-label">${translateText("Invoice Number")}</span>
                    <span class="meta-value">${escapeHtml(bill.billNumber)}</span>
                  </div>
                  <div class="meta-item">
                    <span class="meta-label">${translateText("Billing Date")}</span>
                    <span class="meta-value">${escapeHtml(formatDate(bill.date))}</span>
                  </div>
                </div>
              </div>

              <div class="panel amount-card">
                <h3 class="panel-title">${translateText("Bill Summary")}</h3>
                <p class="amount-label">${translateText("Total Quantity")}</p>
                <p class="meta-value">${escapeHtml(formatQuantityValue(printTotalQuantityDozen))} ${translateText("Dozen")} (${escapeHtml(formatQuantityValue(printTotalPairs))} ${translateText("Pairs")})</p>
                <p class="amount-label" style="margin-top: 14px;">${translateText("Total Amount")}</p>
                <p class="amount-value">${formatCurrency(printGrandTotal)}</p>
              </div>
            </div>

            <h3 class="items-title">${translateText("Product Details")}</h3>
            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 27%;">${translateText("Product Name")}</th>
                  <th style="width: 20%;">${translateText("Description")}</th>
                  <th style="width: 23%;">${translateText("Quantity")}</th>
                  <th style="width: 15%; text-align: right; padding-right: 14px;">${translateText("Price")}</th>
                  <th style="width: 15%; text-align: right; padding-right: 14px;">${translateText("Total Amount")}</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>

            <div class="totals-wrap">
              <table class="summary">
                <tbody>
                  <tr>
                    <td>${translateText("Total Quantity")}</td>
                    <td>${escapeHtml(formatQuantityValue(printTotalQuantityDozen))} ${translateText("Dozen")}</td>
                  </tr>
                  <tr>
                    <td>${translateText("Grand Total")}</td>
                    <td>${formatCurrency(printGrandTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="footer">
              <div class="footer-block">
                <h4 class="footer-title">${translateText("Contact Numbers")}</h4>
                <p class="footer-text">${companyContacts
                  .map((contact) => `<strong>${escapeHtml(contact)}</strong>`)
                  .join(" | ")}</p>
              </div>
              <div class="footer-block" style="text-align: ${edgeAlign};">
                <h4 class="footer-title">${translateText("Address")}</h4>
                <p class="footer-text">${escapeHtml(companyAddress)}</p>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.print();
  return true;
}
