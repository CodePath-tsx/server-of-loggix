/**
 * Export helpers — PDF (HTML-based for proper Arabic support) and Excel (SheetJS/xlsx).
 *
 * PDF strategy: Instead of jsPDF (which mangles Arabic text without a shaping engine),
 * we generate a rich HTML document and open it in a print window. The browser's own
 * text rendering engine handles Arabic ligatures, RTL layout, and Unicode perfectly.
 */
import type { Sale, Product, Expense, Customer, StockMovement } from "./mb-store";
import { openPrintWindow } from "./print";

/* ───────────────── Helpers ───────────────── */
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { year: "numeric", month: "2-digit", day: "2-digit" });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function esc(s: string | number | undefined | null) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function money(v: number, currency: string) {
  return `${currency} ${v.toLocaleString("fr-FR")}`;
}

/* ───────────────── PDF (HTML print) ───────────────── */
export async function exportPdf(payload: {
  sales: Sale[];
  products: Product[];
  expenses: Expense[];
  movements?: StockMovement[];
  currency: string;
  range: string;
  companyName: string;
}) {
  const now = new Date();
  const nowStr = now.toLocaleString("fr-FR", { year: "numeric", month: "long", day: "2-digit", hour: "2-digit", minute: "2-digit" });

  const totalRev  = payload.sales.reduce((a, s) => a + s.total, 0);
  const totalExp  = payload.expenses.reduce((a, e) => a + e.amount, 0);
  const totalCOGS = payload.sales.reduce((acc, s) =>
    acc + s.items.reduce((a, it) => {
      const prod = payload.products.find((p) => p.id === it.productId);
      return a + (prod?.cost ?? 0) * it.quantity;
    }, 0), 0);
  const grossProfit = totalRev - totalCOGS;
  const profit      = grossProfit - totalExp;

  /* Daily breakdown for sales summary */
  const dailyMap: Record<string, { count: number; total: number }> = {};
  payload.sales.forEach((s) => {
    const k = fmtDate(s.createdAt);
    if (!dailyMap[k]) dailyMap[k] = { count: 0, total: 0 };
    dailyMap[k].count++;
    dailyMap[k].total += s.total;
  });
  const dailyRows = Object.entries(dailyMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, d]) => `
      <tr>
        <td>${esc(date)}</td>
        <td class="c">${d.count}</td>
        <td class="r">${esc(money(d.total, payload.currency))}</td>
      </tr>`).join("");

  /* Sales rows */
  const salesRows = payload.sales.slice(0, 300).map((s, i) => `
    <tr class="${i % 2 === 0 ? "even" : ""}">
      <td class="mono">${esc(s.invoiceNumber)}</td>
      <td>${esc(fmtDateTime(s.createdAt))}</td>
      <td>${esc(s.customerName)}</td>
      <td class="c">${s.items.length}</td>
      <td class="r">${esc(money(s.subtotal, payload.currency))}</td>
      <td class="r red">${s.discount > 0 ? `- ${esc(money(s.discount, payload.currency))}` : "—"}</td>
      <td class="r bold">${esc(money(s.total, payload.currency))}</td>
      <td class="c">${esc(s.payment)}</td>
      <td class="c ${s.status === "completed" ? "green" : "red"}">${esc(s.status)}</td>
    </tr>`).join("");

  /* Inventory rows */
  const invRows = payload.products.map((p, i) => {
    const val    = p.cost * p.stock;
    const margin = p.price > 0 ? `${(((p.price - p.cost) / p.price) * 100).toFixed(1)}%` : "—";
    const status = p.stock <= 0 ? "Rupture" : p.stock <= p.minStock ? "Bas" : "Bon";
    const cls    = p.stock <= 0 ? "red" : p.stock <= p.minStock ? "amber" : "green";
    return `
      <tr class="${i % 2 === 0 ? "even" : ""}">
        <td class="mono">${esc(p.sku)}</td>
        <td><strong>${esc(p.name)}</strong></td>
        <td class="c">${p.stock}${p.unit ? ` ${esc(p.unit)}` : ""}</td>
        <td class="c">${p.minStock}</td>
        <td class="r">${esc(money(p.cost, payload.currency))}</td>
        <td class="r">${esc(money(p.price, payload.currency))}</td>
        <td class="r bold">${esc(money(val, payload.currency))}</td>
        <td class="c">${esc(margin)}</td>
        <td class="c ${cls}">${esc(status)}</td>
      </tr>`;
  }).join("");

  /* Expenses rows */
  const expRows = payload.expenses.map((e, i) => `
    <tr class="${i % 2 === 0 ? "even" : ""}">
      <td>${esc(fmtDate(e.createdAt))}</td>
      <td>${esc(e.description)}</td>
      <td class="r red bold">${esc(money(e.amount, payload.currency))}</td>
      <td class="c">${esc(e.type)}</td>
    </tr>`).join("");

  /* Movement rows */
  const movRows = (payload.movements ?? []).slice(0, 200).map((m, i) => {
    const prod = payload.products.find((p) => p.id === m.productId);
    const unit = prod?.saleType && prod.saleType !== "piece" ? (prod.unit ?? "") : "Pièce";
    return `
      <tr class="${i % 2 === 0 ? "even" : ""}">
        <td>${esc(fmtDateTime(m.createdAt))}</td>
        <td>${esc(m.productName)}</td>
        <td class="c ${m.type === "in" ? "green" : m.type === "out" ? "red" : "blue"}">${esc(m.type)}</td>
        <td class="c">${m.before} ${esc(unit)}</td>
        <td class="c bold">${m.quantity} ${esc(unit)}</td>
        <td class="c">${m.after} ${esc(unit)}</td>
        <td>${esc(m.reason ?? "—")}</td>
      </tr>`;
  }).join("");

  /* Range label map */
  const rangeLabel: Record<string, string> = {
    day: "Jour", week: "Semaine", month: "Mois", year: "Année",
  };

  const body = `
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', 'Arial', sans-serif; color: #1a202c; font-size: 11px; line-height: 1.5; direction: ltr; }
  @page { size: A4; margin: 12mm; }
  @media print { .no-print { display: none; } }

  .cover { text-align: center; padding: 40px 0 30px; border-bottom: 3px solid #1e3a5f; margin-bottom: 20px; }
  .cover h1 { font-size: 28px; font-weight: 900; color: #1e3a5f; margin: 0; }
  .cover p { color: #64748b; margin: 4px 0 0; font-size: 12px; }

  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
  .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; }
  .kpi .lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #64748b; }
  .kpi .val { font-size: 16px; font-weight: 900; margin-top: 4px; }
  .kpi.primary .val { color: #1e3a5f; }
  .kpi.red .val { color: #dc2626; }
  .kpi.green .val { color: #059669; }
  .kpi.blue .val { color: #2563eb; }

  .section { margin-bottom: 24px; }
  .section h2 { font-size: 14px; font-weight: 800; color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 6px; margin-bottom: 10px; }

  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  thead th { background: #1e3a5f; color: #fff; padding: 7px 8px; text-align: right; font-weight: 700; font-size: 9px; text-transform: uppercase; letter-spacing: .04em; }
  tbody td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; }
  tr.even { background: #f8fafc; }
  .c { text-align: center; }
  .r { text-align: right; }
  .bold { font-weight: 700; }
  .mono { font-family: monospace; font-size: 10px; }
  .red { color: #dc2626; }
  .green { color: #059669; }
  .amber { color: #d97706; }
  .blue { color: #2563eb; }

  .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between; }
  .page-break { page-break-before: always; }
  .summary-table td { padding: 5px 10px; border-bottom: 1px solid #f1f5f9; }
  .summary-table .bold { font-weight: 800; font-size: 13px; }
</style>

<div class="sheet">
  <!-- Cover -->
  <div class="cover">
    <h1>${esc(payload.companyName || "LogixStore ERP")}</h1>
    <p>Rapport ${esc(rangeLabel[payload.range] ?? payload.range)} — ${esc(nowStr)}</p>
  </div>

  <!-- KPIs -->
  <div class="kpi-grid">
    <div class="kpi primary">
      <div class="lbl">Chiffre d'affaires (CA)</div>
      <div class="val">${esc(money(totalRev, payload.currency))}</div>
    </div>
    <div class="kpi" style="border-color:#d97706">
      <div class="lbl">Coût des marchandises (COGS)</div>
      <div class="val" style="color:#d97706">${esc(money(totalCOGS, payload.currency))}</div>
    </div>
    <div class="kpi red">
      <div class="lbl">Frais généraux</div>
      <div class="val">${esc(money(totalExp, payload.currency))}</div>
    </div>
    <div class="kpi ${profit >= 0 ? "green" : "red"}">
      <div class="lbl">Bénéfice net</div>
      <div class="val">${esc(money(profit, payload.currency))}</div>
    </div>
  </div>
  <!-- P&L summary -->
  <div class="section" style="margin-bottom:16px">
    <table class="summary-table" style="width:320px;margin-right:auto">
      <tr><td>+ Chiffre d'affaires</td><td class="r bold" style="color:#1e3a5f">${esc(money(totalRev, payload.currency))}</td></tr>
      <tr><td>− Coût des marchandises vendues</td><td class="r" style="color:#d97706">− ${esc(money(totalCOGS, payload.currency))}</td></tr>
      <tr style="border-top:1px solid #e2e8f0"><td><strong>= Bénéfice brut</strong></td><td class="r bold" style="color:${grossProfit >= 0 ? "#059669" : "#dc2626"}">${esc(money(grossProfit, payload.currency))} (${totalRev > 0 ? ((grossProfit / totalRev) * 100).toFixed(1) : 0}%)</td></tr>
      <tr><td>− Frais généraux</td><td class="r red">− ${esc(money(totalExp, payload.currency))}</td></tr>
      <tr style="border-top:2px solid #1e3a5f"><td><strong>= Bénéfice net</strong></td><td class="r bold" style="color:${profit >= 0 ? "#059669" : "#dc2626"};font-size:13px">${esc(money(profit, payload.currency))}</td></tr>
    </table>
  </div>

  <!-- Daily Summary -->
  ${dailyRows ? `
  <div class="section">
    <h2>Résumé quotidien des ventes</h2>
    <table>
      <thead><tr><th>Date</th><th class="c">Nb Factures</th><th class="r">Total</th></tr></thead>
      <tbody>${dailyRows}</tbody>
    </table>
  </div>` : ""}

  <!-- Sales Detail -->
  <div class="section page-break">
    <h2>Détails des ventes (${payload.sales.length})</h2>
    <table>
      <thead>
        <tr>
          <th>N° Facture</th><th>Date & Heure</th><th>Client</th>
          <th class="c">Produits</th><th class="r">Sous-total</th><th class="r">Remise</th>
          <th class="r">Total</th><th class="c">Paiement</th><th class="c">Statut</th>
        </tr>
      </thead>
      <tbody>${salesRows || '<tr><td colspan="9" class="c" style="padding:20px;color:#64748b">Aucune vente sur cette période</td></tr>'}</tbody>
    </table>
    ${payload.sales.length > 300 ? `<p style="font-size:9px;color:#64748b;text-align:center;margin-top:6px">Affichage des 300 premières factures. Utilisez Excel pour tout voir.</p>` : ""}
  </div>

  <!-- Inventory -->
  <div class="section page-break">
    <h2>Inventaire du stock (${payload.products.length} produit)</h2>
    <table>
      <thead>
        <tr>
          <th>SKU</th><th>Produit</th><th class="c">Stock</th><th class="c">Minimum</th>
          <th class="r">Prix d'achat</th><th class="r">Prix de vente</th><th class="r">Valeur Stock</th>
          <th class="c">Marge</th><th class="c">Statut</th>
        </tr>
      </thead>
      <tbody>${invRows}</tbody>
    </table>
  </div>

  ${payload.expenses.length > 0 ? `
  <!-- Expenses -->
  <div class="section page-break">
    <h2>Dépenses (${payload.expenses.length})</h2>
    <table>
      <thead><tr><th>Date</th><th>Description</th><th class="r">Montant</th><th class="c">Type</th></tr></thead>
      <tbody>${expRows}</tbody>
    </table>
  </div>` : ""}

  ${(payload.movements ?? []).length > 0 ? `
  <!-- Stock Movements -->
  <div class="section page-break">
    <h2>Mouvements de stock (${(payload.movements ?? []).length})</h2>
    <table>
      <thead>
        <tr><th>Date & Heure</th><th>Produit</th><th class="c">Type</th><th class="c">Avant</th><th class="c">Quantité</th><th class="c">Après</th><th>Raison</th></tr>
      </thead>
      <tbody>${movRows}</tbody>
    </table>
  </div>` : ""}

  <div class="footer">
    <span>LogixStore ERP — ${esc(payload.companyName)}</span>
    <span>Imprimé le : ${esc(nowStr)}</span>
  </div>
</div>`;

  openPrintWindow({ title: `Rapport ${rangeLabel[payload.range] ?? payload.range} — ${payload.companyName}`, body, paperSize: "A4", dir: "ltr" });
}

