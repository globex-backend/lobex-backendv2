-- ============================================================
-- GLOBEX DECISION OS — Stage 3: living graph + dynamic rules
-- Approved tables: node, edge, rule, metric_def (+ metric_value)
-- One schema, every unit lives on the `unit` column.
-- ============================================================

-- ---------- LIVING GRAPH ----------
-- nodes are anything that can affect anything: units, agents,
-- modules, websites, socials, external market signals.
create table node (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in
                ('unit','agent','module','website','social','market','person','deal')),
  ref_id      uuid,                      -- points to the real row (agent.id, org_user.id, deal.id...) if any
  unit        text,                      -- which unit this node belongs to (null = cross-org)
  label       text not null,
  meta        jsonb default '{}'::jsonb,
  created_at  timestamptz default now()
);
create index on node (kind);
create index on node (unit);

-- edges: directed "A affects B". the living graph the safety belt walks.
create table edge (
  id          bigserial primary key,
  from_node   uuid references node(id) on delete cascade,
  to_node     uuid references node(id) on delete cascade,
  relation    text not null,             -- 'feeds','depends_on','amplifies','blocks','reports_to'
  weight      numeric default 1,         -- strength; learned/updated over time
  created_at  timestamptz default now(),
  unique (from_node, to_node, relation)
);
create index on edge (from_node);
create index on edge (to_node);

-- ---------- DYNAMIC RULES (rule = data, not code) ----------
-- a manager writes a sentence; rule_translate turns it into dsl;
-- NOTHING runs until enabled=true, which requires human confirmation.
create table rule (
  id          uuid primary key default gen_random_uuid(),
  unit        text,
  author_id   uuid references org_user(id),
  nl_text     text not null,             -- the manager's plain-language command
  dsl         jsonb default '{}'::jsonb, -- structured {trigger, condition, action}
  translation_note text,                 -- "this is how I understood it" shown for confirmation
  enabled     boolean default false,     -- FALSE until the human approves the translation
  confidence  numeric default 0,         -- LLM's own confidence in the translation
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index on rule (unit);
create index on rule (enabled);

-- ---------- MANAGER-DEFINED METRICS (no ALTER TABLE, ever) ----------
create table metric_def (
  key         text primary key,          -- 'second_followup_done', 'discount_call_count'
  unit        text,
  label       text not null,
  formula     text,                       -- human/dsl description of how it's computed
  source      jsonb default '{}'::jsonb,  -- where the value comes from
  created_by  uuid references org_user(id),
  created_at  timestamptz default now()
);

-- metric values stored long-format (EAV) so a new metric = new rows, not new columns
create table metric_value (
  id          bigserial primary key,
  metric_key  text references metric_def(key) on delete cascade,
  unit        text,
  deal_id     uuid references deal(id),
  user_id     uuid references org_user(id),
  value       numeric,
  value_text  text,
  ts          timestamptz default now()
);
-- the indexes that keep EAV fast at 15k+ events/month:
create index on metric_value (metric_key, ts desc);
create index on metric_value (unit, metric_key);
create index on metric_value (deal_id);

-- seed the graph with the units + their agents (so the brain has a body to reason over)
insert into node (kind, unit, label) values
('unit','sales','واحد فروش'),
('unit','marketing','واحد مارکتینگ'),
('unit','finance','واحد مالی'),
('unit','hr','واحد منابع انسانی'),
('unit','ops','واحد عملیات'),
('unit','content','واحد محتوا');
