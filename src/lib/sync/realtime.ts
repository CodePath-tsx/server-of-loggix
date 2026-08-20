/** Connexion WebSocket au serveur central (événements temps réel). */
import { loadSyncConfig } from "./config";
import { tokens } from "./api-client";

export type RealtimeEvent =
  | "product.updated"
  | "stock.updated"
  | "sale.created"
  | "sale.returned"
  | "payment.created"
  | "user.updated"
  | "settings.updated"
  | "terminal.connected"
  | "terminal.disconnected";

type Handler = (event: RealtimeEvent, payload: unknown) => void;

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const handlers = new Set<Handler>();

export function onRealtime(fn: Handler) {
  handlers.add(fn);
  return () => handlers.delete(fn);
}

export function connectRealtime() {
  const cfg = loadSyncConfig();
  if (!cfg.enabled || typeof WebSocket === "undefined") return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

  const wsUrl = `${cfg.serverUrl.replace(/^http/, "ws")}/ws?token=${encodeURIComponent(tokens.access() ?? "")}&terminal=${encodeURIComponent(cfg.terminalCode)}`;
  socket = new WebSocket(wsUrl);

  socket.onmessage = (msg) => {
    try {
      const data = JSON.parse(String(msg.data)) as { event: RealtimeEvent; payload: unknown };
      handlers.forEach((h) => h(data.event, data.payload));
      window.dispatchEvent(new CustomEvent(`logix:${data.event}`, { detail: data.payload }));
    } catch {
      /* message ignoré */
    }
  };

  socket.onclose = () => {
    socket = null;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connectRealtime, 5000);
  };
  socket.onerror = () => socket?.close();
}

export function disconnectRealtime() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  socket?.close();
  socket = null;
}
