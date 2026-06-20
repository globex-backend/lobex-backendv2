// GENERIC interpreter: evaluates rule.dsl against an event + its entity.
// No business logic. No domain words. Reads rules from the table.

// resolve a path like "patient.age" or "amount" against entity.attributes / event.payload
function resolve(path: string, ctx: any): any {
  const [head, ...rest] = path.split(".");
  let base = head in ctx ? ctx[head] : (ctx.entity?.attributes ?? {})[head] ?? (ctx.payload ?? {})[head];
  for (const k of rest) base = base?.[k];
  return base;
}

function testLeaf(cond: any, ctx: any): boolean {
  const [field, test] = Object.entries(cond)[0] as [string, any];
  const [op, val] = Object.entries(test)[0] as [string, any];
  let actual = resolve(field, ctx);
  if (field === "days_since")
    actual = (Date.now() - new Date(ctx.entity?.attributes?.last_event_at ?? ctx.event.created_at).getTime())/86400000;
  switch (op) {
    case "=":  return actual === val;
    case "!=": return actual !== val;
    case ">":  return Number(actual) >  Number(val);
    case "<":  return Number(actual) <  Number(val);
    case ">=": return Number(actual) >= Number(val);
    case "<=": return Number(actual) <= Number(val);
    case "contains": return String(actual ?? "").includes(String(val));
    default: return false;
  }
}

export function evalCondition(cond: any, ctx: any): boolean {
  if (!cond || Object.keys(cond).length === 0) return true;
  if (cond.and) return cond.and.every((c: any) => evalCondition(c, ctx));
  if (cond.or)  return cond.or.some((c: any) => evalCondition(c, ctx));
  return testLeaf(cond, ctx);
}

// for one incoming event: find enabled rules on this trigger, eval, produce insight/action
export async function runRules(db: any, event: any) {
  const { data: rules } = await db.from("rule").select("*").eq("trigger", event.kind).eq("enabled", true);
  const { data: entRows } = event.entity_id
    ? await db.from("entity").select("*").eq("id", event.entity_id) : { data: [] };
  const entity = entRows?.[0] ?? null;
  const ctx = { event, entity, payload: event.payload ?? {} };
  const made: any[] = [];

  for (const r of rules ?? []) {
    if (!evalCondition(r.dsl?.condition, ctx)) continue;
    const a = r.dsl?.action ?? {};
    if (a.type === "notify" || a.type === "route_insight") {
      const ins = {
        unit: a.to_unit ?? r.unit, audience: a.to_role ?? a.to_unit ?? r.unit,
        severity: a.severity ?? "warning",
        headline: a.headline ?? r.nl_text,
        why: a.why ?? null, recommendation: a.recommendation ?? null,
        rule_key: r.rule_key, entity_id: event.entity_id, source_event_id: event.id,
      };
      // dedup: unique open-insight index blocks duplicates for (entity, rule_key)
      const { error } = await db.from("insight").insert(ins);
      if (!error) made.push(ins);
    } else if (a.type) {
      await db.from("agent_action").insert({
        agent_key: a.agent ?? null, entity_id: event.entity_id,
        action: a.type, status: a.sensitive ? "proposed" : "executed",
      });
      made.push(a);
    }
  }
  return made;
}
