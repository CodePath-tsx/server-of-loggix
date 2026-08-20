/**
 * Écran « Price Display » (DISPLAY-01 → DISPLAY-06).
 * Affichage client plein écran : article scanné, panier, total.
 * Fonctionne hors ligne (canal local) et en réseau (événements temps réel).
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Store } from "lucide-react";
import { useMBStore, formatMoney } from "@/lib/mb-store";
import { loadSyncConfig } from "@/lib/sync/config";
import {
  readDisplayCart,
  subscribeDisplayCart,
  type DisplayCart,
} from "@/lib/sync/display-channel";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/display")({
  head: () => ({
    meta: [
      { title: "Afficheur de prix — LogixStore" },
      { name: "description", content: "Écran client : article en cours, panier et total à payer." },
      { property: "og:title", content: "Afficheur de prix — LogixStore" },
      { property: "og:description", content: "Écran client : article en cours, panier et total à payer." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PriceDisplayPage,
});

function PriceDisplayPage() {
  const settings = useMBStore((s) => s.settings);
  const products = useMBStore((s) => s.products);
  const [cart, setCart] = useState<DisplayCart | null>(null);
  const [clock, setClock] = useState(() => new Date());
  const [lookup, setLookup] = useState("");
  const terminalCode = useMemo(() => loadSyncConfig().terminalCode, []);

  useEffect(() => {
    setCart(readDisplayCart());
    return subscribeDisplayCart(setCart);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const currency = cart?.currency ?? settings.currency;
  const active = Boolean(cart && cart.status === "active" && cart.lines.length);

  const found = useMemo(() => {
    const q = lookup.trim().toLowerCase();
    if (!q) return null;
    return (
      products.find((p) => p.barcode?.toLowerCase() === q || p.sku.toLowerCase() === q) ??
      products.find((p) => p.name.toLowerCase().includes(q)) ??
      null
    );
  }, [lookup, products]);

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Store className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">{settings.name}</h1>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Afficheur de prix · {terminalCode.startsWith("DISPLAY") ? terminalCode : "DISPLAY-01"}
            </p>
          </div>
        </div>
        <p className="font-mono text-xl text-muted-foreground">{clock.toLocaleTimeString("fr-FR")}</p>
      </header>

      <div className="grid flex-1 gap-6 p-8 lg:grid-cols-[1.4fr_1fr]">
        {/* Article en cours / total */}
        <section className="flex flex-col justify-between rounded-3xl border bg-card p-8 shadow-card">
          {active ? (
            <>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Dernier article</p>
                <p className="mt-2 text-4xl font-extrabold">{cart!.lastItem?.name}</p>
                <p className="mt-2 text-xl text-muted-foreground">
                  {cart!.lastItem?.quantity} {cart!.lastItem?.unit ?? "u"} ×{" "}
                  {formatMoney(cart!.lastItem?.price ?? 0, currency)}
                </p>
              </div>
              <div className="mt-8 rounded-2xl bg-primary p-8 text-primary-foreground">
                <p className="text-xs uppercase tracking-widest opacity-80">Total à payer</p>
                <p className="mt-2 text-6xl font-extrabold tabular-nums">{formatMoney(cart!.total, currency)}</p>
                <div className="mt-4 flex gap-6 text-sm opacity-90">
                  <span>Sous-total {formatMoney(cart!.subtotal, currency)}</span>
                  {cart!.discount > 0 && <span>Remise −{formatMoney(cart!.discount, currency)}</span>}
                  {cart!.tax > 0 && <span>TVA {formatMoney(cart!.tax, currency)}</span>}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <p className="text-5xl font-extrabold tracking-tight">Bienvenue</p>
              <p className="mt-3 text-lg text-muted-foreground">
                En attente d'un article… vous pouvez consulter un prix ci-contre.
              </p>
            </div>
          )}
        </section>

        {/* Panier + consultation de prix */}
        <section className="flex flex-col gap-6">
          <div className="flex-1 overflow-hidden rounded-3xl border bg-card p-6 shadow-card">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Votre panier</p>
            <div className="mt-4 max-h-[42vh] space-y-2 overflow-y-auto">
              {!active && <p className="text-sm text-muted-foreground">Panier vide.</p>}
              {cart?.lines.map((l, i) => (
                <div key={`${l.name}-${i}`} className="flex items-center justify-between rounded-xl border px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{l.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.quantity} {l.unit ?? "u"} × {formatMoney(l.price, currency)}
                    </p>
                  </div>
                  <p className="font-bold tabular-nums">{formatMoney(l.subtotal, currency)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border bg-card p-6 shadow-card">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Consulter un prix</p>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                className="pl-9 text-lg"
                placeholder="Scannez un code-barres ou saisissez un nom"
                value={lookup}
                onChange={(e) => setLookup(e.target.value)}
              />
            </div>
            {lookup.trim() && (
              <div className="mt-4 rounded-2xl border p-4">
                {found ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-bold">{found.name}</p>
                      <p className="text-xs text-muted-foreground">{found.sku}</p>
                    </div>
                    <p className="text-3xl font-extrabold text-primary tabular-nums">
                      {formatMoney(found.price, currency)}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Article introuvable.</p>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
