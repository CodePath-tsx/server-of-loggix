/**
 * Plugin Fastify exposant l'endpoint WebSocket /ws.
 * Authentifie la connexion via un jeton JWT passé en paramètre de requête (?token=...)
 * puis enregistre le client dans le hub WebSocket pour la diffusion d'évènements.
 */
import type { FastifyInstance } from "fastify";
import websocketPlugin from "@fastify/websocket";
import { verifyAccessToken } from "../lib/jwt.js";
import { wsHub } from "../lib/ws.js";
import { db } from "../db/index.js";
import { terminals } from "../db/schema.js";
import { eq } from "drizzle-orm";

export async function registerWebSocket(app: FastifyInstance): Promise<void> {
  await app.register(websocketPlugin);

  app.get("/ws", { websocket: true }, async (connection, request) => {
    const socket = ((connection as unknown as { socket?: unknown }).socket ?? connection) as import("ws").WebSocket;
    const query = request.query as { token?: string };
    let auth;
    try {
      auth = verifyAccessToken(query.token ?? "");
    } catch {
      socket.close(4001, "Jeton invalide");
      return;
    }

    let terminalType: "pos" | "display" | null = null;
    if (auth.terminalId) {
      const [terminal] = await db
        .select({ type: terminals.type })
        .from(terminals)
        .where(eq(terminals.id, auth.terminalId))
        .limit(1);
      terminalType = (terminal?.type as "pos" | "display" | undefined) ?? null;

      await db
        .update(terminals)
        .set({ lastSeenAt: new Date(), updatedAt: new Date() })
        .where(eq(terminals.id, auth.terminalId));
    }

    wsHub.add({
      socket,
      userId: auth.sub,
      terminalId: auth.terminalId,
      terminalType,
      storeId: auth.storeId,
    });

    socket.on("close", () => {
      wsHub.remove(socket);
    });

    socket.on("message", () => {
      // Le serveur n'attend pas de messages entrants particuliers ;
      // les sockets servent essentiellement à la diffusion serveur -> clients.
    });
  });
}
