// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const PROJECT_URL = Deno.env.get("PROJECT_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY");
const MODEL = "@preset/ai-explainer";
const ORIGIN_ALLOW_ALL = "*";
const TOKEN_LIMIT = 8000; // approx tokens per user per rolling hour

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

const getSupabaseAdmin = () => {
  if (!PROJECT_URL || !SERVICE_ROLE_KEY) return null;
  return createClient(PROJECT_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: "" } },
  });
};

const estimateTokens = (question: string, answers: string[], expectedOutput = 400) => {
  const inputChars = (question || "").length + answers.join(" ").length;
  const inputTokens = Math.ceil(inputChars / 4);
  return inputTokens + expectedOutput;
};

const rateLimit = async (admin: any, userId: string, tokens: number) => {
  // Table: ai_usage (user_id text primary key, window_start timestamptz, tokens_used integer)
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  const { data: usage } = await admin
    .from("ai_usage")
    .select("tokens_used, window_start")
    .eq("user_id", userId)
    .maybeSingle();

  let tokensUsed = 0;
  let windowStart = new Date(now).toISOString();

  if (usage?.window_start && new Date(usage.window_start).getTime() > oneHourAgo) {
    tokensUsed = usage.tokens_used || 0;
    windowStart = usage.window_start;
  }

  if (tokensUsed + tokens > TOKEN_LIMIT) {
    const resetAt = new Date(new Date(windowStart).getTime() + 60 * 60 * 1000);
    return { allowed: false, resetAt };
  }

  const newTotal = tokensUsed + tokens;
  await admin.from("ai_usage").upsert({
    user_id: userId,
    window_start: windowStart,
    tokens_used: newTotal,
  });

  return { allowed: true, resetAt: null };
};

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

  if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
    return errorResponse("Server misconfigured: missing PROJECT_URL or SERVICE_ROLE_KEY", 500);
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return errorResponse("Server misconfigured: cannot init Supabase admin", 500);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return errorResponse("Unauthorized: missing bearer token", 401);
  }

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user?.id) {
    return errorResponse("Unauthorized: invalid token", 401);
  }
  const userId = userData.user.id;

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

  const estimatedTokens = estimateTokens(question, answers, 400);
  const usageResult = await rateLimit(admin, userId, estimatedTokens);
  if (!usageResult.allowed) {
    const resetMsg = usageResult.resetAt
      ? `Please wait until ${usageResult.resetAt.toLocaleTimeString()} for reset.`
      : "Please wait for the hourly reset.";
    return errorResponse(`Too many tokens used. ${resetMsg}`, 429);
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
