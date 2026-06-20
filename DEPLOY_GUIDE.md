# Globex Decision OS — Deploy Guide
For a non-programmer. Step by step. Each step once.

> Golden rule: do every step on STAGING first. Only when staging is green, repeat on production.

## Prerequisite (once)
1. On supabase.com create two projects: `globex-staging` and `globex-production`.
2. Install Supabase CLI:
   - Mac: `brew install supabase/tap/supabase`
   - Windows: `scoop install supabase` (or manual install from the Supabase site)
3. Run `supabase login` and confirm in the browser.

## Step 1 — Run the SQL (create the tables)
Order matters. Easiest path: Supabase panel -> SQL Editor -> New query ->
paste the contents of Schema.sql -> Run.

After Run, the bottom should say `Success. No rows returned`. If it shows a red
error, STOP, copy the error text, and ask in the implementation chat. Do not
proceed to the next step.

Check: Table Editor -> you should see these 16 tables:
entity, relation, org_user, event, insight, request, agent, agent_action,
commission, rule, metric_def, metric_value, dashboard_block, causal_link,
causal_rule, audit_log.

## Step 2 — Environment variables (in the Dashboard)
Panel -> Project Settings -> Edge Functions -> Secrets -> Add new secret for each:

| Name | Where to get it | Note |
|------|-----------------|------|
| SUPABASE_URL | Settings -> API -> Project URL | the project address |
| SUPABASE_SERVICE_ROLE_KEY | Settings -> API -> service_role (secret) | put ONLY here, nowhere else |
| ANTHROPIC_API_KEY | console.anthropic.com | for analysis (later) |
| OPENAI_API_KEY | platform.openai.com | for Whisper transcription (later) |

The anon key and SUPABASE_URL are public-safe; service_role and AI keys never go
in code/chat/git.

## Step 3 — Deploy the Edge Functions
In the terminal, inside the project folder:

    supabase link --project-ref <STAGING_REF>   # REF from Settings -> General -> Reference ID
    supabase functions deploy tick_decision_engine
    supabase functions deploy causal_engine

Each should say `Deployed Function ...`. On error, keep the message and ask in
the implementation chat.

## Step 4 — Schedule the cron for tick (every 10 minutes)
Panel -> Database -> Cron Jobs (or Integrations -> pg_cron -> Enable) -> Create job:
- Name: tick-every-10min
- Schedule: `*/10 * * * *`
- Type: Edge Function -> tick_decision_engine

A second job for causal, hourly:
- Name: causal-hourly
- Schedule: `0 * * * *`
- Edge Function: causal_engine

## Step 5 — Mock test (offline, before anything)
In the terminal:

    deno test --allow-env supabase/functions/

Green output: `ok | 7 passed | 0 failed`. If red here, fix code before touching Supabase.

## Step 6 — Real staging test (minimal seed)
After the mock is green, put one rule + a few real rows in staging.
SQL Editor -> paste and Run:

    insert into entity (id, type, unit, attributes) values
      ('11111111-1111-1111-1111-111111111111','deal','sales',
       '{"stage":"warm","last_event_at":"2026-06-15T09:00:00Z"}');

    insert into rule (unit, author_id, nl_text, trigger, dsl, rule_key, enabled) values
      ('sales', null, 'deal warm silent > 2 days', 'field_changed',
       '{"condition":{"and":[{"entity.attributes.stage":{"=":"warm"}},{"days_since":{">":2}}]},
         "action":{"type":"route_insight","to_unit":"sales","severity":"warning","headline":"deal silent"}}',
       'sales_silent', true);

    insert into event (kind, unit, entity_id) values
      ('field_changed','sales','11111111-1111-1111-1111-111111111111');

Then either wait for the cron, or manually invoke: Edge Functions ->
tick_decision_engine -> Invoke.

Success check: Table Editor -> insight table -> you should see ONE row with
`headline = deal silent`. If you see it, the brain works on real data.

## Step 7 — Promote to production
When staging is green:

    supabase link --project-ref <PRODUCTION_REF>
    # run Schema.sql in production SQL Editor (Step 1)
    supabase functions deploy tick_decision_engine
    supabase functions deploy causal_engine
    # set production env vars (Step 2) and cron (Step 4)

## Where to see logs (if something fails)
- Edge Function error: panel -> Edge Functions -> function name -> Logs tab.
- SQL/Database error: panel -> Logs -> Postgres Logs.
- Cron error: panel -> Database -> Cron Jobs -> run history.

## Rollback (if a deploy fails) — see 99_rollback.sql
Tables — run 99_rollback.sql in SQL Editor (drops in reverse FK order).
Edge Function — previous version is in git: `git checkout <prev>` then redeploy.
Data — on production take a backup (Database -> Backups) before any big change.
Rule: production only after staging is green, so production rollback is almost never needed.
