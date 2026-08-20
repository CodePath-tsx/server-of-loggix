/**
 * Professional printing utility.
 *
 * Opens a fresh window with a self-contained print-optimised HTML document
 * so we NEVER print the app UI. Supports thermal receipts (58mm, 80mm) and
 * A4 documents (invoices, product/customer/supplier/stock/sales tables).
 *
 * Usage:
 *   openPrintWindow({ title, body, paperSize })
 */
import { toast } from "sonner";

export type PaperSize = "58mm" | "80mm" | "A4";

const pageCss = (size: PaperSize): string => {
  if (size === "58mm") {
    return `@page { size: 58mm auto; margin: 0; }
      html, body { width: 58mm; margin: 0; padding: 0; }
      .sheet { padding: 4mm 3mm; font-family: 'Courier New', monospace; font-size: 11px; line-height: 1.35; color: #000; }
      .sheet h1 { font-size: 14px; margin: 0 0 2px; text-align: center; }
      .sheet .muted { color: #333; }
      .sheet hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
      .sheet table { width: 100%; border-collapse: collapse; }
      .sheet th, .sheet td { padding: 2px 0; }
      .sheet .r { text-align: right; }
      .sheet .l { text-align: left; }
      .sheet .c { text-align: center; }
      .sheet .totals td { padding: 3px 0; font-weight: 700; }`;
  }
  if (size === "80mm") {
    return `@page { size: 80mm auto; margin: 0; }
      html, body { width: 80mm; margin: 0; padding: 0; }
      .sheet { padding: 5mm 4mm; font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.4; color: #000; }
      .sheet h1 { font-size: 16px; margin: 0 0 4px; text-align: center; }
      .sheet .muted { color: #333; }
      .sheet hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
      .sheet table { width: 100%; border-collapse: collapse; }
      .sheet th, .sheet td { padding: 2px 0; }
      .sheet .r { text-align: right; }
      .sheet .l { text-align: left; }
      .sheet .c { text-align: center; }
      .sheet .totals td { padding: 3px 0; font-weight: 700; }`;
  }
  return `@page { size: A4; margin: 14mm; }
    html, body { margin: 0; padding: 0; background: #fff; }
    .sheet { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; color: #0f172a; font-size: 12px; line-height: 1.5; }
    .sheet h1 { font-size: 22px; margin: 0; letter-spacing: -0.02em; }
    .sheet h2 { font-size: 14px; margin: 0; color: #475569; font-weight: 500; }
    .sheet .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #0f172a; padding-bottom: 12px; }
    .sheet .head .brand { display: flex; gap: 12px; align-items: center; }
    .sheet .head img.logo { max-height: 56px; max-width: 140px; object-fit: contain; }
    .sheet .meta { text-align: right; font-size: 11px; color: #334155; }
    .sheet .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 14px; }
    .sheet .box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; }
    .sheet .box .label { font-size: 10px; text-transform: uppercase; letter-spacing: .1em; color: #64748b; }
    .sheet table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    .sheet thead th { background: #f1f5f9; text-align: right; padding: 8px 10px; font-size: 11px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: .05em; }
    .sheet tbody td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
    .sheet .r { text-align: left; }
    .sheet .totals { margin-top: 12px; margin-inline-start: auto; width: 320px; }
    .sheet .totals td { padding: 4px 8px; }
    .sheet .totals .grand td { border-top: 2px solid #0f172a; padding-top: 8px; font-size: 15px; font-weight: 800; }
    .sheet .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #64748b; text-align: center; }
    .sheet .qr { margin-top: 12px; text-align: center; }
    .sheet .qr img { width: 96px; height: 96px; }`;
};

export interface PrintOptions {
  title: string;
  body: string;
  paperSize?: PaperSize;
  /** Sens de lecture ; toujours "ltr". */
  dir?: "ltr";
}