/* ───────────────── Excel ───────────────── */
export async function exportExcel(payload: {
  sales: Sale[];
  products: Product[];
  expenses: Expense[];
  customers: Customer[];
  movements: StockMovement[];
  currency: string;
  range: string;
}) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  /* Sheet 1 — Sales (detailed) */
  const salesRows = payload.sales.map((s) => ({
    "N° Facture": s.invoiceNumber,
    "Date": new Date(s.createdAt).toLocaleDateString("fr-FR"),
    "Heure": new Date(s.createdAt).toLocaleTimeString("fr-FR"),
    "Client": s.customerName,
    "Nombre de Produits": s.items.length,
    "Détails des Produits": s.items.map((i) => `${i.name} ×${i.quantity}`).join(" | "),
    "Sous-total": s.subtotal,
    "Remise": s.discount,
    "TVA %": s.taxPct,
    "Total": s.total,
    "Mode de Paiement": s.payment,
    "Statut": s.status,
  }));
  const salesSheet = XLSX.utils.json_to_sheet(salesRows);
  salesSheet["!cols"] = Object.keys(salesRows[0] ?? {}).map(() => ({ wch: 20 }));
  XLSX.utils.book_append_sheet(wb, salesSheet, "Ventes");

  /* Sheet 2 — Daily Summary */
  const dailyMap: Record<string, { count: number; total: number; discount: number }> = {};
  payload.sales.forEach((s) => {
    const k = new Date(s.createdAt).toLocaleDateString("fr-FR");
    if (!dailyMap[k]) dailyMap[k] = { count: 0, total: 0, discount: 0 };
    dailyMap[k].count++;
    dailyMap[k].total += s.total;
    dailyMap[k].discount += s.discount;
  });
  const dailyRows = Object.entries(dailyMap).map(([date, d]) => ({
    "Date": date,
    "Nb Factures": d.count,
    "Total Remises": d.discount,
    "Total Ventes": d.total,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dailyRows), "Résumé quotidien");

  /* Sheet 3 — Inventory */
  const invRows = payload.products.map((p) => ({
    "SKU": p.sku,
    "Produit": p.name,
    "Type de vente": p.saleType ?? "piece",
    "Unité": p.unit ?? "Pièce",
    "Stock": p.stock,
    "Minimum": p.minStock,
    "Prix d'achat": p.cost,
    "Prix de vente": p.price,
    "Valeur Stock": +(p.cost * p.stock).toFixed(2),
    "Marge %": p.price > 0 ? +(((p.price - p.cost) / p.price) * 100).toFixed(1) : 0,
    "Statut": p.stock <= 0 ? "Rupture" : p.stock <= p.minStock ? "Bas" : "Bon",
    "Actif": p.active ? "Oui" : "Non",
  }));
  const invSheet = XLSX.utils.json_to_sheet(invRows);
  invSheet["!cols"] = Object.keys(invRows[0] ?? {}).map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, invSheet, "Stock");

  /* Sheet 4 — Expenses */
  const expRows = payload.expenses.map((e) => ({
    "Date": new Date(e.createdAt).toLocaleDateString("fr-FR"),
    "Description": e.description,
    "Montant": e.amount,
    "Type": e.type,
    "Référence": e.reference ?? "",
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expRows), "Dépenses");

  /* Sheet 5 — Customers */
  const custRows = payload.customers.map((c) => ({
    "Nom": c.name,
    "Téléphone": c.phone ?? "",
    "Email": c.email ?? "",
    "Adresse": c.address ?? "",
    "Solde dû": c.balance,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(custRows), "Clients");

  /* Sheet 6 — Stock Movements */
  const movRows = payload.movements.map((m) => {
    const prod = payload.products.find((p) => p.id === m.productId);
    const unit = prod?.saleType && prod.saleType !== "piece" ? (prod.unit ?? "") : "Pièce";
    return {
      "Date": new Date(m.createdAt).toLocaleDateString("fr-FR"),
      "Heure": new Date(m.createdAt).toLocaleTimeString("fr-FR"),
      "Produit": m.productName,
      "Type de mouvement": m.type,
      "Avant": m.before,
      "Quantité": m.quantity,
      "Après": m.after,
      "Unité": unit,
      "Raison": m.reason ?? "",
    };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(movRows), "Mouvements de stock");

  const filename = `LogixStore-${payload.range}-${new Date().toLocaleDateString("fr-FR").replace(/\//g, "-")}.xlsx`;
  XLSX.writeFile(wb, filename);
}
