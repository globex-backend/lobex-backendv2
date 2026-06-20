// ============================================================
// CAUSAL ENGINE — builds the safety belt.
// Runs after the decision tick. Looks at recent events across
// units and records cause -> effect links, so the CEO sees ONE
// chain ("marketing cut -> sales drop -> finance forecast -> alert"),
// not seven disconnected alerts.
// Rules come straight from the Soul Document's real chains.
// ============================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// the known chains (the safety belt). each: if cause kind seen, look for effect kind in window.
const CHAINS = [
  { cause: "budget_cut",      effect: "lead_drop",        relation: "leads_to",  windowH: 72 },
  { cause: "lead_drop",       effect: "forecast_down",    relation: "leads_to",  windowH: 72 },
  { cause: "forecast_down",   effect: "ceo_growth_alert", relation: "leads_to",  windowH: 72 },
  { cause: "sla_breached",    effect: "lead_cold",        relation: "leads_to",  windowH: 48 },
  { cause: "lead_cold",       effect: "reactivation",     relation: "leads_to",  windowH: 48 },
  { cause: "reactivation",    effect: "cac_rise",         relation: "amplifies", windowH: 168 },
  { cause: "contract_closed", effect: "legal_review",     relation: "leads_to",  windowH: 24 },
  { cause: "legal_review",    effect: "payment_gate",     relation: "leads_to",  windowH: 24 },
  { cause: "payment_confirmed", effect: "commission_unlocked", relation: "unlocks", windowH: 24 },
  { cause: "whatsapp_silent", effect: "lead_drop",        relation: "leads_to",  windowH: 48 },
];

export default async function causalTick() {
  const linked: number[] = [];

  for (const c of CHAINS) {
    const { data: causes } = await db.from("event")
      .select("id, unit, created_at, deal_id")
      .eq("kind", c.cause)
      .gte("created_at", new Date(Date.now() - c.windowH * 3600_000).toISOString());

    for (const cause of causes ?? []) {
      // find an effect event after the cause, within the window, ideally same deal/unit
      const { data: effects } = await db.from("event")
        .select("id, created_at")
        .eq("kind", c.effect)
        .gt("created_at", cause.created_at)
        .lte("created_at", new Date(new Date(cause.created_at).getTime() + c.windowH * 3600_000).toISOString())
        .limit(1);

      const effect = effects?.[0];
      if (!effect) continue;

      // avoid duplicate links
      const { data: exists } = await db.from("causal_link")
        .select("id").eq("cause_event", cause.id).eq("effect_event", effect.id).limit(1);
      if (exists?.length) continue;

      await db.from("causal_link").insert({
        cause_event: cause.id, effect_event: effect.id,
        relation: c.relation, confidence: 0.7, detected_by: "causal_engine"
      });
      linked.push(effect.id);
    }
  }

  return new Response(JSON.stringify({ ok: true, links_added: linked.length }),
    { headers: { "content-type": "application/json" } });
}
