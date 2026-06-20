-- ============================================================
-- GLOBEX / PERSIAN HORIZON — DECISION MACHINE
-- Supabase (PostgreSQL) schema — Stage 1 (the brain's memory)
-- Grounded in the real CRM docs: 3 pipelines, real stages,
-- the Dashboard/Alert/Compliance "brain", the safety-belt events.
-- ============================================================

-- ---------- people & access ----------
create table org_user (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null,
  email         text unique,
  phone         text,
  role          text not null check (role in
                  ('ceo','manager','sales','marketing','finance','hr','ops','support','partner','tech')),
  unit          text,                       -- which unit they belong to
  kpi_target    numeric,                    -- their personal KPI bar
  compliance    numeric default 100,        -- the Compliance Score (your doc: <70 warn, <50 limit, <30 review)
  status        text default 'active' check (status in ('active','suspended')),
  hubspot_owner_id text,                     -- so the system can act on their CRM access
  created_at    timestamptz default now()
);

-- ---------- the 3 real pipelines ----------
create type pipeline_kind as enum ('investment','purchase','sale');

create type deal_stage as enum (
  'new_lead','unreached','followup_active','warm','hot',
  'signed','payment_pending','active_client','lost','recycle','junk'
);

create table deal (
  id              uuid primary key default gen_random_uuid(),
  pipeline        pipeline_kind not null,
  stage           deal_stage not null default 'new_lead',
  contact_name    text not null,
  phone           text, whatsapp text, email text,
  country         text, city text,
  source          text,                      -- form/whatsapp/call/ads/referral...
  owner_id        uuid references org_user(id),
  -- money (from your finance-control doc)
  amount          numeric,                    -- contract / investment value
  package         text,                       -- Cashflow / Growth / Hybrid, or Curator/Guardian..., or Exit pkgs
  paid_amount     numeric default 0,
  payment_status  text default 'pending' check (payment_status in
                    ('pending','partial','on_track','delayed','critical','completed')),
  -- decision fields
  next_action     text,
  next_action_date timestamptz,
  key_objection   text,
  silent_days     int default 0,
  escalation_level int default 0,
  lost_reason     text,
  reactivation_date date,
  created_at      timestamptz default now(),
  last_human_contact timestamptz,
  updated_at      timestamptz default now()
);

-- ---------- THE SAFETY BELT: every change is an event ----------
-- (your "company is a city": one event here creates an event there)
create table event (
  id          bigserial primary key,
  kind        text not null,                 -- lead_created, sla_breached, payment_delayed, compliance_drop...
  unit        text,                          -- which unit it touches
  deal_id     uuid references deal(id),
  actor_id    uuid references org_user(id),
  payload     jsonb default '{}'::jsonb,
  created_at  timestamptz default now()
);
create index on event (kind);
create index on event (unit);
create index on event (created_at desc);

-- ---------- the diagnoses the machine SPEAKS (not raw data) ----------
-- this is the heart: "you captured X, lost Y, here's WHY, do Z at cost C"
create table insight (
  id          uuid primary key default gen_random_uuid(),
  unit        text not null,
  audience    text not null,                 -- 'ceo' | unit name | owner_id
  severity    text not null check (severity in ('info','opportunity','warning','critical')),
  headline    text not null,                 -- the one-sentence decision
  why         text,                          -- the causal chain
  recommendation text,                       -- what to do
  est_impact  numeric,                       -- money at stake
  est_cost    numeric,                       -- cost of the action
  status      text default 'open' check (status in ('open','accepted','dismissed','done')),
  source_event_id bigint references event(id),
  created_at  timestamptz default now()
);

-- ---------- manager issues a request -> becomes a new field -> re-enters cycle ----------
create table request (
  id          uuid primary key default gen_random_uuid(),
  raised_by   uuid references org_user(id),
  unit        text,
  from_insight uuid references insight(id),
  title       text not null,
  detail      text,
  -- "becomes a new field in the app": the request can define a new tracked metric
  new_field_key text,                        -- e.g. 'second_followup_done'
  new_field_type text,                       -- bool/number/text
  status      text default 'new' check (status in ('new','approved','building','live','rejected')),
  created_at  timestamptz default now()
);

-- ---------- agents (your real agent army, now with a runtime record) ----------
create table agent (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,          -- lead_scorer, content_builder, why_analyst...
  name        text not null,
  unit        text not null,
  mode        text not null check (mode in ('auto','propose','off')),  -- propose = human approves
  confidence  numeric default 0,
  last_run    timestamptz,
  error_rate  numeric default 0
);

-- ---------- agent actions (so nothing depends on one person) ----------
create table agent_action (
  id          uuid primary key default gen_random_uuid(),
  agent_key   text references agent(key),
  deal_id     uuid references deal(id),
  action      text not null,                 -- send_whatsapp, reroute_lead, draft_content, revoke_access...
  status      text default 'proposed' check (status in ('proposed','approved','executed','failed','rejected')),
  approved_by uuid references org_user(id),  -- null until a human approves (for sensitive actions)
  result      jsonb,
  created_at  timestamptz default now()
);

-- ---------- audit (your "who changed what" rule) ----------
create table audit_log (
  id          bigserial primary key,
  actor_id    uuid references org_user(id),
  action      text,
  entity      text, entity_id text,
  before      jsonb, after jsonb,
  created_at  timestamptz default now()
);
