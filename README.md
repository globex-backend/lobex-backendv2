# Globex Decision OS — backend (canonical)

Domain-generic decision & causality engine for Globex / Persian Horizon (Dubai
investment + business-brokerage). The engine NEVER hardcodes domain logic — rules
and causal chains live in tables (`rule`, `causal_rule`); every subject is a row in
the generic `entity` table (no `deal` table).

## Files
- `Soul_Document.md` — charter / the "why" (load first in any AI session)
- `Schema.sql` — the full entity-generic Postgres schema (16 tables)
- `DEPLOY_GUIDE.md` — step-by-step Supabase deploy for a non-programmer
- `supabase/functions/_shared/` — db client, rule_engine, metric_engine, mock_db
- `supabase/functions/tick_decision_engine/` — orchestrator (index.ts) + tests
- `supabase/functions/causal_engine/` — causal linker (index.ts) + tests
- `supabase/migrations_99_rollback.sql` — reset script

## Test
    deno test --allow-env supabase/functions/
Green = `ok | 7 passed | 0 failed`. Proves genericity across two domains (sales + clinic).

## 4-point canonical check (must all pass)
1. Schema has `entity`, `relation`, `commission`, `causal_rule`, `insight.rule_key`; NO `deal` table.
2. Engines have no hardcoded business logic (only the commented commission safety rule).
3. Tests cover two domains.
4. Files named exactly as above.
