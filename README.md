# Purity Ritual

بوابة إدارة وتشغيل متكاملة لطلبات الخدمة والعملاء وعروض الأسعار والعقود والفواتير والتحصيل، مع صلاحيات حسب دور الموظف وربط مباشر بـ Supabase.

## التشغيل المحلي

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

ثم افتح `http://localhost:5173`.

## إعداد Supabase

نفّذ ملفات SQL بالترتيب داخل Supabase SQL Editor:

1. `supabase/001_SPRINT1_CUSTOMERS_REQUESTS.sql`
2. `supabase/002_SPRINT2_QUOTATIONS.sql`
3. `supabase/003_SPRINT3_OPERATIONS_RLS.sql`

بعد إنشاء مستخدم الإدارة، نفّذ السطر التالي مع تعديل البريد:

```sql
update public.pr_profiles
set role = 'admin'
where id = (select id from auth.users where email = 'OWNER_EMAIL');
```

ضع رابط المشروع والمفتاح القابل للنشر في `.env.local`. لا تضع `service_role` في الواجهة أو المستودع.
