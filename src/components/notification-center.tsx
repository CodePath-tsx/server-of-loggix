import { useState, useEffect, useRef } from "react";
import { Bell, X, Info, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { loadNotices, saveNotices, type Notice } from "@/lib/push-notice";

// Re-export so existing imports from this file keep working
export type { NoticeLevel, Notice } from "@/lib/push-notice";
export { pushNotice } from "@/lib/push-notice";

const icons = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
};
const tones = {
  success: "text-emerald-600 bg-emerald-500/10",
  info:    "text-sky-600 bg-sky-500/10",
  warning: "text-amber-600 bg-amber-500/10",
  error:   "text-red-600 bg-red-500/10",
};

export function NotificationCenter() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Notice[]>(() => loadNotices());
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const refresh = () => setList(loadNotices());
    window.addEventListener("mb:notices", refresh);
    const timer = setInterval(refresh, 5000);
    return () => { window.removeEventListener("mb:notices", refresh); clearInterval(timer); };
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current && !btnRef.current.closest("[data-notif-root]")?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const unread = list.filter((n) => !n.read).length;

  const markAllRead = () => {
    const next = list.map((n) => ({ ...n, read: true }));
    saveNotices(next);
    setList(next);
  };
  const clear = () => { saveNotices([]); setList([]); };

  return (
    <div className="relative" data-notif-root="">
      <button
        ref={btnRef}
        onClick={() => { setOpen((o) => !o); if (!open) markAllRead(); }}
        className="relative grid h-10 w-10 place-items-center rounded-xl border bg-card text-foreground hover:bg-accent"
        aria-label={t("notifications.title")}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className={cn(
            "absolute top-12 z-50 w-80 rounded-2xl border bg-card shadow-2xl flex flex-col overflow-hidden",
            // position: end-0 for RTL (right side), start-0 for LTR
            "end-0",
          )}
          style={{ maxHeight: "min(420px, 80vh)" }}
        >
          <header className="flex items-center justify-between px-4 py-3 border-b bg-card sticky top-0">
            <h2 className="text-sm font-bold">{t("notifications.title")}</h2>
            <div className="flex items-center gap-2">
              {list.length > 0 && (
                <button onClick={clear} className="text-xs text-muted-foreground hover:text-destructive transition-colors">
                  {t("notifications.clear")}
                </button>
              )}
              <button onClick={() => setOpen(false)} className="grid h-6 w-6 place-items-center rounded-lg hover:bg-accent">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {list.length === 0 && (
              <div className="grid place-items-center py-12 text-sm text-muted-foreground">
                {t("notifications.empty")}
              </div>
            )}
            {list.map((n) => {
              const Icon = icons[n.level];
              return (
                <div key={n.id} className={cn("rounded-xl border p-2.5 flex gap-2.5", n.read ? "bg-background" : "bg-muted/40")}>
                  <div className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", tones[n.level])}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold leading-tight">{n.title}</p>
                    {n.body && <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{n.body}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1 opacity-70">
                      {new Date(n.at).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
