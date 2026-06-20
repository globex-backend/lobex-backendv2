// Zero hardcoded business logic. Just orchestrates the generic engines.
import { makeDb } from "../_shared/db.ts";
import { runRules } from "../_shared/rule_engine.ts";
import { runMetric } from "../_shared/metric_engine.ts";

export async function tick(db: any) {
  // 1. run all enabled rules against recent events
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { data: events } = await db.from("event").select("*").gte("created_at", since);
  let insights = 0;
  for (const e of events ?? []) insights += (await runRules(db, e)).length;

  // 2. refresh all defined metrics (manager-defined, not coded)
  const { data: defs } = await db.from("metric_def").select("*");
  for (const d of defs ?? []) await runMetric(db, d);

  // HARDCODED SAFETY RULE — phase 1 only.
  // In phase 2 this moves to a `safety_rule` table with the same generic interpreter pattern.
  // Reason: payment->commission is a legal/compliance rule, not a manager workflow.
  const pay = (events ?? []).filter((e:any)=>e.kind==="payment_confirmed");
  for (const e of pay)
    await db.from("commission").update({ state:"unlocked", unlocked_at:new Date().toISOString() })
            .eq("entity_id", e.entity_id).eq("state","locked");

  return { insights, metrics: (defs??[]).length };
}

export default async () => {
  const r = await tick(makeDb());
  return new Response(JSON.stringify({ ok:true, ...r }), { headers:{ "content-type":"application/json" }});
};
