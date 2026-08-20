import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowUp, ArrowDown, Settings2, ArrowLeftRight } from "lucide-react";
import { useMBStore, type StockMovement, type Product } from "@/lib/mb-store";
import { PageBody, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/_app/stock-movement")({ component: MovementPage });

function getUnit(m: StockMovement, products: Product[]): string {
  const prod = products.find((p) => p.id === m.productId);
  if (prod?.saleType && prod.saleType !== "piece") return prod.unit ?? "unité";
  return "pièce";
}

function MovementRow({ m, products }: { m: StockMovement; products: Product[] }) {
  const unit  = getUnit(m, products);
  const delta = Math.round((m.after - m.before) * 1000) / 1000;
  const badge = (t: string) => {
    const map: Record<string, string> = {
      in:       "bg-success/15 text-success",
      out:      "bg-warning/20 text-warning",
      adj:      "bg-info/15 text-info",
      transfer: "bg-primary/10 text-primary",
    };
    const Icon = ({ in: ArrowDown, out: ArrowUp, adj: Settings2, transfer: ArrowLeftRight } as Record<string, React.ComponentType<{ className?: string }>>)[t] ?? Settings2;
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold uppercase ${map[t] ?? "bg-muted"}`}>
        <Icon className="h-3 w-3" />{t}
      </span>
    );
  };

  return (
    <tr className="hover:bg-muted/20">
      <td className="p-4">
        <p className="font-semibold">
          {new Date(m.createdAt).toLocaleDateString("fr-FR", { year: "numeric", month: "2-digit", day: "2-digit" })}
        </p>
        <p className="text-xs text-muted-foreground">
          {new Date(m.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </td>
      <td className="p-4">{badge(m.type)}</td>
      <td className="p-4">
        <p className="font-bold">{m.productName}</p>
        {m.reason && <p className="text-xs text-muted-foreground">{m.reason}</p>}
      </td>
      <td className="p-4">
        <p className={`text-lg font-extrabold ${
          m.type === "in" || m.after > m.before ? "text-success" : m.type === "out" ? "text-warning" : "text-info"
        }`}>
          {delta >= 0 ? "+" : ""}{delta}{" "}
          <span className="text-xs font-normal">{unit}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Avant: {m.before} {unit} › Après: {m.after} {unit}
        </p>
      </td>
    </tr>
  );
}

function MovementPage() {
  const movements = useMBStore((s) => s.movements);
  const products  = useMBStore((s) => s.products);
  const [q, setQ] = useState("");
  const filtered = movements.filter((m) => m.productName.toLowerCase().includes(q.toLowerCase()));

  return (
    <PageBody>
      <PageHeader title="Mouvements de stock" description="Suivre chaque entrée, sortie et ajustement de stock" />
      <div className="rounded-2xl border bg-card p-4 shadow-card">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher des mouvements..."
          className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <div className="border-b p-4 text-sm" dir="ltr">
          Affichage de <span className="font-bold">{filtered.length}</span> mouvement(s)
        </div>
        <table className="w-full text-sm" dir="ltr">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-4 text-right">Date et Heure</th>
              <th className="p-4 text-right">Type</th>
              <th className="p-4 text-right">Produit</th>
              <th className="p-4 text-right">Détails de la quantité</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((m) => (
              <MovementRow key={m.id} m={m} products={products} />
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={4} className="p-12 text-center text-muted-foreground">Aucun mouvement</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </PageBody>
  );
}
