/**
 * webhook.js — inbound WhatsApp message handler.
 */
const axios = require("axios");
const crypto = require("crypto");
const { sendText, sendButtons, markRead } = require("./sender");
const { sendWelcomeMenu } = require("./templates");
const { checkRateLimit, isEscalated } = require("./rateLimit");
const { notifyInboundMessage, notifyEscalation } = require("./broadcast");

const WA_APP_SECRET = process.env.WHATSAPP_APP_SECRET || "";
const FASTAPI_URL = process.env.FASTAPI_URL || "http://backend:8000";

function verifySignature(rawBody, signature) {
  if (!signature || !WA_APP_SECRET) return false;
  const expected = "sha256=" + crypto
    .createHmac("sha256", WA_APP_SECRET)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch (err) {
    console.warn("[webhook] timingSafeEqual error:", err.message);
    return false;
  }
}

function extractMessages(body) {
  return body?.entry?.[0]?.changes?.[0]?.value?.messages || [];
}

async function callAgent(waId, text, messageId, timestamp) {
  const resp = await axios.post(
    `${FASTAPI_URL}/agent/whatsapp`,
    { wa_contact_id: waId, message: text, message_id: messageId, timestamp },
    { timeout: 45000 }
  );
  return resp.data;
}

function decodeInteractiveReply(msg) {
  if (msg.type === "interactive") {
    const btn = msg.interactive?.button_reply;
    const row = msg.interactive?.list_reply;
    if (btn) return { id: btn.id, text: btn.title };
    if (row) return { id: row.id, text: row.title };
  }
  return null;
}

async function handleInbound(rawBody, signature) {
  let body;
  try {
    body = JSON.parse(rawBody.toString());
  } catch (err) {
    console.error("[webhook] Malformed JSON payload — ignoring:", err.message);
    return;
  }

  if (!verifySignature(rawBody, signature)) {
    console.warn("[webhook] Invalid HMAC — request ignored");
    return;
  }

  const messages = extractMessages(body);
  if (!messages.length) return;

  for (const msg of messages) {
    const waId = msg.from;
    const msgId = msg.id;

    markRead(msgId).catch(() => {});

    const allowed = await checkRateLimit(waId);
    if (!allowed) {
      await sendText(waId, "Por favor, esperá un momento antes de enviar más mensajes.");
      continue;
    }

    const escalated = await isEscalated(waId);
    if (escalated) {
      notifyInboundMessage(waId, msg.text?.body || "[media]");
      continue;
    }

    let userText = "";

    switch (msg.type) {
      case "text":
        userText = msg.text?.body || "";
        break;
      case "interactive": {
        const reply = decodeInteractiveReply(msg);
        if (!reply) continue;
        const buttonMap = {
          buscar_propiedad: "Quiero buscar una propiedad para comprar o alquilar",
          vender_propiedad: "Quiero vender o alquilar mi propiedad",
          hablar_agente: "Quiero hablar con un agente",
        };
        userText = buttonMap[reply.id] || reply.text;
        break;
      }
      case "image":
        userText = `[El cliente envió una imagen${msg.image?.caption ? `: ${msg.image.caption}` : ""}]`;
        break;
      case "document":
        userText = `[El cliente envió un documento: ${msg.document?.filename || "archivo"}]`;
        break;
      case "location":
        userText = `[El cliente compartió su ubicación: lat ${msg.location?.latitude}, lng ${msg.location?.longitude}]`;
        break;
      default:
        continue;
    }

    if (!userText) continue;

    notifyInboundMessage(waId, userText);

    try {
      const { reply, escalated: nowEscalated } = await callAgent(waId, userText, msgId, msg.timestamp);
      if (nowEscalated) {
        notifyEscalation(waId, "Escalado por el agente IA");
        continue;
      }
      if (reply) {
        await sendText(waId, reply);
      }
    } catch (err) {
      console.error(`[webhook] Agent error for ${waId}:`, err.message);
      await sendText(waId, "Disculpá, hubo un problema. Intentá de nuevo o escribí AGENTE para hablar con una persona.");
    }
  }
}

module.exports = { handleInbound, verifySignature };
