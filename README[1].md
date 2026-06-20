# Globex / Persian Horizon — Decision Machine: Backend Stage 1

This is the real brain that makes the 20 modules you already built come alive.
It is **not** a place to enter or read data — it watches, analyzes, and **speaks decisions** to every level (CEO → manager → unit → smallest staff member), and acts through agents so nothing depends on one person.

## What's in this folder (real, deployable — not a mockup)
- `schema/01_schema.sql` — the memory: your 3 real pipelines, real stages, the safety-belt `event` table, and the `insight` table (the spoken decisions).
- `functions/tick_decision_engine.ts` — the brain: turns events into "you captured X / lost Y / here's WHY / do Z at cost C", using *your* real SLAs (15min→48h→72h, payment 3/7/14, Compliance <70/<50/<30).
- `agents/02_agents_seed.sql` — your agent army: content built 100% by agents; sensitive actions (cut access, contact previous employer) stay propose→approve.

## The cycle (your definition, in code)
1. Something happens → `event` (the safety belt: one unit's event touches another).
2. The brain reads events → writes an `insight` (a decision + why + costed recommendation) to the right audience.
3. A manager reads the insight and issues a `request` → it becomes a **new field** → re-enters the cycle.
4. Agents execute (auto) or propose (human approves) → `agent_action`.

## What you must provide to make it run (only this)
1. **Supabase account** (free) — paste the URL + service key; I load the schema.
2. **An AI key** (Anthropic/OpenAI) — so `content_builder`, `why_analyst`, `call_analyst` actually think.
3. **A host + domain** — to serve the app online.
4. Then, per capability, the key: **HubSpot** (your CRM is already designed for it), **WhatsApp/Twilio**, **call+transcription**, **email**, GA4/Meta — wired one at a time, each through your **n8n**.

## Honesty gradient (kept safe for UAE)
- Auto & safe now: lead scoring, cardex re-route, follow-up cadence, content production, payment reminders, CAC/why analysis, CEO brief.
- Propose→approve (legal/HR sensitive): cutting a rep's HubSpot access, "this rep failed" messages, contacting a previous employer.

## First slice to build live
The lead → why → action chain across **Sales–Finance–Marketing** — the exact chain your CRM docs are built around — because it proves the whole machine end to end.
