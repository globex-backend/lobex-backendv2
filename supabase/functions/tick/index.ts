
// GLOBEX DECISION OS — Edge Function: tick
// Runs on a schedule (every 10 min). Zero hard-coded business logic.
// Orchestrates the three generic engines: rule → metric → commission-safety-belt.
// Domain logic lives in `rule` rows and `metric_def` rows, never in this file.

import { makeDb } from "../../_shared/db.ts";
import { runRules } from "../../_shared/rule_engine.ts";
import { runMetric } from "../../_shared/metric_engine.ts";

export async function tick(db: any) {
  // 1. Evaluate all enabled rules against events from the last hour.
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { data: events } = await db
    .from("event")
    .select("*")
    .gte("created_at", since);

  let insights = 0;
  for (const e of events ?? []) {
    insights += (await runRules(db, e)).length;
  }

  // 2. Refresh all manager-defined metrics (structured spec, no code change needed).
  const { data: defs } = await db.from("metric_def").select("*");
  for (const d of defs ?? []) await runMetric(db, d);

  // 3. COMMISSION SAFETY BELT — phase-1 hard rule.
  // "Commission is FORBIDDEN before payment." (Soul Document, safety belt section.)
  // Phase-2: this moves to a `safety_rule` table with the same generic interpreter.
  const payEvents = (events ?? []).filter(
    (e: any) => e.kind === "payment_confirmed"
  );
  for (const e of payEvents) {
    await db
      .from("commission")
      .update({ state: "unlocked", unlocked_at: new Date().toISOString() })
      .eq("entity_id", e.entity_id)
      .eq("state", "locked");
  }

  return { insights, metrics: (defs ?? []).length };
}

// Supabase Edge Function entry point.
export default async (_req: Request) => {
  try {
    const result = await tick(makeDb());
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
