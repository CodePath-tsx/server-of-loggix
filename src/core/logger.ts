/**
 * Minimal structured logger. In Electron main it will also write to
 * userData/logs/app-YYYY-MM-DD.log via a file sink; in the browser preview it
 * only writes to console + an in-memory ring buffer available for the
 * Notification Center / debug panel.
 */
export type LogLevel = "info" | "warn" | "error" | "critical";

export interface LogEntry {
  at: string;
  level: LogLevel;
  scope: string;
  message: string;
  data?: unknown;
}

type Sink = (e: LogEntry) => void;

const buffer: LogEntry[] = [];
const sinks: Sink[] = [
  (e) => {
    const line = `[${e.at}] ${e.level.toUpperCase()} ${e.scope} — ${e.message}`;
    // eslint-disable-next-line no-console
    const fn = e.level === "error" || e.level === "critical" ? console.error
      : e.level === "warn" ? console.warn : console.log;
    fn(line, e.data ?? "");
  },
  (e) => {
    buffer.push(e);
    if (buffer.length > 2000) buffer.shift();
  },
];

export const logger = {
  addSink(sink: Sink) { sinks.push(sink); },
  entries(): readonly LogEntry[] { return buffer; },
  log(level: LogLevel, scope: string, message: string, data?: unknown) {
    const entry: LogEntry = { at: new Date().toISOString(), level, scope, message, data };
    for (const s of sinks) { try { s(entry); } catch { /* ignore sink errors */ } }
  },
  info(scope: string, msg: string, data?: unknown) { this.log("info", scope, msg, data); },
  warn(scope: string, msg: string, data?: unknown) { this.log("warn", scope, msg, data); },
  error(scope: string, msg: string, data?: unknown) { this.log("error", scope, msg, data); },
  critical(scope: string, msg: string, data?: unknown) { this.log("critical", scope, msg, data); },
};
