/**
 * Standalone notification store — no React dependencies.
 * Can be imported from mb-store, route guards, and other non-React modules.
 */
import { eventBus } from "@/core/event-bus";

export type NoticeLevel = "success" | "info" | "warning" | "error";

export interface Notice {
  id: string;
  level: NoticeLevel;
  title: string;
  body?: string;
  at: string;
  read: boolean;
}

const STORE_KEY = "managbyte-notices-v1";

export function loadNotices(): Notice[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveNotices(n: Notice[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORE_KEY, JSON.stringify(n.slice(0, 200)));
}

export function pushNotice(level: NoticeLevel, title: string, body?: string) {
  if (typeof window === "undefined") return; // SSR guard
  const notice: Notice = {
    id: crypto.randomUUID(),
    level,
    title,
    body,
    at: new Date().toISOString(),
    read: false,
  };
  saveNotices([notice, ...loadNotices()]);
  window.dispatchEvent(new CustomEvent("mb:notices"));
  void eventBus.emit("notification.created", { id: notice.id });
}
