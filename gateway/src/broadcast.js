/**
 * broadcast.js — WebSocket server for real-time dashboard updates.
 * Rooms are keyed by agentId.
 */
const { WebSocketServer } = require("ws");

let wss = null;

function initWebSocket(server) {
  wss = new WebSocketServer({ server });
  wss.on("connection", (ws, req) => {
    const url = new URL(req.url, "http://localhost");
    ws.agentId = url.searchParams.get("agentId") || "all";
    ws.isAlive = true;
    ws.on("pong", () => { ws.isAlive = true; });
    ws.on("close", () => {});
  });

  // Heartbeat
  setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);
}

function broadcastAll(event) {
  if (!wss) return;
  const msg = JSON.stringify(event);
  wss.clients.forEach((ws) => {
    if (ws.readyState === 1) ws.send(msg);
  });
}

function broadcastToAgent(agentId, event) {
  if (!wss) return;
  const msg = JSON.stringify(event);
  wss.clients.forEach((ws) => {
    if (ws.readyState === 1 && (ws.agentId === agentId || ws.agentId === "all")) {
      ws.send(msg);
    }
  });
}

function notifyInboundMessage(waId, text) {
  broadcastAll({ type: "inbound_message", waId, text, ts: Date.now() });
}

function notifyEscalation(waId, reason) {
  broadcastAll({ type: "escalation", waId, reason, ts: Date.now() });
}

module.exports = { initWebSocket, broadcastAll, broadcastToAgent, notifyInboundMessage, notifyEscalation };
