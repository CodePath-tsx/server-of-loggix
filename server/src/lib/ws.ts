/**
 * Registre central des connexions WebSocket (terminaux caisse et afficheurs de prix).
 * Permet de diffuser des évènements temps réel à tous les postes connectés.
 */
import type { WebSocket } from "ws";

export type WsEventType =
  | "product.updated"
  | "stock.updated"
  | "sale.created"
  | "sale.returned"
  | "payment.created"
  | "user.updated"
  | "settings.updated"
  | "terminal.connected"
  | "terminal.disconnected";

interface ConnectedClient {
  socket: WebSocket;
  userId: string;
  terminalId: string | null;
  terminalType: "pos" | "display" | null;
  storeId: string;
}

class WebSocketHub {
  private clients = new Map<WebSocket, ConnectedClient>();

  add(client: ConnectedClient): void {
    this.clients.set(client.socket, client);
    if (client.terminalId) {
      this.broadcast("terminal.connected", {
        terminalId: client.terminalId,
        type: client.terminalType,
      });
    }
  }

  remove(socket: WebSocket): void {
    const client = this.clients.get(socket);
    this.clients.delete(socket);
    if (client?.terminalId) {
      this.broadcast("terminal.disconnected", {
        terminalId: client.terminalId,
        type: client.terminalType,
      });
    }
  }

  /** Diffuse un évènement à tous les clients connectés d'un magasin donné (ou tous si non précisé). */
  broadcast(event: WsEventType, payload: unknown, storeId?: string): void {
    const message = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
    for (const client of this.clients.values()) {
      if (storeId && client.storeId !== storeId) continue;
      if (client.socket.readyState === client.socket.OPEN) {
        client.socket.send(message);
      }
    }
  }

  /** Liste des terminaux actuellement en ligne. */
  onlineTerminals(): Array<{ terminalId: string; type: string | null }> {
    const result: Array<{ terminalId: string; type: string | null }> = [];
    for (const client of this.clients.values()) {
      if (client.terminalId) {
        result.push({ terminalId: client.terminalId, type: client.terminalType });
      }
    }
    return result;
  }
}

export const wsHub = new WebSocketHub();
