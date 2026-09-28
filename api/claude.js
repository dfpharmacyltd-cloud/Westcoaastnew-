// Serverless proxy to the Anthropic Messages API.
// The API key stays on the server (env ANTHROPIC_API_KEY); the browser never sees it.
const MODELS = {
  quick:   process.env.MODEL_QUICK   || "claude-haiku-4-5-20251001",
  default: process.env.MODEL_DEFAULT || "claude-sonnet-5",
  complex: process.env.MODEL_COMPLEX || "claude-opus-5-5",
};
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || "16000", 10);

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}

module.exports = async (req, res) => {
  const password = process.env.APP_PASSWORD || "";
  const keyConfigured = !!process.env.ANTHROPIC_API_KEY;

  if (req.method === "GET") {
    return send(res, 200, { ok: true, keyConfigured, passwordRequired: !!password, models: MODELS });
  }
  if (req.method !== "POST") return send(res, 405, { code: "invalid_request", message: "Use POST" });
  if (password && req.headers["x-app-password"] !== password) {
    return send(res, 401, { code: "not_granted", message: "Wrong or missing app password" });
  }
  if (!keyConfigured) return send(res, 500, { code: "not_configured", message: "ANTHROPIC_API_KEY is not set on the server" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || !Array.isArray(body.messages) || !body.messages.length) {
    return send(res, 400, { code: "invalid_request", message: "messages[] required" });
  }
  const tier = MODELS[body.tier] ? body.tier : "default";
  const images = Array.isArray(body.images) ? body.images.slice(0, 20) : [];

  // Merge consecutive same-role turns and attach images to the last user turn.
  const msgs = [];
  for (const m of body.messages) {
    const role = m.role === "assistant" ? "assistant" : "user";
    const text = String(m.content || "");
    if (!text) continue;
    if (msgs.length && msgs[msgs.length - 1].role === role) msgs[msgs.length - 1].text += "\n\n" + text;
    else msgs.push({ role, text });
  }
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") {
    return send(res, 400, { code: "invalid_request", message: "conversation must start and end with a user turn" });
  }
  const apiMessages = msgs.map((m, i) => {
    if (i === msgs.length - 1 && images.length) {
      return { role: m.role, content: [
        ...images.map(im => ({ type: "image", source: { type: "base64", media_type: im.media_type || "image/jpeg", data: im.data } })),
        { type: "text", text: m.text },
      ] };
    }
    return { role: m.role, content: m.text };
  });

  const system = body.json
    ? "Your reply will be parsed by a program. Reply with only the requested JSON value, no prose and no code fences."
    : "You are a careful regulatory document assistant. Answer only from the data provided.";

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model: MODELS[tier], max_tokens: MAX_TOKENS, system, messages: apiMessages }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const code = r.status === 429 ? "rate_limited" : r.status === 413 ? "prompt_too_large"
        : r.status === 401 || r.status === 403 ? "not_configured" : "upstream_error";
      return send(res, r.status === 401 ? 500 : r.status, { code, message: (data.error && data.error.message) || ("Anthropic API error " + r.status) });
    }
    const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
    return send(res, 200, { text, truncated: data.stop_reason === "max_tokens", model: data.model, usage: data.usage });
  } catch (e) {
    return send(res, 502, { code: "upstream_error", message: String(e && e.message || e) });
  }
};
