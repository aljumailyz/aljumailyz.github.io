// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const MODEL = "@preset/ai-explainer";
const ORIGIN_ALLOW_ALL = "*";

const corsHeaders = {
  "Access-Control-Allow-Origin": ORIGIN_ALLOW_ALL,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const errorResponse = (message: string, status = 400) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  if (!OPENROUTER_API_KEY) {
    return errorResponse("Server misconfigured: missing OPENROUTER_API_KEY", 500);
  }

  let body: any;
  try {
    body = await req.json();
  } catch (_err) {
    return errorResponse("Invalid JSON");
  }

  const { question, answers = [], correctIndex = 0 } = body || {};
  if (!question || !Array.isArray(answers) || !answers.length) {
    return errorResponse("Missing question or answers");
  }

  const prompt = [
    "Explain the correct answer, why the others are wrong, and briefly describe the underlying disease/pathology referenced.",
    `Question: ${question}`,
    "Answers:",
    answers.map((a: string, i: number) => `${i + 1}. ${a}${i === correctIndex ? " (correct)" : ""}`).join("\n"),
    "Return a concise teaching explanation and a short pathology summary.",
  ].join("\n\n");

  const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 400,
    }),
  });

  if (!upstream.ok) {
    const errText = await upstream.text();
    return errorResponse(`Upstream error: ${errText || upstream.status}`, 502);
  }

  const data = await upstream.json();
  const text = data?.choices?.[0]?.message?.content || "No response";

  return new Response(JSON.stringify({ explanation: text }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
});
