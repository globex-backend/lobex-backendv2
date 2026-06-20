// GENERIC: executes a structured metric_def.spec over a filtered entity set.
// spec = {"agg":"sum","of":"amount","where":{"type":"deal","attributes.stage":"lost"},"window_days":30}
export async function runMetric(db: any, def: any) {
  let q = db.from("entity").select("*");
  const where = def.spec?.where ?? {};
  for (const [k, v] of Object.entries(where)) {
    if (k.startsWith("attributes.")) q = q.contains("attributes", { [k.slice(11)]: v });
    else q = q.eq(k, v);
  }
  if (def.spec?.window_days)
    q = q.gte("updated_at", new Date(Date.now() - def.spec.window_days*86400000).toISOString());
  const { data: rows } = await q;
  const of = def.spec?.of;
  const nums = (rows ?? []).map((e: any) => Number(e.attributes?.[of] ?? 0));
  let value = 0;
  switch (def.spec?.agg) {
    case "count": value = (rows ?? []).length; break;
    case "sum":   value = nums.reduce((a,b)=>a+b,0); break;
    case "avg":   value = nums.length ? nums.reduce((a,b)=>a+b,0)/nums.length : 0; break;
  }
  await db.from("metric_value").insert({ metric_key: def.key, unit: def.unit, value });
  return value;
}
