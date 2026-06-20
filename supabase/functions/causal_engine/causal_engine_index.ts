// GLOBEX DECISION OS — Edge Function: causal_engine
// Runs hourly. Builds the "safety belt" — cross-unit causal chains.
// Chains are DATA: they live in `causal_rule` rows, not in this file.
// This engine reads them and records temporal correlations as `causal_link` rows.
// (True causal inference is a Phase-3 research problem; here we record
//  temporal correlation and label it "probable" — per Soul Document §ACCEPTED LIMITS.)

import { makeDb } from "../../_shared/db.ts";

async function causalTick(db: any) {
  // Load all enabled causal rules from the database (domain-neutral).
  const { data: rules, error } = await db
    .from("causal_rule")
    .select("*")
    .eq("enabled", true);

  if (error) throw new Error(`causal_rule fetch failed: ${error.message}`);

  let linksAdded = 0;

  for (const rule of rules ?? []) {
    // Find recent cause events within the rule's detection window.
    const windowStart = new Date(
      Date.now() - rule.window_hours * 3_600_000
    ).toISOString();

    const { data: causes } = await db
      .from("event")
      .select("id, unit, created_at, entity_id")   // entity_id, never deal_id
      .eq("kind", rule.cause_kind)
      .gte("created_at", windowStart);

    for (const cause of causes ?? []) {
      // Look for an effect event that occurred AFTER the cause, within the window.
      const { data: effects } = await db
        .from("event")
        .select("id, created_at")
        .eq("kind", rule.effect_kind)
        .gt("created_at", cause.created_at)
        .lte(
          "created_at",
          new Date(
            new Date(cause.created_at).getTime() + rule.window_hours * 3_600_000
          ).toISOString()
        )
        .limit(1);

      const effect = effects?.[0];
      if (!effect) continue;

      // Deduplicate: skip if this pair already has a causal_link.
      const { data: exists } = await db
        .from("causal_link")
        .select("id")
        .eq("cause_event", cause.id)
        .eq("effect_event", effect.id)
        .limit(1);

      if (exists?.length) continue;

      await db.from("causal_link").insert({
        cause_event:  cause.id,
        effect_event: effect.id,
        relation:     rule.relation,
        confidence:   rule.confidence ?? 0.7,
        detected_by:  "causal_engine",
      });
      linksAdded++;
    }
  }

  return { links_added: linksAdded };
}

// Supabase Edge Function entry point.
export default async (_req: Request) => {
  try {
    const result = await causalTick(makeDb());
    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { "content-type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};
