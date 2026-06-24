import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY")!;
const INTERNAL_DISPATCH_SECRET = Deno.env.get("INTERNAL_DISPATCH_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  const authHeader = req.headers.get("x-dispatch-secret");
  if (authHeader !== INTERNAL_DISPATCH_SECRET) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  let body: { to: string; subject: string; html: string; from?: string; entity_id?: string };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON body" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const { to, subject, html, from = "noreply@globexhorizon.com", entity_id } = body;
  if (!to || !subject || !html) {
    return new Response(JSON.stringify({ ok: false, error: "Missing required fields: to, subject, html" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const sgResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { "Authorization": `Bearer ${SENDGRID_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from },
      subject,
      content: [{ type: "text/html", value: html }],
    }),
  });

  if (!sgResponse.ok) {
    const errText = await sgResponse.text();
    return new Response(JSON.stringify({ ok: false, error: `SendGrid error: ${errText}` }), { status: 502, headers: { "Content-Type": "application/json" } });
  }

  if (entity_id) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await supabase.from("entity").update({
      attributes: { last_email_sent: new Date().toISOString(), last_email_subject: subject, last_email_to: to },
      status: "email_sent",
    }).eq("id", entity_id);
  }

  return new Response(JSON.stringify({ ok: true, data: { message: "Email sent successfully", to, subject, timestamp: new Date().toISOString() } }), { status: 200, headers: { "Content-Type": "application/json" } });
});
