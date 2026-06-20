-- ============================================================
-- AGENT REGISTRY SEED
-- The agent army you described: content is produced 100% by agents
-- (so HR doesn't hire a content writer); sensitive actions stay "propose".
-- mode: auto = runs itself | propose = AI proposes, human approves
-- ============================================================

insert into agent (key, name, unit, mode) values
-- MARKETING / CONTENT — fully automatic content factory (your Content-OS doc)
('content_builder',   'سازندهٔ محتوا (سایت/سوشیال)',        'marketing', 'auto'),
('content_publisher', 'انتشار خودکار + تگِ درآمد',          'marketing', 'auto'),
('reel_scripter',     'سناریونویسِ ریل (۸ پیجِ سرمایه‌گذار)','marketing', 'auto'),
('seo_writer',        'نویسندهٔ سئو',                        'marketing', 'auto'),
('ceo_voice',         'محتوای صفحهٔ مدیرعامل (اتوریته)',     'marketing', 'propose'),

-- SALES — the lead engine
('lead_scorer',       'امتیازدهِ لید',                       'sales',     'auto'),
('cardex_router',     'تشخیص کارتکس + Re-route',             'sales',     'auto'),
('followup_sender',   'پیگیریِ واتساپ/ایمیل (Cadence)',      'sales',     'auto'),
('call_analyst',      'تحلیلِ صدای تماس → هشدار',            'sales',     'propose'),
('access_guard',      'بستن/بازکردنِ دسترسیِ هاب‌اسپات',     'sales',     'propose'), -- legal-sensitive

-- FINANCE
('payment_chaser',    'یادآور و تشدیدِ پرداخت (۳/۷/۱۴)',     'finance',   'auto'),
('cac_analyst',       'محاسبهٔ CAC و چراییِ افت',            'finance',   'auto'),

-- HR
('jd_writer',         'نوشتنِ آگهی + انتخابِ بهترین نسخه',   'hr',        'auto'),
('resume_screener',   'غربالِ رزومه',                        'hr',        'auto'),
('interview_inviter', 'دعوت به مصاحبه/دفتر',                 'hr',        'propose'),
('ref_checker',       'تماس با کارفرمای قبلی',               'hr',        'propose'), -- legal-sensitive

-- CEO / CROSS-UNIT
('why_analyst',       'موتورِ چرایی (بین‌واحدی)',            'ceo',       'auto'),
('exec_brief',        'خلاصهٔ روزانهٔ مدیرعامل',             'ceo',       'auto'),
('risk_radar',        'رادارِ ریسک و فرصت',                  'ceo',       'auto');
