/**
 * Typed in-process event bus. Used by services to publish domain events
 * (sale.completed, stock.low, license.expired, ...) without coupling to
 * subscribers (audit, notifications, dashboard invalidation, printing).
 */
export interface DomainEvents {
  "sale.completed": { saleId: string; total: number; cashierId: string };
  "sale.refunded": { saleId: string; amount: number };
  "stock.low": { productId: string; stock: number; min: number };
  "stock.changed": { productId: string; before: number; after: number };
  "auth.login": { userId: string };
  "auth.logout": { userId: string };
  "license.activated": { type: string };
  "license.expired": { at: string };
  "audit.recorded": { action: string; entity: string };
  "notification.created": { id: string };
}

type Handler<K extends keyof DomainEvents> = (payload: DomainEvents[K]) => void | Promise<void>;

const handlers = new Map<keyof DomainEvents, Set<(p: unknown) => void | Promise<void>>>();

export const eventBus = {
  on<K extends keyof DomainEvents>(event: K, handler: Handler<K>): () => void {
    let set = handlers.get(event);
    if (!set) { set = new Set(); handlers.set(event, set); }
    const wrapped = handler as (p: unknown) => void | Promise<void>;
    set.add(wrapped);
    return () => set!.delete(wrapped);
  },
  async emit<K extends keyof DomainEvents>(event: K, payload: DomainEvents[K]): Promise<void> {
    const set = handlers.get(event);
    if (!set) return;
    for (const h of set) {
      try { await h(payload); } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[event-bus] handler for ${String(event)} failed`, err);
      }
    }
  },
};
