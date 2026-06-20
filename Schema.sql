-- GLOBEX DECISION OS — generic schema (entity core)
-- Domain lives in DATA (entity/rule/metric_def rows), never in code.
-- New domain = new rows, never a migration. No per-domain tables. NO `deal` table.

create extension if not exists pgcrypto;  -- for gen_random_uuid()

-- GENERIC ENTITY: deal, patient, shipment, candidate... all live here
create table entity (
  id          uuid primary key default gen_random_uuid(),
  type        text not null,                 -- 'deal','patient','shipment','candidate','content'...
  unit        text not null,
  attributes  jsonb not null default '{}',   -- ALL domain fields: age, insurance_type, stage, amount...
  status      text default 'active',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index on entity (type, unit);
create index entity_stage_idx on entity ((attributes->>'stage'))    where attributes ? 'stage';
create index entity_owner_idx on entity ((attributes->>'owner_id')) where attributes ? 'owner_id';
create index entity_age_idx   on entity (((attributes->>'age')::int)) where attributes ? 'age';
create index entity_attr_gin  on entity using gin (attributes);

-- RELATION: entity <-> entity ("this shipment belongs to this order")
create table relation (
  id          bigserial primary key,
  from_entity uuid references entity(id) on delete cascade,
  to_entity   uuid references entity(id) on delete cascade,
  kind        text not null,                 -- 'belongs_to','owned_by','child_of','assigned_to'
  created_at  timestamptz default now(),
  unique (from_entity, to_entity, kind)
);
create index on relation (from_entity);
create index on relation (to_entity);

-- PEOPLE & ACCESS (identity is not a domain entity)
create table org_user (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  email       text unique,
  role        text not null check (role in
                ('ceo','manager','sales','marketing','finance','hr','ops','support','partner','tech','clinic')),
  unit        text,
  kpi_target  numeric,
  compliance  numeric default 100,
  status      text default 'active',
  ext_ref     jsonb default '{}',
  created_at  timestamptz default now()
);

-- EVENT: everything that happens (the safety belt). Generic subject = entity.
create table event (
  id          bigserial primary key,
  kind        text not null,
  unit        text,
  entity_id   uuid references entity(id),
  actor_id    uuid references org_user(id),
  payload     jsonb default '{}',            -- includes full transcript text when relevant (not a ref)
  created_at  timestamptz default now()
);
create index on event (kind);
create index on event (unit);
create index on event (entity_id);
create index on event (created_at desc);
create index event_payload_gin on event using gin (payload);

-- INSIGHT: the 4-part spoken decision. + rule_key for dedup.
create table insight (
  id          uuid primary key default gen_random_uuid(),
  unit        text not null,
  audience    text not null,
  severity    text not null check (severity in ('info','opportunity','warning','critical')),
  headline    text not null,
  why         text,
  recommendation text,
  est_impact  numeric,
  est_cost    numeric,
  rule_key    text,
  entity_id   uuid references entity(id),
  source_event_id bigint references event(id),
  status      text default 'open' check (status in ('open','accepted','dismissed','done')),
  created_at  timestamptz default now()
);
create unique index insight_dedup on insight (entity_id, rule_key) where status = 'open';

-- REQUEST: manager's request -> new field -> re-enters cycle
create table request (
  id          uuid primary key default gen_random_uuid(),
  raised_by   uuid references org_user(id),
  unit        text,
  from_insight uuid references insight(id),
  title       text not null,
  detail      text,
  new_field_key text,
  status      text default 'new' check (status in ('new','approved','building','live','rejected')),
  created_at  timestamptz default now()
);

-- AGENT + ACTION
create table agent (
  id   uuid primary key default gen_random_uuid(),
  key  text unique not null, name text not null, unit text not null,
  mode text not null check (mode in ('auto','propose','off'))
);
create table agent_action (
  id          uuid primary key default gen_random_uuid(),
  agent_key   text references agent(key),
  entity_id   uuid references entity(id),
  action      text not null,
  status      text default 'proposed' check (status in ('proposed','approved','executed','failed','rejected')),
  approved_by uuid references org_user(id),
  result      jsonb,
  created_at  timestamptz default now()
);

-- COMMISSION: explicit home for the hard rule (locked until payment)
create table commission (
  id          uuid primary key default gen_random_uuid(),
  entity_id   uuid references entity(id),
  beneficiary uuid references org_user(id),
  amount      numeric,
  state       text not null default 'locked' check (state in ('locked','unlocked','paid')),
  unlocked_at timestamptz,
  created_at  timestamptz default now()
);

-- RULE: manager-defined logic as DATA (interpreted, never coded)
create table rule (
  id          uuid primary key default gen_random_uuid(),
  unit        text,
  author_id   uuid references org_user(id),
  nl_text     text not null,
  trigger     text not null,
  dsl         jsonb not null default '{}',
  rule_key    text not null,
  enabled     boolean default false,
  confidence  numeric default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index on rule (trigger) where enabled;

-- METRIC: structured definition (executable) + values (EAV)
create table metric_def (
  key         text primary key,
  unit        text,
  label       text not null,
  spec        jsonb not null,
  created_by  uuid references org_user(id),
  created_at  timestamptz default now()
);
create table metric_value (
  id          bigserial primary key,
  metric_key  text references metric_def(key) on delete cascade,
  unit        text,
  entity_id   uuid references entity(id),
  value       numeric,
  ts          timestamptz default now()
);
create index on metric_value (metric_key, ts desc);
create index on metric_value (unit, metric_key);

-- DASHBOARD (generated UI) + CAUSAL links + CAUSAL rules (chains as DATA)
create table dashboard_block (
  id          uuid primary key default gen_random_uuid(),
  owner_role  text not null, unit text,
  kind        text not null check (kind in ('decision','metric','chain','agent_status','custom')),
  title       text not null,
  source      jsonb not null,
  sort_order  int default 100,
  created_by_rule uuid references rule(id),
  created_at  timestamptz default now()
);
create table causal_link (
  id          bigserial primary key,
  cause_event bigint references event(id),
  effect_event bigint references event(id),
  relation    text, confidence numeric default 0.5, detected_by text,
  created_at  timestamptz default now()
);
create table causal_rule (
  id          bigserial primary key,
  cause_kind  text not null,
  effect_kind text not null,
  relation    text not null default 'leads_to',
  window_hours int not null default 48,
  confidence  numeric default 0.7,
  enabled     boolean default true
);

-- AUDIT
create table audit_log (
  id bigserial primary key,
  actor_id uuid references org_user(id),
  action text, entity text, entity_id text,
  before jsonb, after jsonb,
  created_at timestamptz default now()
);
