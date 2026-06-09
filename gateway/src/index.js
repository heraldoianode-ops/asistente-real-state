/**
 * index.js — WhatsApp Gateway entry point.
 * Express app: webhook, outbound send, WebSocket broadcast.
 */
const express = require("express");
const http = require("http");
const crypto = require("crypto");
const cors = require("cors");
const morgan = require("morgan");
const Redis = require("ioredis");

const { initWebSocket, broadcastAll } = require("./broadcast");
const { handleInbound } = require("./webhook");
const { setRedis } = require("./rateLimit");
const { sendText, sendTemplate, sendButtons } = require("./sender");
const { sendWelcomeMenu, sendPropertyCard, sendAppointmentReminder } = require("./templates");

// ─── Startup env validation ───────────────────────────────────────────────────
const REQUIRED_VARS = ["WHATSAPP_VERIFY_TOKEN", "WHATSAPP_APP_SECRET", "WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"];
for (const v of REQUIRED_VARS) {
  if (!process.env[v]) {
    console.error(`[gateway] FATAL: missing required env var ${v}`);
    process.exit(1);
  }
}

const app = express();
const server = http.createServer(app);

const PORT = process.env.GATEWAY_PORT || 3000;
const WA_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const INTERNAL_SECRET = process.env.GATEWAY_INTERNAL_SECRET || "";

// Redis
const redis = new Redis(process.env.REDIS_URL || "redis://redis:6379/0");
setRedis(redis);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(morgan("combined"));

// Raw body for HMAC verification — with 10mb size limit
app.use((req, res, next) => {
  let data = [];
  let size = 0;
  req.on("data", (chunk) => {
    size += chunk.length;
    if (size > 10 * 1024 * 1024) {
      res.status(413).json({ error: "Payload too large" });
      req.destroy();
      return;
    }
    data.push(chunk);
  });
  req.on("end", () => {
    req.rawBody = Buffer.concat(data);
    try { req.body = JSON.parse(req.rawBody.toString()); } catch (_) { req.body = {}; }
    next();
  });
});

// ─── Internal auth middleware ─────────────────────────────────────────────────
function requireInternalAuth(req, res, next) {
  if (!INTERNAL_SECRET) return next(); // skip if not configured
  const auth = req.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  const provided = auth.slice(7);
  try {
    const valid = crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(INTERNAL_SECRET));
    if (!valid) return res.status(403).json({ error: "Forbidden" });
  } catch {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

// ─── Webhook verify ───────────────────────────────────────────────────────────
app.get("/webhook", (req, res) => {
  const token = req.query["hub.verify_token"];
  try {
    const valid = token && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(WA_VERIFY_TOKEN));
    if (valid) return res.send(req.query["hub.challenge"]);
  } catch (_) {}
  res.sendStatus(403);
});

// ─── Webhook inbound ──────────────────────────────────────────────────────────
app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // Ack immediately
  try {
    await handleInbound(req.rawBody, req.headers["x-hub-signature-256"]);
  } catch (err) {
    console.error("[webhook] Unhandled error:", err.message);
  }
});

// ─── Send text ────────────────────────────────────────────────────────────────
app.post("/send", async (req, res) => {
  try {
    const { to, message } = req.body;
    const result = await sendText(to, message);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Send welcome menu ────────────────────────────────────────────────────────
app.post("/send/welcome", async (req, res) => {
  try {
    const { to, agency_name } = req.body;
    const result = await sendWelcomeMenu(to, agency_name);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Send property card ───────────────────────────────────────────────────────
app.post("/send/property", async (req, res) => {
  try {
    const { to, property } = req.body;
    await sendPropertyCard(to, property);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Send reminder ────────────────────────────────────────────────────────────
app.post("/send/reminder", async (req, res) => {
  try {
    const { to, time_label, property_title, address } = req.body;
    const result = await sendAppointmentReminder(to, {
      timeLabel: time_label || "24 horas",
      propertyTitle: property_title || "",
      address: address || "",
    });
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Escalate (internal only) ─────────────────────────────────────────────────
app.post("/escalate", requireInternalAuth, async (req, res) => {
  const { wa_contact_id, reason } = req.body;
  if (!wa_contact_id) return res.status(400).json({ error: "wa_contact_id required" });
  await redis.setex(`escalate:${wa_contact_id}`, 86400, reason || "escalated");
  broadcastAll({ type: "escalation", waId: wa_contact_id, reason, ts: Date.now() });
  res.json({ ok: true });
});

// ─── Broadcast (internal only) ────────────────────────────────────────────────
app.post("/broadcast", requireInternalAuth, (req, res) => {
  broadcastAll(req.body);
  res.json({ ok: true });
});

// ─── Health ───────────────────────────────────────────────────────────────────
app.get("/health", (req, res) => res.json({ status: "ok" }));

// ─── Start ────────────────────────────────────────────────────────────────────
initWebSocket(server);
server.listen(PORT, () => console.log(`[gateway] Listening on :${PORT}`));
