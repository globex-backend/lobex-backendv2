-- ============================================================
-- GLOBEX DECISION MACHINE — Stage 2: the SELF-GROWING layer
-- This is what makes it a machine, not a tool:
--  - a manager writes a workflow  -> a row here
--  - the dashboard is BUILT FROM these rows (data-driven UI)
--  - so the dashboard rebuilds itself the moment the row changes
--  - the causal layer links events across units (the safety belt)
-- ============================================================

-- ---------- WORKFLOWS managers write themselves ----------
-- "هر مدیر بتونه ورک‌فلوی خودش رو بنویسه که داشبورد سریعاً تغییر کند"
create table workflow (
  id          uuid primary key default gen_random_uuid(),
  unit        text not null,
  author_id   uuid references org_user(id),
  name        text not null,
  -- the rule in plain structured form: WHEN <trigger> IF <condition> THEN <action>
  trigger_kind text not null,         -- event kind it listens to (sla_breached, payment_delayed, whatsapp_silent...)
  condition   jsonb default '{}'::jsonb,  -- e.g. {"silent_days": {">": 2}, "stage": "hot"}
  action      jsonb default '{}'::jsonb,  -- e.g. {"type":"alert","to":"manager"} or {"type":"agent","key":"followup_sender"}
  -- the manager can also declare a NEW METRIC -> becomes a new dashboard block automatically
  defines_metric text,                -- e.g. 'second_followup_done'  (null if none)
  enabled     boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ---------- DASHBOARD is generated, never hard-coded ----------
-- the UI renders whatever rows exist here, filtered by role+unit.
-- when a workflow defines a metric, a block is inserted here -> dashboard grows.
create table dashboard_block (
  id          uuid primary key default gen_random_uuid(),
  owner_role  text not null,          -- ceo | manager | sales | finance ...
  unit        text,                   -- null = cross-unit (CEO)
  kind        text not null check (kind in ('decision','metric','chain','agent_status','custom')),
  title       text not null,
  -- how to fill it: a saved query/selector the renderer runs (no code change needed)
  source      jsonb not null,         -- e.g. {"from":"insight","where":{"unit":"sales","status":"open"},"limit":5}
  sort_order  int default 100,
  created_by_workflow uuid references workflow(id),
  created_at  timestamptz default now()
);

-- ---------- CAUSAL CHAINS: the safety belt, made explicit ----------
-- links an event in unit A to the event it caused in unit B,
-- so the machine can SPEAK the whole chain, not 7 separate alerts.
create table causal_link (
  id          bigserial primary key,
  cause_event   bigint references event(id),
  effect_event  bigint references event(id),
  relation    text,                   -- 'leads_to','amplifies','blocks','unlocks'
  confidence  numeric default 0.5,
  detected_by text,                   -- which rule/agent found it
  created_at  timestamptz default now()
);
create index on causal_link (cause_event);
create index on causal_link (effect_event);

-- a chain is just a walk over causal_link; this view gives the latest roots
create view active_chain_root as
  select e.id as event_id, e.kind, e.unit, e.created_at
  from event e
  where exists (select 1 from causal_link c where c.cause_event = e.id)
    and not exists (select 1 from causal_link c2 where c2.effect_event = e.id)
  order by e.created_at desc;

-- ---------- seed the default dashboard blocks (the starting brain) ----------
insert into dashboard_block (owner_role, unit, kind, title, source, sort_order) values
('ceo',  null,     'decision', 'بزرگ‌ترین ضرر و فرصتِ امروز',
   '{"from":"insight","where":{"audience":"ceo","status":"open"},"order":"severity","limit":5}', 10),
('ceo',  null,     'chain',    'زنجیره‌های بین‌واحدی',
   '{"from":"active_chain_root","limit":5}', 20),
('manager','sales','decision', 'تصمیم‌های واحد فروش',
   '{"from":"insight","where":{"unit":"sales","status":"open"},"order":"severity","limit":8}', 10),
('manager','finance','decision','تصمیم‌های واحد مالی',
   '{"from":"insight","where":{"unit":"finance","status":"open"},"order":"severity","limit":8}', 10),
('manager','marketing','decision','تصمیم‌های واحد مارکتینگ',
   '{"from":"insight","where":{"unit":"marketing","status":"open"},"order":"severity","limit":8}', 10),
('manager','hr','decision','تصمیم‌های منابع انسانی',
   '{"from":"insight","where":{"unit":"hr","status":"open"},"order":"severity","limit":8}', 10);
