// Vercel serverless route: lets the Vercel preview (where the backend runs in the browser) use NVIDIA
// Nemotron without exposing the key. The key lives in Vercel's NVIDIA_API_KEY environment variable.
// Only classification requests pass: model, size and fields are fixed here. Not used by Base44.
const MODEL = process.env.NVIDIA_MODEL || "nvidia/nemotron-3.5-super-vl-120b-a12b";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const key = process.env.NVIDIA_API_KEY;
  if (!key) return res.status(503).json({ error: "NVIDIA_API_KEY not set" });
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const prompt = String(body.prompt || "").slice(0, 8000);
  if (!prompt) return res.status(400).json({ error: "prompt required" });
  const send = (extra) =>
    fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: "You classify questions. Reply with one JSON object that matches the schema. No prose." },
          { role: "user", content: prompt },
        ],
        stream: false,
        temperature: 0,
        max_tokens: 300,
        response_format: body.response_format,
        ...extra,
      }),
    });
  try {
    let r = await send({ reasoning_effort: "none" });
    if (r.status === 400) r = await send({ chat_template_kwargs: { enable_thinking: false } });
    if (r.status !== 200) return res.status(502).json({ error: `NVIDIA ${r.status}` });
    const msg = (await r.json())?.choices?.[0]?.message || {};
    const json = String(msg.content || "").match(/\{[\s\S]*\}/);
    return res.status(200).json(json ? JSON.parse(json[0]) : { intent: "unsupported" });
  } catch (e) {
    return res.status(502).json({ error: e?.message || "NVIDIA call failed" });
  }
}
