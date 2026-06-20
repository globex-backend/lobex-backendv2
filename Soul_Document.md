# GLOBEX / PERSIAN HORIZON — SOUL DOCUMENT & BUILD CHARTER

## WHO
Globex / Persian Horizon — a UAE investment + business-brokerage firm in Dubai.
We invest in and broker the buying/selling of real businesses, and directly
operate several (salons, clinics, F&B, automotive). NOT a logistics company.

## CORE IDENTITY
A decision & causality machine — NOT a dashboard, CRM, or data-entry tool.
It talks to managers in the language of decisions. A finance manager already
reads numbers in his accounting software; if we re-show them, he never opens us.
The engine is DOMAIN-GENERIC by design (generic `entity` core) — it must never
hardcode investment/brokerage/sales logic. The same engine runs across all verticals.

## THE LANGUAGE (every output to a manager = 4 parts)
1. WHAT happened (gain & loss, numbers)
2. WHY (root cause / pattern)
3. WHAT TO DO (specific action, specific unit)
4. COST & IMPACT (estimated AED, estimated outcome)

## AGENT ARMY
Per-unit named agents (KPIs, reporting), one shared Brand DNA. Content produced
100% by agents. Sensitive actions = propose → human approve.

## SAFETY BELT (company = city; one event creates another)
- Marketing cut → Sales lead drop → Finance forecast down → CEO alert (early)
- Sales SLA miss → 48h cold lead → Marketing reactivation → Finance CAC up
- Contract closed → Legal review → Finance payment gate → commission unlocked
  (commission BEFORE customer pays = FORBIDDEN)
- HR job posted → Resume screen → Ops eval → Finance budget → HR offer + WPS

## PERMISSIONS
- CEO: diagnostic unit summaries + biggest loss/opportunity + top-3 + cross-unit
  chains; drilldown available; NOT raw daily data.
- Unit Manager: ENTIRE own unit (all sub-sections, never simplified away), agents,
  KPIs, alerts, issue requests.
- Rep/Partner: only own items, commission, tools, compliance score.
- Shared tools: contextual, not in main menu.

## REAL NUMBERS (never invent others)
Packages: 1.8–3%/mo cashflow, 20–30% growth, hybrid. Industries: salons/clinics/F&B/automotive.
SLAs: 15-min first response, 48h follow-up, 72h hot-silent → manager, 3/7/14-day escalation.
Compliance: <70 warn, <50 lead-restriction, <30 review. MOHRE: WPS 15d, EOSB 14d, probation 6mo max.
Pipelines: Investment / Purchase(Acquisition) / Sale(Exit).
Stages: New → Unreached → Follow-up Active → Warm → Hot → Signed → Payment →
Active Client → Referral (+ Lost/Recycle/Junk; Wrong Cardex = Re-route, not Junk).

## TEN MISTAKES (never)
1 HTML mockup called "online" · 2 re-ask "what first" · 3 enterprise stack
(Kafka/K8s/Neo4j/Pinecone) in phase 1 · 4 numbers without narrative · 5 CEO = only
3 stats · 6 remove sub-sections to "simplify" · 7 agents as UI mocks · 8 invent
numbers · 9 single-unit features · 10 auto legal-sensitive actions without human approval.

## ARCHITECTURE (finalized)
- Generic `entity(type, unit, attributes jsonb)` core — deal/patient/shipment/candidate
  are all rows, never tables. New domain = new rows, never a migration. NEVER reintroduce a `deal` table.
- Three engines: rule_engine (evaluates rule.dsl), metric_engine (executes structured
  metric_def.spec), tick (orchestrates; only hardcoded rule = commission safety, phase-1).
- Causal chains live in `causal_rule` rows (data, not code). Causality = temporal
  correlation + "probable" label; real causal inference is a later research problem.
- Self-growing: manager writes NL workflow → rule row (enabled=false until approved)
  → dashboard rebuilt from dashboard_block rows.

## ACCEPTED LIMITS (with difficulty)
- NL→DSL with mandatory human confirmation — 6/10
- Causality = correlation + probable label — 9/10
- Schema growth via EAV, no ALTER TABLE — 4/10
- Rule interpreter is the spine (10/10) — must exist or "self-growing" is fiction.

## BUILD ORDER
P1: two inputs (call + WhatsApp) → decision report with causal chain by end of week.
P2: more connectors + dynamic rule engine.
P3+: more units, full CEO brief, all chains.
