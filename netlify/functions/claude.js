// rehab-protocol — secure proxy
// Vulnerabilità risolte:
// [1] CORS ristretto a rehabprotocol.it
// [2] Auth token Bearer obbligatorio (tranne admin)
// [3] Rate limiting per IP (60 req/ora)
// [4] Input sanitization contro prompt injection
// [5] Chiave API mai esposta al client

const ALLOWED_ORIGIN = "https://rehabprotocol.it";
const MAX_REQUESTS_PER_HOUR = 60;

// Input sanitization — blocca tentativi di prompt injection
function sanitizeInput(text) {
  if (typeof text !== "string") return "";
  return text
    .replace(/<\/?[^>]+(>|$)/g, "") // strip HTML
    .replace(/\[INST\]|\[\/INST\]|<s>|<\/s>/gi, "") // strip LLM injection tokens
    .replace(/ignore previous instructions?/gi, "")
    .replace(/you are now|act as|roleplay as/gi, "")
    .slice(0, 2000); // max lunghezza input
}

function sanitizeBody(body) {
  if (!body?.messages) return body;
  body.messages = body.messages.map((msg) => {
    if (typeof msg.content === "string") {
      msg.content = sanitizeInput(msg.content);
    } else if (Array.isArray(msg.content)) {
      msg.content = msg.content.map((block) => {
        if (block.type === "text") block.text = sanitizeInput(block.text);
        return block;
      });
    }
    return msg;
  });
  return body;
}

// Rate limiting in-memory (per ora sufficiente, Cloudflare KV opzionale)
const rateLimitStore = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const windowStart = now - 3600000; // 1 ora
  const key = ip;
  const timestamps = (rateLimitStore.get(key) || []).filter(
    (t) => t > windowStart
  );
  if (timestamps.length >= MAX_REQUESTS_PER_HOUR) return false;
  timestamps.push(now);
  rateLimitStore.set(key, timestamps);
  // Cleanup vecchie entry ogni 100 richieste
  if (rateLimitStore.size > 100) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.every((t) => t < windowStart)) rateLimitStore.delete(k);
    }
  }
  return true;
}

export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  const corsOrigin =
    origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : ALLOWED_ORIGIN;

  res.setHeader("Access-Control-Allow-Origin", corsOrigin);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  // [AUTH] Verifica Bearer token
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  const adminToken = process.env.ADMIN_TOKEN;
  const validTokens = (process.env.USER_TOKENS || "").split(",").filter(Boolean);
  const isAdmin = token && token === adminToken;
  const isValidUser = token && validTokens.includes(token);

  if (!isAdmin && !isValidUser) {
    return res.status(401).json({ error: { message: "Non autorizzato." } });
  }

  // [RATE LIMIT] Solo per utenti non-admin
  if (!isAdmin) {
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "unknown";
    if (!checkRateLimit(ip)) {
      return res.status(429).json({
        error: { message: "Limite richieste raggiunto. Riprova tra un'ora." },
      });
    }
  }

  try {
    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body);

    // [SANITIZE] Input contro prompt injection
    body = sanitizeBody(body);

    // Forza modello e limiti sicuri
    body.model = "claude-sonnet-4-5-20250929";
    body.max_tokens = Math.min(body.max_tokens || 8096, 16000);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    res.setHeader("Content-Type", "application/json");
    return res.status(response.status).send(text);
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ error: { message: err.message } });
  }
}
