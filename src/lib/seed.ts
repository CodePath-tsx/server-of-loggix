/**
 * Optional demo dataset. Runs only when the setup wizard finishes and the
 * user chose to include demo data. Never creates users or licenses — those
 * are owned by the setup + activation flows.
 */
import { useMBStore } from "./mb-store";

const IMG_TSHIRT =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><rect width='200' height='200' fill='%230f3f6e'/><text x='100' y='115' font-family='Inter,Arial' font-size='28' font-weight='700' text-anchor='middle' fill='%23ffffff'>TSHIRT</text></svg>`,
  );

export function seedDemoData() {
  const s = useMBStore.getState();
  if (s.seeded) return;
  const now = new Date().toISOString();

  s.upsertCategory({ id: "cat_vetement", name: "Vetement", description: "vetement", color: "#e11d48", active: true, createdAt: now });
  s.upsertCategory({ id: "cat_tshirt", name: "Tshirt", description: "tshirt", color: "#059669", parentId: "cat_vetement", active: true, createdAt: now });
  s.upsertProduct({
    id: "p_tshirt_polo", name: "Tshirt Polo", sku: "PROD-020243", barcode: "566635698248",
    categoryId: "cat_tshirt", cost: 2000, price: 3000, stock: 10, minStock: 5,
    image: IMG_TSHIRT, active: true, createdAt: now,
  });
  s.upsertCustomer({ id: "c_walkin", name: "Walk-in Customer", balance: 0, createdAt: now });
  s.markSeeded();
}

/**
 * Stable machine fingerprint.
 * Electron : hardware-based ID from main process (getMachineIdSync via IPC).
 * Browser  : random ID stored in localStorage (generated once, persisted forever).
 */
export function getMachineId(): string {
  // In Electron: use hardware fingerprint (CPU, hostname, platform)
  if (typeof window !== "undefined" && (window as any).electronAPI?.getMachineIdSync) {
    return (window as any).electronAPI.getMachineIdSync() as string;
  }
  // In browser: use persisted random ID
  const key = "mb_machine_id";
  let id = localStorage.getItem(key);
  if (!id) {
    const buf = new Uint8Array(8);
    crypto.getRandomValues(buf);
    id = Array.from(buf)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
    localStorage.setItem(key, id);
  }
  return id;
}
