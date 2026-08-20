/**
 * Canal de communication caisse ⇄ afficheur de prix (DISPLAY-01…DISPLAY-06).
 * Utilise BroadcastChannel entre fenêtres du même poste, avec repli
 * localStorage (événement `storage`) pour les navigateurs / fenêtres Electron.
 */
export interface DisplayLine {
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
  unit?: string;
}

export interface DisplayCart {
  lines: DisplayLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
  customerName?: string;
  /** Dernier article scanné, mis en avant sur l'afficheur. */
  lastItem?: DisplayLine | null;
  status: "idle" | "active" | "paid";
  updatedAt: string;
}

const CHANNEL = "logix-price-display";
const LS_KEY = "logix-display-cart";

let channel: BroadcastChannel | null = null;
function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  channel ??= new BroadcastChannel(CHANNEL);
  return channel;
}

export function publishDisplayCart(cart: Omit<DisplayCart, "updatedAt">): void {
  if (typeof window === "undefined") return;
  const payload: DisplayCart = { ...cart, updatedAt: new Date().toISOString() };
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
  } catch {
    /* quota ignoré */
  }
  getChannel()?.postMessage(payload);
}

export function readDisplayCart(): DisplayCart | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as DisplayCart) : null;
  } catch {
    return null;
  }
}

export function subscribeDisplayCart(fn: (cart: DisplayCart) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const ch = getChannel();
  const onMessage = (e: MessageEvent) => fn(e.data as DisplayCart);
  ch?.addEventListener("message", onMessage);

  const onStorage = (e: StorageEvent) => {
    if (e.key === LS_KEY && e.newValue) {
      try {
        fn(JSON.parse(e.newValue) as DisplayCart);
      } catch {
        /* ignoré */
      }
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    ch?.removeEventListener("message", onMessage);
    window.removeEventListener("storage", onStorage);
  };
}