export function openPrintWindow({ title, body, paperSize = "A4", dir = "ltr" }: PrintOptions): void {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) {
    toast.error("Échec de l'ouverture de la fenêtre d'impression. Veuillez autoriser les pop-ups.");
    return;
  }
  const html = `<!doctype html>
<html lang="fr" dir="${dir}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #fff; }
  ${pageCss(paperSize)}
  @media screen {
    body { background: #f1f5f9; padding: 24px; }
    .sheet { background: #fff; margin: 0 auto; box-shadow: 0 4px 24px rgba(0,0,0,.08); ${paperSize === "A4" ? "max-width: 794px; padding: 40px 48px;" : paperSize === "80mm" ? "width: 80mm; padding: 6mm 5mm;" : "width: 58mm; padding: 5mm 4mm;"} }
    .toolbar { max-width: 794px; margin: 0 auto 16px; display: flex; gap: 8px; justify-content: flex-end; }
    .toolbar button { background: #0f172a; color: #fff; border: 0; border-radius: 8px; padding: 8px 16px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
    .toolbar button.ghost { background: #e2e8f0; color: #0f172a; }
  }
  @media print { .toolbar { display: none !important; } }
</style>
</head>
<body>
<div class="toolbar">
  <button onclick="window.print()">🖨️ Imprimer</button>
  <button class="ghost" onclick="window.close()">Fermer</button>
</div>
<div class="sheet">${body}</div>
<script>
  window.addEventListener('load', function () {
    setTimeout(function () { window.focus(); window.print(); }, 250);
  });
</script>
</body></html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

/* ---------------- Helpers ---------------- */

export function escapeHtml(s: string | number | undefined | null): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function makeQrDataUrl(text: string): Promise<string> {
  const QR = await import("qrcode");
  return QR.toDataURL(text, { width: 192, margin: 1, errorCorrectionLevel: "M" });
}

/**
 * Generate a barcode PNG data URL using JsBarcode (client-side canvas).
 * Format defaults to CODE128 which accepts any ASCII text.
 */
export async function makeBarcodeDataUrl(
  value: string,
  opts: { format?: "CODE128" | "EAN13" | "EAN8" | "CODE39" | "UPC"; width?: number; height?: number; displayValue?: boolean } = {},
): Promise<string> {
  const JsBarcode = (await import("jsbarcode")).default;
  const canvas = document.createElement("canvas");
  try {
    JsBarcode(canvas, value, {
      format: opts.format ?? "CODE128",
      width: opts.width ?? 2,
      height: opts.height ?? 60,
      displayValue: opts.displayValue ?? true,
      margin: 4,
      fontSize: 14,
      background: "#ffffff",
      lineColor: "#000000",
    });
    return canvas.toDataURL("image/png");
  } catch {
    return "";
  }
}

/** Generate a valid EAN-13 barcode: 12 numeric digits + check digit. */
export function generateEAN13(prefix = "200"): string {
  const base = (prefix + Date.now().toString().slice(-9) + Math.floor(Math.random() * 10)).slice(0, 12);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = parseInt(base[i], 10);
    sum += i % 2 === 0 ? d : d * 3;
  }
  const check = (10 - (sum % 10)) % 10;
  return base + check;
}


/* ---------------- Templates ---------------- */

import type { Sale, Product, Customer, Supplier, StockMovement, CompanySettings, BonDeCommande } from "./mb-store";
import { formatMoney } from "./mb-store";

function headerHtml(company: CompanySettings, subtitle: string): string {
  const logo = company.logo ? `<img class="logo" src="${escapeHtml(company.logo)}" alt="logo" />` : "";
  return `<div class="head">
    <div class="brand">${logo}
      <div>
        <h1>${escapeHtml(company.name)}</h1>
        <h2>${escapeHtml(subtitle)}</h2>
        ${company.address ? `<div class="muted">${escapeHtml(company.address)}</div>` : ""}
        ${company.phone ? `<div class="muted">${escapeHtml(company.phone)}</div>` : ""}
        ${company.taxId ? `<div class="muted">Tax ID: ${escapeHtml(company.taxId)}</div>` : ""}
      </div>
    </div>
    <div class="meta">
      <div>${new Date().toLocaleString("fr-FR")}</div>
    </div>
  </div>`;
}

export async function printSaleReceipt(
  sale: Sale,
  company: CompanySettings,
  cashierName: string,
  paidAmount?: number,
): Promise<void> {
  const paper = company.printerSize;
  const money = (v: number) => formatMoney(v, company.currency);
  const qrPayload = `${sale.invoiceNumber}|${sale.total}|${sale.createdAt}`;
  const qrDataUrl = await makeQrDataUrl(qrPayload).catch(() => "");

  if (paper === "A4") {
    const taxAmt = Math.round(((sale.subtotal - sale.discount) * sale.taxPct) / 100);
    const rows = sale.items.map((it, i) => `
      <tr style="background:${i % 2 === 0 ? "#fff" : "#f8fafc"}">
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0">${escapeHtml(it.name)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:center">${it.quantity}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right">${money(it.price)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600">${money(it.subtotal)}</td>
      </tr>`).join("");
    const body = `
      <div style="font-family:'Segoe UI',Arial,sans-serif;color:#1a202c;max-width:794px;margin:0 auto" dir="ltr">
        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px">
          <div>
            ${company.logo ? `<img src="${escapeHtml(company.logo)}" alt="logo" style="max-height:60px;max-width:160px;object-fit:contain;margin-bottom:8px;display:block" />` : ""}
            <div style="font-size:18px;font-weight:800;color:#1a202c">${escapeHtml(company.name)}</div>
            ${company.address ? `<div style="font-size:12px;color:#64748b;margin-top:2px">${escapeHtml(company.address)}</div>` : ""}
            ${company.phone ? `<div style="font-size:12px;color:#64748b">${escapeHtml(company.phone)}</div>` : ""}
            ${company.taxId ? `<div style="font-size:12px;color:#64748b">RC / NIF: ${escapeHtml(company.taxId)}</div>` : ""}
          </div>
          <div style="text-align:right">
            <div style="font-size:36px;font-weight:900;color:#1a202c;letter-spacing:-1px">FACTURE</div>
            <div style="font-size:16px;font-weight:700;color:#64748b">#${escapeHtml(sale.invoiceNumber)}</div>
            <div style="margin-top:12px;font-size:11px;color:#64748b">
              <div><strong>Date d'émission :</strong> ${new Date(sale.createdAt).toLocaleDateString("fr-FR")}</div>
              <div><strong>Caissier :</strong> ${escapeHtml(cashierName)}</div>
              <div><strong>Paiement :</strong> ${escapeHtml(sale.payment.toUpperCase())}</div>
            </div>
          </div>
        </div>

        <!-- Client info -->
        <div style="background:#f8fafc;border-radius:8px;padding:14px 16px;margin-bottom:24px;border:1px solid #e2e8f0">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8;margin-bottom:6px">Facturé à</div>
          <div style="font-size:14px;font-weight:700">${escapeHtml(sale.customerName)}</div>
        </div>

        <!-- Items table -->
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#1a202c;color:#fff">
              <th style="padding:10px 12px;text-align:left;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.05em">Description</th>
              <th style="padding:10px 12px;text-align:center;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.05em">Qté</th>
              <th style="padding:10px 12px;text-align:right;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.05em">Prix U.</th>
              <th style="padding:10px 12px;text-align:right;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.05em">Total</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <!-- Totals -->
        <div style="display:flex;justify-content:flex-end;margin-top:20px">
          <table style="width:280px;font-size:13px;border-collapse:collapse">
            <tr>
              <td style="padding:6px 0;color:#64748b">Sous-total</td>
              <td style="padding:6px 0;text-align:right;font-weight:600">${money(sale.subtotal)}</td>
            </tr>
            ${sale.discount > 0 ? `<tr><td style="padding:6px 0;color:#64748b">Remise</td><td style="padding:6px 0;text-align:right;color:#e53e3e">- ${money(sale.discount)}</td></tr>` : ""}
            <tr>
              <td style="padding:6px 0;color:#64748b">TVA (${sale.taxPct}%)</td>
              <td style="padding:6px 0;text-align:right;font-weight:600">${money(taxAmt)}</td>
            </tr>
            <tr style="border-top:2px solid #1a202c">
              <td style="padding:10px 0 6px;font-size:16px;font-weight:800">TOTAL</td>
              <td style="padding:10px 0 6px;text-align:right;font-size:16px;font-weight:800">${money(sale.total)}</td>
            </tr>
          </table>
        </div>

        ${qrDataUrl ? `<div style="margin-top:20px;text-align:center"><img src="${qrDataUrl}" alt="QR" style="width:80px;height:80px" /></div>` : ""}

        <!-- Footer -->
        <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8">
          <span>Merci pour votre confiance</span>
          <span>LogixStore ERP</span>
        </div>
      </div>`;
    openPrintWindow({ title: `Facture ${sale.invoiceNumber}`, body, paperSize: "A4", dir: "ltr" });
    return;
  }

  // Thermal 58 / 80
  const rows = sale.items.map((it) => `
    <tr>
      <td colspan="3" class="l">${escapeHtml(it.name)}</td>
    </tr>
    <tr>
      <td class="l">${it.quantity} x ${money(it.price)}</td>
      <td></td>
      <td class="r">${money(it.subtotal)}</td>
    </tr>`).join("");
  const body = `
    ${company.logo ? `<div class="c"><img src="${escapeHtml(company.logo)}" style="max-height:40px;max-width:100%" /></div>` : ""}
    <h1>${escapeHtml(company.name)}</h1>
    ${company.address ? `<div class="c muted">${escapeHtml(company.address)}</div>` : ""}
    ${company.phone ? `<div class="c muted">${escapeHtml(company.phone)}</div>` : ""}
    <hr />
    <div>Invoice: <strong>${escapeHtml(sale.invoiceNumber)}</strong></div>
    <div>${new Date(sale.createdAt).toLocaleString("fr-FR")}</div>
    <div>Cashier: ${escapeHtml(cashierName)}</div>
    <div>Customer: ${escapeHtml(sale.customerName)}</div>
    <hr />
    <table>${rows}</table>
    <hr />
    <table class="totals">
      <tr><td class="l">Sous-total</td><td class="r">${money(sale.subtotal)}</td></tr>
      ${sale.discount > 0 ? `<tr><td class="l">Remise</td><td class="r">- ${money(sale.discount)}</td></tr>` : ""}
      ${sale.taxPct > 0 ? `<tr><td class="l">TVA (${sale.taxPct}%)</td><td class="r">${money(Math.round(((sale.subtotal - sale.discount) * sale.taxPct) / 100))}</td></tr>` : ""}
      <tr><td class="l" style="font-weight:900;font-size:1.15em">Total</td><td class="r" style="font-weight:900;font-size:1.15em">${money(sale.total)}</td></tr>
      ${paidAmount && paidAmount > 0 ? `
      <tr><td class="l">Payé (${escapeHtml(sale.payment)})</td><td class="r">${money(paidAmount)}</td></tr>
      <tr><td class="l" style="font-weight:900">Rendu</td><td class="r" style="font-weight:900">${money(Math.max(0, paidAmount - sale.total))}</td></tr>
      ` : `<tr><td class="l">${escapeHtml(sale.payment.toUpperCase())}</td><td class="r"></td></tr>`}
    </table>
    <hr />
    ${qrDataUrl ? `<div class="c"><img src="${qrDataUrl}" style="width:100px;height:100px" /></div>` : ""}
    <div class="c muted">Merci de votre visite</div>
    <div class="c muted">LogixStore ERP</div>`;
  openPrintWindow({ title: `Receipt ${sale.invoiceNumber}`, body, paperSize: paper });
}

function tableReport(
  company: CompanySettings,
  title: string,
  columns: { label: string; align?: "l" | "c" | "r" }[],
  rows: string[][],
): void {
  const th = columns.map((c) => `<th class="${c.align === "r" ? "r" : c.align === "c" ? "c" : ""}">${escapeHtml(c.label)}</th>`).join("");
  const tb = rows.map((r) => `<tr>${r.map((cell, i) => `<td class="${columns[i]?.align === "r" ? "r" : columns[i]?.align === "c" ? "c" : ""}">${cell}</td>`).join("")}</tr>`).join("");
  const body = `
    ${headerHtml(company, title)}
    <div style="margin-top:8px" class="muted">Total rows: ${rows.length}</div>
    <table><thead><tr>${th}</tr></thead><tbody>${tb || `<tr><td colspan="${columns.length}" class="c muted">Aucune donnée</td></tr>`}</tbody></table>
    <div class="footer">Generated by LogixStore ERP — ${new Date().toLocaleString("fr-FR")}</div>`;
  openPrintWindow({ title, body, paperSize: "A4" });
}

export function printProducts(products: Product[], company: CompanySettings) {
  tableReport(company, "Liste des Produits", [
    { label: "Nom" },
    { label: "SKU" },
    { label: "Barcode" },
    { label: "Stock", align: "c" },
    { label: "Prix", align: "r" },
  ], products.map((p) => [
    escapeHtml(p.name), escapeHtml(p.sku), escapeHtml(p.barcode ?? "—"),
    String(p.stock), formatMoney(p.price, company.currency),
  ]));
}

export function printCustomers(customers: Customer[], company: CompanySettings) {
  tableReport(company, "Liste des Clients", [
    { label: "Nom" }, { label: "Téléphone" }, { label: "Email" }, { label: "Solde", align: "r" },
  ], customers.map((c) => [
    escapeHtml(c.name), escapeHtml(c.phone ?? "—"), escapeHtml(c.email ?? "—"),
    formatMoney(c.balance, company.currency),
  ]));
}

export function printSuppliers(suppliers: Supplier[], company: CompanySettings) {
  tableReport(company, "Liste des Fournisseurs", [
    { label: "Nom" }, { label: "Téléphone" }, { label: "Email" }, { label: "Solde", align: "r" },
  ], suppliers.map((s) => [
    escapeHtml(s.name), escapeHtml(s.phone ?? "—"), escapeHtml(s.email ?? "—"),
    formatMoney(s.balance, company.currency),
  ]));
}

export function printStock(products: Product[], company: CompanySettings) {
  tableReport(company, "Rapport de Stock", [
    { label: "Produit" }, { label: "SKU" }, { label: "Stock", align: "c" },
    { label: "Minimum", align: "c" }, { label: "Prix d'achat", align: "r" }, { label: "Prix de vente", align: "r" },
  ], products.map((p) => [
    escapeHtml(p.name), escapeHtml(p.sku), String(p.stock), String(p.minStock),
    formatMoney(p.stock * p.cost, company.currency),
    formatMoney(p.stock * p.price, company.currency),
  ]));
}

export function printStockMovements(movements: StockMovement[], company: CompanySettings) {
  tableReport(company, "Mouvements de Stock", [
    { label: "Date" }, { label: "Produit" }, { label: "Type", align: "c" },
    { label: "Quantité", align: "c" }, { label: "Avant", align: "c" }, { label: "Après", align: "c" }, { label: "Raison" },
  ], movements.map((m) => [
    new Date(m.createdAt).toLocaleString("fr-FR"), escapeHtml(m.productName), m.type.toUpperCase(),
    String(m.quantity), String(m.before), String(m.after), escapeHtml(m.reason ?? "—"),
  ]));
}

export function printSalesReport(sales: Sale[], company: CompanySettings) {
  tableReport(company, "Rapport de Ventes", [
    { label: "Date" }, { label: "Facture" }, { label: "Client" },
    { label: "Statut", align: "c" }, { label: "Paiement", align: "c" }, { label: "Total", align: "r" },
  ], sales.map((s) => [
    new Date(s.createdAt).toLocaleString("fr-FR"), escapeHtml(s.invoiceNumber),
    escapeHtml(s.customerName), s.status, s.payment, formatMoney(s.total, company.currency),
  ]));
}

/* ---------------- Bon de Commande ---------------- */

export function printBonDeCommande(bdc: BonDeCommande, company: CompanySettings): void {
  const money = (v: number) => formatMoney(v, company.currency);
  const rows = bdc.items.map((it, i) => `
    <tr style="background:${i % 2 === 0 ? "#fff" : "#f8fafc"}">
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center">${it.quantity}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center">${escapeHtml(it.unit)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0">${escapeHtml(it.description)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right">${money(it.unitPrice)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600">${money(it.total)}</td>
    </tr>`).join("");

  const body = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;color:#1a202c;max-width:794px;margin:0 auto" dir="ltr">

      <!-- Header: title -->
      <div style="text-align:center;border-bottom:3px solid #1a202c;padding-bottom:10px;margin-bottom:20px">
        <div style="font-size:28px;font-weight:900;letter-spacing:2px;color:#1a202c">BON DE COMMANDE</div>
      </div>

      <!-- Company + Delivery in two columns -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;font-size:12px">
        <div>
          ${company.logo ? `<img src="${escapeHtml(company.logo)}" alt="logo" style="max-height:50px;max-width:140px;object-fit:contain;margin-bottom:8px;display:block" />` : ""}
          <div style="font-size:15px;font-weight:800;text-transform:uppercase;margin-bottom:4px">${escapeHtml(company.name)}</div>
          ${company.address ? `<div style="color:#64748b">${escapeHtml(company.address)}</div>` : ""}
          ${company.phone ? `<div style="color:#64748b">${escapeHtml(company.phone)}</div>` : ""}
          ${company.taxId ? `<div style="color:#64748b">RC/NIF: ${escapeHtml(company.taxId)}</div>` : ""}
        </div>
        <div style="border:1px solid #cbd5e1;border-radius:6px;padding:12px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8;margin-bottom:6px">Adresse de livraison</div>
          ${bdc.deliveryAddress ? `<div style="font-weight:600">${escapeHtml(bdc.deliveryAddress)}</div>` : ""}
          ${bdc.deliveryCity ? `<div style="color:#64748b">${escapeHtml(bdc.deliveryCity)}</div>` : ""}
        </div>
      </div>

      <!-- BDC meta info bar -->
      <div style="background:#f1f5f9;border-radius:6px;padding:10px 16px;margin-bottom:20px;display:flex;gap:40px;font-size:12px">
        <div><span style="color:#94a3b8;font-weight:600">N° BC :</span> <strong>${escapeHtml(bdc.number)}</strong></div>
        <div><span style="color:#94a3b8;font-weight:600">Date :</span> <strong>${new Date().toLocaleDateString("fr-FR")}</strong></div>
        <div><span style="color:#94a3b8;font-weight:600">Fournisseur :</span> <strong>${escapeHtml(bdc.supplierName)}</strong></div>
        ${bdc.supplierPhone ? `<div><span style="color:#94a3b8;font-weight:600">Tél :</span> <strong>${escapeHtml(bdc.supplierPhone)}</strong></div>` : ""}
      </div>

      <!-- Items table -->
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:#1a202c;color:#fff">
            <th style="padding:9px 10px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:.05em;font-weight:700">QTÉ</th>
            <th style="padding:9px 10px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:.05em;font-weight:700">UNITÉ</th>
            <th style="padding:9px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;font-weight:700">DESCRIPTION</th>
            <th style="padding:9px 10px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:.05em;font-weight:700">PRIX U.</th>
            <th style="padding:9px 10px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:.05em;font-weight:700">TOTAL</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <!-- Totals -->
      <div style="display:flex;justify-content:flex-end;margin-top:16px">
        <table style="width:260px;font-size:12px;border-collapse:collapse">
          <tr><td style="padding:5px 0;color:#64748b">SOUS-TOTAL</td><td style="padding:5px 0;text-align:right;font-weight:600">${money(bdc.subtotal)}</td></tr>
          ${bdc.shipping > 0 ? `<tr><td style="padding:5px 0;color:#64748b">TRANSPORT</td><td style="padding:5px 0;text-align:right;font-weight:600">${money(bdc.shipping)}</td></tr>` : ""}
          <tr><td style="padding:5px 0;color:#64748b">TVA (${bdc.taxPct}%)</td><td style="padding:5px 0;text-align:right;font-weight:600">${money(bdc.tax)}</td></tr>
          <tr style="border-top:2px solid #1a202c">
            <td style="padding:10px 0 6px;font-size:15px;font-weight:800">TOTAL</td>
            <td style="padding:10px 0 6px;text-align:right;font-size:15px;font-weight:800">${money(bdc.total)}</td>
          </tr>
        </table>
      </div>

      <!-- Conditions + signature -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:32px;font-size:11px">
        <div>
          <div style="font-weight:700;margin-bottom:4px;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b">Conditions et modalités</div>
          <div style="border:1px solid #e2e8f0;border-radius:4px;padding:10px;min-height:60px;color:#475569">${escapeHtml(bdc.conditions ?? "")}</div>
        </div>
        <div>
          <div style="font-weight:700;margin-bottom:4px;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b">Autorisé par</div>
          <div style="border:1px solid #e2e8f0;border-radius:4px;padding:10px;min-height:60px">
            <div>${escapeHtml(bdc.authorizedBy ?? "")}</div>
            <div style="margin-top:24px;border-top:1px solid #cbd5e1;padding-top:6px;color:#94a3b8">Signature</div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div style="margin-top:24px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8">
        <span>Document généré le ${new Date().toLocaleDateString("fr-FR")}</span>
        <span>LogixStore ERP</span>
      </div>
    </div>`;

  openPrintWindow({ title: `Bon de Commande ${bdc.number}`, body, paperSize: "A4", dir: "ltr" });
}

/* ---------------- Product Barcode Labels ---------------- */

export async function printProductLabel(
  product: Product,
  company: CompanySettings,
  count = 1,
): Promise<void> {
  const code = product.barcode && product.barcode.trim() ? product.barcode : product.sku;
  const isEan13 = /^\d{13}$/.test(code);
  const dataUrl = await makeBarcodeDataUrl(code, {
    format: isEan13 ? "EAN13" : "CODE128",
    height: 50,
    width: 2,
    displayValue: true,
  });

  const priceLine = `${formatMoney(product.price, company.currency)}`;
  const labelBody = `
    <div style="text-align:center;font-family:'Inter',Arial,sans-serif;color:#000">
      <div style="font-weight:700;font-size:11px;line-height:1.2;margin-bottom:2px">${escapeHtml(company.name)}</div>
      <div style="font-size:12px;font-weight:600;line-height:1.2;margin-bottom:3px">${escapeHtml(product.name)}</div>
      ${dataUrl ? `<img src="${dataUrl}" style="max-width:100%;height:auto" alt="barcode" />` : `<div style="font-family:monospace">${escapeHtml(code)}</div>`}
      <div style="font-size:13px;font-weight:800;margin-top:2px">${escapeHtml(priceLine)}</div>
    </div>`;

  const labels = Array.from({ length: Math.max(1, Math.min(count, 200)) }, () => labelBody).join(
    `<div style="page-break-inside:avoid;break-inside:avoid;padding:6px;border:1px dashed #ccc;margin-bottom:4px"></div>`,
  );

  // A4 grid of labels: 3 cols
  const grid = Array.from({ length: Math.max(1, Math.min(count, 200)) })
    .map(() => `<div style="border:1px dashed #94a3b8;border-radius:4px;padding:6px;break-inside:avoid">${labelBody}</div>`)
    .join("");

  const body = `
    <style>
      .labels { display:grid; grid-template-columns: repeat(3, 1fr); gap:6px; }
      @media print { .labels { gap:4px; } }
    </style>
    <div class="labels">${grid}</div>`;
  void labels;
  openPrintWindow({
    title: `Labels ${product.sku}`,
    body,
    paperSize: "A4",
  });
}
