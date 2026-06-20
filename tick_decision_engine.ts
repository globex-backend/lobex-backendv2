// ============================================================
// GLOBEX DECISION ENGINE  (Supabase Edge Function: "tick")
// Runs on a schedule. This is the BRAIN that turns raw data
// into spoken decisions + why + costed recommendation.
// Every rule here comes straight from Persian Horizon's own
// CRM docs (SLAs, escalations, Compliance Score, payment delay).
// Nothing is invented.
// ============================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// helper: emit an event (the safety belt) + write an insight (the spoken decision)
async function speak(unit, audience, severity, headline, why, recommendation, impact, cost, eventId) {
  await db.from("insight").insert({
    unit, audience, severity, headline, why, recommendation,
    est_impact: impact ?? null, est_cost: cost ?? null, source_event_id: eventId ?? null
  });
}
async function emit(kind, unit, deal_id, payload = {}) {
  const { data } = await db.from("event").insert({ kind, unit, deal_id, payload }).select().single();
  return data?.id;
}

export default async function tick() {
  const now = Date.now();

  // ---- RULE 1: first-call SLA breach (your doc: 15min–2h) ----
  const { data: newLeads } = await db.from("deal")
    .select("*").eq("stage", "new_lead").is("last_human_contact", null);
  for (const d of newLeads ?? []) {
    const ageMin = (now - new Date(d.created_at).getTime()) / 60000;
    if (ageMin > 120) {
      const ev = await emit("sla_breached", "sales", d.id, { ageMin });
      await speak("sales", d.owner_id ?? "sales", "warning",
        `لید «${d.contact_name}» ${Math.round(ageMin/60)} ساعت بی‌تماس مانده — SLA شکست`,
        "طبق قانون شما تماس اول باید زیر ۲ ساعت باشد؛ تأخیرِ پاسخ، نرخ تبدیل را پایین می‌آورد.",
        "تماس فوری، یا روتینگ خودکار به فروشندهٔ آزاد.",
        d.amount ?? null, 0, ev);
    }
  }

  // ---- RULE 2: silent deal (your doc: Follow-up/Warm 48h, Hot 72h) ----
  const { data: live } = await db.from("deal")
    .select("*").in("stage", ["followup_active","warm","hot"]);
  for (const d of live ?? []) {
    const days = (now - new Date(d.last_human_contact ?? d.created_at).getTime()) / 86400000;
    const limit = d.stage === "hot" ? 3 : 2;
    if (days > limit) {
      const ev = await emit("silent_deal", "sales", d.id, { days, stage: d.stage });
      const toManager = d.stage === "hot";
      await speak("sales", toManager ? "manager" : (d.owner_id ?? "sales"),
        toManager ? "critical" : "warning",
        `${d.stage === "hot" ? "معاملهٔ داغ" : "لید"} «${d.contact_name}» ${Math.round(days)} روز ساکت است`,
        "سکوت در این مرحله یعنی ریسکِ از دست رفتنِ معامله؛ طبق قانونِ شما مدیر باید وارد شود.",
        toManager ? "ورود مدیر + تماس مستقیم" : "پیگیریِ فوری یا انتقال به بازچرخش.",
        d.amount ?? null, 0, ev);
    }
  }

  // ---- RULE 3: payment delay escalation (your finance doc: 3/7/14 days) ----
  const { data: signed } = await db.from("deal")
    .select("*").in("payment_status", ["delayed","critical"]);
  for (const d of signed ?? []) {
    const ev = await emit("payment_delayed", "finance", d.id, { status: d.payment_status });
    await speak("finance", "manager", d.payment_status === "critical" ? "critical" : "warning",
      `پرداختِ «${d.contact_name}» (${d.amount ?? "?"}) عقب افتاده`,
      "فروش وقتی واقعی است که پول وارد حساب شده باشد؛ تأخیرِ پرداخت، درآمدِ روی کاغذ است.",
      d.payment_status === "critical" ? "بازبینیِ مدیر ارشد + بررسی حقوقی" : "پیگیریِ پرداخت + پیام یادآوری.",
      (d.amount ?? 0) - (d.paid_amount ?? 0), 0, ev);
  }

  // ---- RULE 4: rep below KPI / Compliance (your doc: <70 warn, <50 limit, <30 review) ----
  const { data: reps } = await db.from("org_user").select("*").eq("role","sales");
  for (const u of reps ?? []) {
    if (u.compliance < 70) {
      const sev = u.compliance < 30 ? "critical" : u.compliance < 50 ? "warning" : "info";
      const rec = u.compliance < 30 ? "بازبینیِ مدیریتی؛ با ایجنت‌های فعلی این نقش قابل جایگزینی است."
                : u.compliance < 50 ? "محدودیتِ دریافتِ لید تا بهبود."
                : "اخطار + کوچینگ.";
      const ev = await emit("compliance_drop", "hr", null, { user: u.id, score: u.compliance });
      await speak("ceo", "ceo", sev,
        `${u.full_name}: امتیازِ انضباط ${u.compliance} — زیرِ KPI`,
        "ثبت‌نشدنِ کار، پیگیریِ دیرهنگام و جلسهٔ بی‌صورتجلسه امتیاز را پایین آورده.",
        rec, null, null, ev);
    }
  }

  // ---- RULE 5: CEO daily digest — the 3 things that matter (outputs only) ----
  const { data: open } = await db.from("insight")
    .select("*").eq("status","open").order("severity",{ascending:false}).limit(3);
  if ((open ?? []).length) {
    await speak("ceo","ceo","info",
      "خلاصهٔ امروزِ مدیرعامل — ۳ کارِ مهم",
      "مهم‌ترین خروجی‌های امروز، نه کلِ سیستم.",
      (open ?? []).map(i => "• " + i.headline).join("\n"),
      null, null, null);
  }

  return new Response(JSON.stringify({ ok: true, ran: new Date().toISOString() }),
    { headers: { "content-type": "application/json" } });
}
