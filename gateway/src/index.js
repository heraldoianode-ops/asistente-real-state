/**
 * index.js — WhatsApp Gateway entry point.
 * Express app: webhook, outbound send, WebSocket broadcast.
 */
const express = require("express");
const http = require("http");
const cors = require("cors");
const morgan = require("morgan");
const Redis = require("ioredis");

const { initWebSocket, broadcastAll } = require("./broadcast");
const { handleInbound } = require("./webhook");
const { setRedis } = require("./rateLimit");
const { sendText, sendTemplate, sendButtons } = require("./sender");
const { sendWelcomeMenu, sendPropertyCard, sendAppointmentReminder } = require("./templates");

const app = express();
const server = http.createServer(app);

const PORT = process.env.GATEWAY_PORT || 3000;
const WA_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "changeme_verify";

// Redis
const redis = new Redis(process.env.REDIS_URL || "redis://redis:6379/0");
setRedis(redis);

// Middleware
app.use(cors());
app.use(morgan("combined"));

// Raw body for HMAC verification
app.use((req, res, next) => {
  let data = [];
  req.on("data", (chunk) => data.push(chunk));
  req.on("end", () => {
    req.rawBody = Buffer.concat(data);
    try { req.body = JSON.parse(req.rawBody.toString()); } catch (_) { req.body = {}; }
    next();
  });
});

// Webhook verify
app.get("/webhook", (req, res) => {
  if (req.query["hub.verify_token"] === WA_VERIFY_TOKEN) {
    return res.send(req.query["hub.challenge"]);
  }
  res.sendStatus(403);
});

// Webhook inbound
app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // Ack immediately
  try {
    await handleInbound(req.rawBody, req.headers["x-hub-signature-256"]);
  } catch (err) {
    console.error("[webhook] Unhandled error:", err.message);
  }
});

// Send text
app.post("/send", async (req, res) => {
  try {
    const { to, message } = req.body;
    const result = await sendText(to, message);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send welcome menu
app.post("/send/welcome", async (req, res) => {
  try {
    const { to, agency_name } = req.body;
    const result = await sendWelcomeMenu(to, agency_name);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send property card
app.post("/send/property", async (req, res) => {
  try {
    const { to, property } = req.body;
    await sendPropertyCard(to, property);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send reminder
app.post("/send/reminder", async (req, res) => {
  try {
    const { to, event_type, scheduled_at } = req.body;
    const result = await sendAppointmentReminder(to, { timeLabel: "24 horas", propertyTitle: "", address: scheduled_at });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Escalate — mark contact in Redis
app.post("/escalate", async (req, res) => {
  const { wa_contact_id, reason } = req.body;
  await redis.setex(`escalate:${wa_contact_id}`, 86400, reason || "escalated");
  broadcastAll({ type: "escalation", waId: wa_contact_id, reason, ts: Date.now() });
  res.json({ ok: true });
});

// Broadcast (internal)
app.post("/broadcast", (req, res) => {
  broadcastAll(req.body);
  res.json({ ok: true });
});

// Health
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Start
initWebSocket(server);
server.listen(PORT, () => console.log(`[gateway] Listening on :${PORT}`));
