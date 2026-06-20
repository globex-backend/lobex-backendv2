import { assertEquals } from "jsr:@std/assert";
import { mockDb } from "../_shared/mock_db.ts";
import { tick } from "./index.ts";

const now = Date.now();
const ago = (h:number) => new Date(now - h*3600_000).toISOString();

// GENERIC fixtures: same engine, two domains, ZERO code change
const salesRule = {
  id:"r1", trigger:"field_changed", enabled:true, unit:"sales", rule_key:"sales_silent",
  nl_text:"deal silent >2 days", dsl:{ condition:{ and:[
    {"entity.attributes.stage":{"=":"warm"}}, {"days_since":{">":2}} ]},
    action:{ type:"route_insight", to_unit:"sales", severity:"warning", headline:"deal silent" } } };
const clinicRule = {
  id:"r2", trigger:"visit_completed", enabled:true, unit:"clinic", rule_key:"clinic_norecall",
  nl_text:"root canal no refill 7d, insurance X, age>50", dsl:{ condition:{ and:[
    {"entity.attributes.visit_type":{"=":"root_canal"}}, {"days_since":{">":7}},
    {"entity.attributes.next_visit_booked":{"=":false}},
    {"entity.attributes.insurance_type":{"=":"X"}}, {"entity.attributes.age":{">":50}} ]},
    action:{ type:"notify", to_role:"receptionist", severity:"warning", headline:"recall patient" } } };

Deno.test("A — no rules -> no insights (logic is not hardcoded)", async () => {
  const db = mockDb({
    rule: [],
    event: Array.from({length:10}, (_,i)=>({ id:i+1, kind:"field_changed", entity_id:"e1", created_at:ago(0.1) })),
    entity: [{ id:"e1", type:"deal", unit:"sales", attributes:{ stage:"warm" } }],
    metric_def: [],
  });
  await tick(db);
  assertEquals(db._tables.insight.length, 0);
  assertEquals(db._tables.agent_action.length, 0);
});

Deno.test("B-sales — sales rule fires on matching entity only", async () => {
  const db = mockDb({
    rule: [salesRule],
    entity: [
      { id:"e1", type:"deal", unit:"sales", attributes:{ stage:"warm", last_event_at:ago(96) } },
      { id:"e2", type:"deal", unit:"sales", attributes:{ stage:"warm", last_event_at:ago(1) } },
    ],
    event: [
      { id:1, kind:"field_changed", entity_id:"e1", created_at:ago(0.1) },
      { id:2, kind:"field_changed", entity_id:"e2", created_at:ago(0.1) },
    ],
    insight: [], agent_action: [], metric_def: [],
  });
  await tick(db);
  assertEquals(db._tables.insight.length, 1);
  assertEquals(db._tables.insight[0].rule_key, "sales_silent");
  assertEquals(db._tables.insight[0].severity, "warning");
});

Deno.test("B-clinic — SAME engine, clinic rule, compound AND of 3 attrs", async () => {
  const db = mockDb({
    rule: [clinicRule],
    entity: [
      { id:"p1", type:"patient", unit:"clinic", attributes:{ visit_type:"root_canal", next_visit_booked:false,
        insurance_type:"X", age:62, last_event_at:ago(8*24) } },
      { id:"p2", type:"patient", unit:"clinic", attributes:{ visit_type:"root_canal", next_visit_booked:false,
        insurance_type:"X", age:40, last_event_at:ago(8*24) } },
      { id:"p3", type:"patient", unit:"clinic", attributes:{ visit_type:"cleaning", next_visit_booked:false,
        insurance_type:"X", age:70, last_event_at:ago(8*24) } },
    ],
    event: [
      { id:1, kind:"visit_completed", entity_id:"p1", created_at:ago(0.1) },
      { id:2, kind:"visit_completed", entity_id:"p2", created_at:ago(0.1) },
      { id:3, kind:"visit_completed", entity_id:"p3", created_at:ago(0.1) },
    ],
    insight: [], agent_action: [], metric_def: [],
  });
  await tick(db);
  assertEquals(db._tables.insight.length, 1);
  assertEquals(db._tables.insight[0].audience, "receptionist");
});

Deno.test("C — rule changed at runtime -> behavior changes, no redeploy", async () => {
  const relaxed = structuredClone(clinicRule);
  relaxed.dsl.condition.and[4] = {"entity.attributes.age":{">":30}};
  const db = mockDb({
    rule: [relaxed],
    entity: [{ id:"p2", type:"patient", unit:"clinic", attributes:{ visit_type:"root_canal",
      next_visit_booked:false, insurance_type:"X", age:40, last_event_at:ago(8*24) } }],
    event: [{ id:1, kind:"visit_completed", entity_id:"p2", created_at:ago(0.1) }],
    insight: [], agent_action: [], metric_def: [],
  });
  await tick(db);
  assertEquals(db._tables.insight.length, 1);
});

Deno.test("dedup — same rule+entity twice -> one open insight", async () => {
  const db = mockDb({
    rule: [salesRule],
    entity: [{ id:"e1", type:"deal", unit:"sales", attributes:{ stage:"warm", last_event_at:ago(96) } }],
    event: [
      { id:1, kind:"field_changed", entity_id:"e1", created_at:ago(0.1) },
      { id:2, kind:"field_changed", entity_id:"e1", created_at:ago(0.05) },
    ],
    insight: [], agent_action: [], metric_def: [],
  });
  await tick(db);
  assertEquals(db._tables.insight.length, 1);
});
