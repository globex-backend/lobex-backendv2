-- 99_rollback.sql — drops all tables in reverse FK order. Use only to reset.
drop table if exists causal_link, causal_rule cascade;
drop table if exists dashboard_block cascade;
drop table if exists metric_value, metric_def cascade;
drop table if exists rule cascade;
drop table if exists commission cascade;
drop table if exists agent_action, agent cascade;
drop table if exists request cascade;
drop table if exists insight cascade;
drop table if exists event cascade;
drop table if exists relation, entity cascade;
drop table if exists audit_log cascade;
drop table if exists org_user cascade;
