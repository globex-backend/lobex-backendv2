import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const INTERNAL_DISPATCH_SECRET = Deno.env.get("INTERNAL_DISPATCH_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  const authHeader = req.headers.get("x-dispatch-secret");
  if (authHeader !== INTERNAL_DISPATCH_SECRET) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  let body: { prompt: string; system?: string; entity_id?: string; max_tokens?: number };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON body" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const { prompt, system = "You are a helpful business assistant for Globex Horizon.", entity_id, max_tokens = 1000 } = body;

  if (!prompt) {
    return new Response(JSON.stringify({ ok: false, error: "Missing required field: prompt" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!aiResponse.ok) {
    const errText = await aiResponse.text();
    return new Response(JSON.stringify({ ok: false, error: `Anthropic error: ${errText}` }), { status: 502, headers: { "Content-Type": "application/json" } });
  }

  const aiData = await aiResponse.json();
  const result = aiData.content?.[0]?.text || "";

  if (entity_id) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await supabase.from("entity").update({
      attributes: { last_ai_output: result, last_ai_prompt: prompt, last_ai_at: new Date().toISOString() },
      status: "ai_processed",
    }).eq("id", entity_id);
  }

  return new Response(JSON.stringify({ ok: true, data: { result, model: "claude-sonnet-4-6", timestamp: new Date().toISOString() } }), { status: 200, headers: { "Content-Type": "application/json" } });
});
