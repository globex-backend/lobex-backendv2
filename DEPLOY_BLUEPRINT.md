# Globex Decision OS — نقشهٔ کامل قبل از کلیدِ اول
(این سند را بخوان و تأیید کن. تا تأیید نکنی، Supabase نمی‌سازیم.)

## وضعیتِ صادقانهٔ کد
- schema (SQL): نوشته شده، `psql --dry` معتبر، ولی روی دیتابیسِ واقعی اجرا نشده.
- Edge Functions (TS/Deno): نوشته شده، فقط syntax چک شده با node — **رفتارش تست‌نشده**.
- هیچ‌چیز نباید مستقیم روی production برود. اول test project.

---

## الف) جدول‌های Supabase (همه با ستونِ `unit` — یک schema برای همهٔ واحدها)

| جدول | کار | کلیدی‌ترین ستون‌ها |
|---|---|---|
| `org_user` | افراد، نقش، امتیازِ انضباط | role, unit, compliance, kpi_target |
| `deal` | معاملات در ۳ پایپ‌لاین | pipeline, stage, amount, payment_status, owner_id |
| `event` | **همه‌چیز یک رویداد** (کمربندِ ایمنی) | kind, unit, deal_id, payload(jsonb) |
| `insight` | تصمیمِ چهارقسمتی که ماشین می‌گوید | headline, why, recommendation, est_impact, est_cost |
| `request` | درخواستِ مدیر → فیلدِ جدید → چرخه | new_field_key, status |
| `agent` | ارتشِ ایجنت‌ها (auto/propose/off) | key, unit, mode |
| `agent_action` | اقدامِ ایجنت (حساس‌ها: تأییدِ انسانی) | action, status, approved_by |
| `audit_log` | چه کسی چه چیزی را عوض کرد | actor_id, before, after |
| `workflow` | ورک‌فلوِ مدیرنوشته | trigger_kind, condition(jsonb), action(jsonb), defines_metric |
| `dashboard_block` | داشبورد از روی رکوردها ساخته می‌شود | owner_role, unit, kind, source(jsonb) |
| `causal_link` | یالِ علت→اثر بین رویدادها | cause_event, effect_event, relation, confidence |
| `node` | گرهِ گرافِ زنده (واحد/ایجنت/سوشیال/بازار) | kind, ref_id, unit, label |
| `edge` | یالِ گراف: چه بر چه اثر می‌گذارد | from_node, to_node, relation, weight |
| `rule` | قانون به‌صورتِ داده + ترجمهٔ NL→DSL | nl_text, dsl(jsonb), enabled |
| `metric_def` | تعریفِ متریکِ مدیرساخته | key, unit, formula, source |
| `metric_value` | مقدارِ متریک (EAV — بدونِ ALTER TABLE) | metric_key, deal_id, unit, value, ts |

نکته: واحدِ جدید = ردیفِ جدید، نه جدولِ جدید. متریکِ جدید = ردیف در `metric_value`، نه ستونِ جدید.

---

## ب) Edge Functions

| Function | کار | حالت |
|---|---|---|
| `ingest_call` | فایل صوتی → Whisper → متن → event | نوشته‌نشده (فاز ۱) |
| `ingest_whatsapp` | پیامِ واتساپ → event | نوشته‌نشده (فاز ۱) |
| `analyze` | متن → تحلیلِ کلود → امتیازِ انضباط | نوشته‌نشده (فاز ۱) |
| `tick_decision_engine` | رویدادها → insightِ چهارقسمتی (قوانینِ SLA) | نوشته شده، تست‌نشده |
| `causal_engine` | رویدادها → causal_link (زنجیره) | نوشته شده، تست‌نشده |
| `rule_translate` | دستورِ زبانِ طبیعی → DSL (+ تأییدِ انسانی) | نوشته‌نشده (ماهِ ۲) |
| `dashboard_render` | از `dashboard_block` → خروجیِ داشبورد | نوشته‌نشده |

دو لایهٔ مدل (برای حجمِ بالا و هزینه): مدلِ سریع همه را غربال می‌کند، مدلِ قوی فقط روی علامت‌خورده‌ها.

---

## ج) متغیرهای محیطی (در پنل Supabase → Edge Functions → Secrets)
هیچ‌کدام در کد یا چت نمی‌آیند.
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY      ← تو در پنل می‌گذاری، نه در چت
ANTHROPIC_API_KEY              ← یا OPENAI_API_KEY
WHISPER_API_KEY / DEEPGRAM_API_KEY
WHATSAPP_TOKEN  (فاز ۲)
```

---

## د) ترتیبِ deploy و تست (روی TEST PROJECT، نه production)
1. test project جدا بساز.
2. `schema/01_schema.sql` → `03_self_growing.sql` → `agents/02_agents_seed.sql` را اجرا کن. چک: جدول‌ها ساخته شدند؟
3. دادهٔ نمونه: ۵ دیلِ ساختگی + چند رویداد insert کن.
4. `tick_decision_engine` را اجرا کن → چک: آیا insightِ درست ساخت؟
5. `causal_engine` → چک: آیا causal_link ساخت؟
6. تست‌های واحد (`deno test`) را اجرا کن.
7. وقتی همه سبز شد → تازه روی production همان مراحل.

احتمالِ شکست در اجرای اول: واقع‌بینانه **۴۰–۶۰٪** چیزی می‌شکند (نوع‌ها، env، نسخه). برای همین test project اجباری است.

---

## هـ) Rollback (نقطهٔ شکست)
- schema: هر فایل idempotent + یک `rollback.sql` با `drop table ... cascade` به ترتیبِ معکوس.
- Edge Function: نسخهٔ قبلی در git؛ `supabase functions deploy` نسخهٔ جدید را جایگزین می‌کند، با git می‌توان برگشت.
- داده: روی production قبل از هر تغییرِ بزرگ، snapshot/backup.
- قانونِ طلایی: production فقط بعد از سبزشدنِ کاملِ test project.

---

## ترتیبِ ساخت (یادآوری)
- هفتهٔ ۱: مغزِ پایه + جدول‌ها + اولین ورک‌فلوِ مدیرنوشته (ورودی: تماس + واتساپ).
- هفتهٔ ۲: واحدِ دوم + کشفِ زنجیرهٔ علّیِ سطح‌۱/۲ (با تأیید).
- ماهِ ۲: موتورِ قانونِ پویا (rule_translate + تأییدِ انسانی) = خودرشد کامل.
