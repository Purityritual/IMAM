"use client";

import { useMemo, useState } from "react";
import { LayoutDashboard, ClipboardList, Users, FileText, ReceiptText, WalletCards, Settings, Bell, Search, Plus, CalendarDays, MapPin, Phone, CheckCircle2, Clock3, MoreHorizontal, Menu, X, Eye, Send, Download, Filter, BadgeCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getSession, getUserId, insertRecord, signIn, signOut } from "@/lib/supabase";

const nav = [["نظرة عامة", LayoutDashboard], ["طلبات الخدمة", ClipboardList], ["العملاء", Users], ["عروض الأسعار", FileText], ["العقود", ReceiptText], ["الفواتير والتحصيل", WalletCards]] as const;
type Role = "المدير العام" | "المبيعات" | "مشرف العمليات" | "المحاسب";
const permissions: Record<Role, { sections: string[]; create: string[]; export: boolean }> = {
  "المدير العام": { sections: nav.map(([n]) => n), create: nav.map(([n]) => n), export: true },
  "المبيعات": { sections: ["نظرة عامة", "طلبات الخدمة", "العملاء", "عروض الأسعار"], create: ["طلبات الخدمة", "العملاء", "عروض الأسعار"], export: false },
  "مشرف العمليات": { sections: ["نظرة عامة", "طلبات الخدمة", "العملاء"], create: ["طلبات الخدمة"], export: false },
  "المحاسب": { sections: ["نظرة عامة", "العملاء", "العقود", "الفواتير والتحصيل"], create: ["الفواتير والتحصيل"], export: true },
};
const requests = [
  ["PR-REQ-2026-0012", "شركة أفق الأعمال — تنظيف مكاتب دوري", "جدة - الشاطئ", "معاينة اليوم", "عرض"],
  ["PR-REQ-2026-0011", "سارة أحمد — تنظيف عميق لفيلا", "جدة - المحمدية", "بانتظار التسعير", "عرض"],
  ["PR-REQ-2026-0010", "معرض لوميير — تلميع أرضيات", "جدة - الروضة", "عرض مرسل", "عرض"],
  ["PR-REQ-2026-0009", "محمد السالم — تنظيف بعد التشطيب", "جدة - أبحر", "قيد التنفيذ", "عرض"],
];
const info: Record<string, { note: string; action: string; columns: string[] }> = {
  "طلبات الخدمة": { note: "متابعة الطلب من الاستلام والمعاينة حتى التنفيذ", action: "طلب جديد", columns: ["رقم الطلب", "العميل والخدمة", "الموقع", "الحالة", "الإجراء"] },
  "العملاء": { note: "ملفات العملاء وسجل الطلبات والتواصل", action: "إضافة عميل", columns: ["العميل", "رقم الجوال", "آخر خدمة", "الرصيد", "الإجراء"] },
  "عروض الأسعار": { note: "إعداد العروض وإرسالها واعتمادها إلكترونيًا", action: "عرض سعر جديد", columns: ["رقم العرض", "العميل", "القيمة", "الحالة", "الإجراء"] },
  "العقود": { note: "العقود النشطة والتجديدات والتوقيع", action: "عقد جديد", columns: ["رقم العقد", "العميل", "المدة", "القيمة", "الحالة"] },
  "الفواتير والتحصيل": { note: "الفواتير المستحقة والمدفوعات والإيصالات", action: "فاتورة جديدة", columns: ["رقم الفاتورة", "العميل", "الاستحقاق", "القيمة", "الحالة"] },
};

export default function Home() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("نظرة عامة");
  const [mode, setMode] = useState<"admin" | "customer">("admin");
  const [role, setRole] = useState<Role>("المدير العام");
  const [notice, setNotice] = useState("");
  const [formType, setFormType] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [connected, setConnected] = useState(() => Boolean(getSession()));
  const permit = permissions[role];
  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2200); };
  const changeRole = (next: Role) => { setRole(next); setMode("admin"); if (!permissions[next].sections.includes(active)) setActive("نظرة عامة"); notify(`تم تطبيق صلاحيات: ${next}`); };
  return <div className="shell" dir="rtl">
    <aside className={open ? "side open" : "side"}>
      <div className="brand"><img src="/brand/logo.png" alt="شعار Purity Ritual"/><div className="brandname"><strong>Purity</strong><span>Ritual</span></div><button onClick={() => setOpen(false)} aria-label="إغلاق القائمة"><X/></button></div>
      <div className="workspace"><span>مساحة العمل</span><strong>Purity Ritual</strong><small>{role}</small></div>
      <nav>{nav.filter(([name]) => permit.sections.includes(name)).map(([name, Icon]) => <button key={name} className={active === name ? "active" : ""} onClick={() => { setActive(name); setMode("admin"); setOpen(false); }}><Icon/><span>{name}</span>{name === "طلبات الخدمة" && <b>4</b>}</button>)}</nav>
      <div className="sidefoot">{role === "المدير العام" && <button><Settings/><span>الإعدادات والصلاحيات</span></button>}<div className="profile"><i>م ن</i><div><strong>مجدي النعيم</strong><small>{role}</small></div><MoreHorizontal/></div></div>
    </aside>
    <main><header className="top"><button className="menub" onClick={() => setOpen(true)} aria-label="فتح القائمة"><Menu/></button><div className="search"><Search/><input placeholder="ابحث عن عميل، طلب، أو فاتورة..." aria-label="البحث"/></div><div className="topactions"><label className="rolePicker"><span>اختبار الصلاحية</span><select value={role} onChange={e => changeRole(e.target.value as Role)}>{Object.keys(permissions).map(name => <option key={name}>{name}</option>)}</select></label><button className="bell" aria-label="الإشعارات"><Bell/><i/></button><div className="switch"><button className={mode === "admin" ? "selected" : ""} onClick={() => setMode("admin")}>الإدارة</button><button className={mode === "customer" ? "selected" : ""} onClick={() => setMode("customer")}>معاينة العميل</button></div></div></header>
      {mode === "customer" ? <Customer notify={notify} onCreate={() => setFormType("طلب خدمة")}/> : active === "نظرة عامة" ? <Dashboard notify={notify} canCreate={permit.create.includes("طلبات الخدمة")} onCreate={() => setFormType("طلب خدمة")}/> : <Management section={active} notify={notify} canCreate={permit.create.includes(active)} canExport={permit.export} onCreate={() => setFormType(info[active].action)}/>} 
      {notice && <div className="toast"><BadgeCheck/>{notice}</div>}
      <button className={`dbStatus ${connected ? "online" : ""}`} onClick={() => setLoginOpen(true)}>{connected ? "Supabase متصل" : "ربط Supabase"}</button>
      <DatabaseLogin open={loginOpen} connected={connected} onClose={() => setLoginOpen(false)} onConnected={() => { setConnected(true); setLoginOpen(false); notify("تم الاتصال بقاعدة البيانات"); }} onDisconnected={() => { setConnected(false); setLoginOpen(false); notify("تم تسجيل الخروج"); }}/>
      <CreateForm type={formType} onClose={() => setFormType(null)} onNeedLogin={() => setLoginOpen(true)} onSaved={(label) => { setFormType(null); notify(`تم حفظ ${label} في Supabase بنجاح`); }}/>
    </main>
  </div>;
}

function Dashboard({ notify, canCreate, onCreate }: { notify: (m: string) => void; canCreate: boolean; onCreate: () => void }) {
  return <div className="page"><section className="pagehead"><div><p>الأربعاء، 9 سبتمبر 2026</p><h1>صباح الخير، مجدي</h1><span>هذه خلاصة أعمال Purity Ritual اليوم.</span></div>{canCreate && <button className="primary" onClick={onCreate}><Plus/>طلب خدمة جديد</button>}</section>
    <section className="stats"><Stat label="طلبات جديدة" value="12" note="+18% هذا الشهر" icon={<ClipboardList/>}/><Stat label="معاينات اليوم" value="4" note="التالي 11:30 ص" icon={<CalendarDays/>}/><Stat label="عروض بانتظار الرد" value="7" note="بقيمة 28,450 ر.س" icon={<FileText/>}/><Stat label="تحصيل هذا الشهر" value="86,320" note="72% من المستهدف" icon={<WalletCards/>}/></section>
    <section className="grid"><div className="panel"><h2>أحدث طلبات الخدمة</h2><DataTable columns={["الطلب", "العميل والخدمة", "الموقع", "الحالة", "الإجراء"]} rows={requests} notify={notify}/></div><aside className="panel today"><h2>جدول اليوم</h2><Visit t="09:00" title="معاينة فيلا" client="سارة أحمد - المحمدية"/><Visit t="11:30" title="فحص موقع دوري" client="شركة أفق الأعمال - الشاطئ"/><Visit t="14:00" title="تسليم أعمال" client="معرض لوميير - الروضة"/></aside></section>
    <section className="insight"><div><span>ملخص الأداء</span><h2>جودة أعلى، متابعة أوضح.</h2><p>تم إغلاق 94% من طلبات هذا الشهر في الموعد، ومتوسط تقييم العملاء 4.8 من 5.</p><div className="kpis"><div><b>94%</b><small>التزام بالمواعيد</small></div><div><b>4.8</b><small>رضا العملاء</small></div><div><b>3.2 يوم</b><small>متوسط الإنجاز</small></div></div></div><img src="/brand/hero-professional.png" alt="موظفة Purity Ritual بالزي المعتمد"/></section>
  </div>;
}

function Management({ section, notify, canCreate, canExport, onCreate }: { section: string; notify: (m: string) => void; canCreate: boolean; canExport: boolean; onCreate: () => void }) {
  const [filter, setFilter] = useState("الكل");
  const rows = useMemo(() => getRows(section), [section]);
  return <div className="page management"><section className="pagehead managementhead"><div><p>إدارة العمليات</p><h1>{section}</h1><span>{info[section].note}</span></div>{canCreate ? <button className="primary" onClick={onCreate}><Plus/>{info[section].action}</button> : <span className="readOnly">صلاحية عرض فقط</span>}</section>
    <section className="miniStats"><Mini label="الإجمالي" value={String(rows.length)} icon={<ClipboardList/>}/><Mini label="بانتظار إجراء" value="2" icon={<Clock3/>}/><Mini label="مكتمل هذا الشهر" value="18" icon={<CheckCircle2/>}/></section>
    <section className="panel dataPanel"><div className="dataTools"><div className="filters"><Filter/>{["الكل", "جديد", "قيد التنفيذ", "مكتمل"].map(item => <button key={item} className={filter === item ? "chosen" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div>{canExport && <div className="export"><button onClick={() => notify("تم السماح بتصدير البيانات")}><Download/>تصدير</button></div>}</div><DataTable columns={info[section].columns} rows={rows} notify={notify}/></section>
  </div>;
}

function DataTable({ columns, rows, notify }: { columns: string[]; rows: string[][]; notify: (m: string) => void }) { return <div className="tablewrap"><table className="managementTable"><thead><tr>{columns.map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>{rows.map((row, ri) => <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{ci === row.length - 1 && ["عرض", "إرسال"].includes(cell) ? <button className="rowAction" onClick={() => notify(cell === "إرسال" ? "تم تجهيز العرض للإرسال" : "تم فتح التفاصيل")}>{cell === "إرسال" ? <Send/> : <Eye/>}{cell}</button> : <span className={cell.includes("مستحق") ? "due" : ""}>{cell}</span>}</td>)}</tr>)}</tbody></table></div>; }

function getRows(section: string): string[][] {
  if (section === "طلبات الخدمة") return requests;
  if (section === "العملاء") return [["شركة أفق الأعمال", "055 982 1470", "تنظيف مكاتب دوري", "0 ر.س", "عرض"], ["سارة أحمد", "055 421 8860", "تنظيف عميق لفيلا", "2,875 ر.س", "عرض"], ["معرض لوميير", "050 773 2190", "تلميع أرضيات", "7,250 ر.س", "عرض"]];
  if (section === "عروض الأسعار") return [["PR-Q-2026-0007", "سارة أحمد", "2,875 ر.س", "بانتظار الاعتماد", "إرسال"], ["PR-Q-2026-0006", "معرض لوميير", "7,250 ر.س", "تم الإرسال", "عرض"], ["PR-Q-2026-0005", "شركة أفق الأعمال", "4,600 ر.س", "معتمد", "عرض"]];
  if (section === "العقود") return [["PR-C-2026-0011", "شركة أفق الأعمال", "12 شهرًا", "55,200 ر.س", "نشط"], ["PR-C-2026-0010", "معرض لوميير", "6 أشهر", "43,500 ر.س", "بانتظار التوقيع"], ["PR-C-2026-0009", "مجمع عيادات الروضة", "12 شهرًا", "78,000 ر.س", "نشط"]];
  return [["PR-INV-2026-0042", "شركة أفق الأعمال", "15 سبتمبر 2026", "4,600 ر.س", "مستحق"], ["PR-INV-2026-0041", "معرض لوميير", "10 سبتمبر 2026", "7,250 ر.س", "مستحق اليوم"], ["PR-INV-2026-0040", "محمد السالم", "5 سبتمبر 2026", "5,900 ر.س", "مدفوع"]];
}

function Customer({ notify, onCreate }: { notify: (m: string) => void; onCreate: () => void }) { return <div className="page customer"><section className="customerhero"><div><span>بوابة العميل</span><h1>أهلًا بك في Purity Ritual</h1><p>تابع طلباتك، اعتمد عروض الأسعار، واطّلع على الفواتير من مكان واحد.</p><button className="primary" onClick={onCreate}><Plus/>اطلب خدمة</button></div><img src="/brand/hero-professional.png" alt="موظفة Purity Ritual بالزي المعتمد"/></section><section className="customercards"><article><Clock3/><span>طلبك الحالي</span><h3>تنظيف عميق للفيلا</h3><p>تم تحديد المعاينة غدًا الساعة 11:30 صباحًا.</p><button onClick={() => notify("تم فتح تفاصيل الطلب")}>عرض التفاصيل</button></article><article><FileText/><span>عرض سعر جديد</span><h3>PR-Q-2026-0007</h3><p>الإجمالي شامل الضريبة: <b>2,875 ر.س</b></p><button onClick={() => notify("تم فتح عرض السعر")}>مراجعة واعتماد</button></article><article><CheckCircle2/><span>آخر خدمة مكتملة</span><h3>تلميع الأرضيات</h3><p>اكتملت في 2 سبتمبر 2026.</p><button onClick={() => notify("تم فتح تقييم الخدمة")}>تقييم الخدمة</button></article></section></div>; }

function CreateForm({ type, onClose, onSaved, onNeedLogin }: { type: string | null; onClose: () => void; onSaved: (label: string) => void; onNeedLogin: () => void }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!type) return;
    if (!getSession()) { onNeedLogin(); return; }
    setSaving(true); setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>;
    const userId = getUserId();
    const amount = Number(String(data.value || "0").replace(/,/g, "")) || 0;
    const record = type === "إضافة عميل"
      ? { table: "pr_customers", payload: { full_name: data.client, phone: data.phone, address: data.value, notes: data.notes, created_by: userId } }
      : type === "طلب خدمة"
        ? { table: "pr_service_requests", payload: { customer_name: data.client, customer_phone: data.phone, service_type: data.service, city: "جدة", address: data.value, notes: data.notes, created_by: userId } }
        : type === "عرض سعر جديد"
          ? { table: "pr_quotations", payload: { customer_name: data.client, scope: data.service, subtotal: amount, vat_amount: amount * .15, total: amount * 1.15, created_by: userId } }
          : type === "عقد جديد"
            ? { table: "pr_contracts", payload: { customer_name: data.client, phone: data.phone, service: data.service, duration: data.notes, value: amount, notes: data.notes, created_by: userId } }
            : { table: "pr_invoices", payload: { customer_name: data.client, phone: data.phone, description: data.service, subtotal: amount, notes: data.notes, created_by: userId } };
    try { await insertRecord(record.table, record.payload); onSaved(type); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "تعذر الحفظ"); }
    finally { setSaving(false); }
  };
  const isClient = type === "إضافة عميل";
  return <Dialog open={Boolean(type)} onOpenChange={open => !open && onClose()}><DialogContent dir="rtl" className="createDialog"><DialogHeader><DialogTitle>{type}</DialogTitle><DialogDescription>أدخل البيانات المطلوبة، وسيتم حفظها مباشرة في Supabase.</DialogDescription></DialogHeader><form className="createForm" onSubmit={save}>
    <label><span>{isClient ? "اسم العميل" : "العميل"}</span><input name="client" required placeholder="اكتب اسم العميل"/></label>
    <div className="formGrid"><label><span>رقم الجوال</span><input name="phone" required inputMode="tel" placeholder="05xxxxxxxx"/></label><label><span>{type === "فاتورة جديدة" || type === "عرض سعر جديد" || type === "عقد جديد" ? "القيمة (ر.س)" : "الحي / الموقع"}</span><input name="value" required placeholder={type === "طلب خدمة" ? "جدة - الحي" : "0.00"}/></label></div>
    {!isClient && <label><span>{type === "عقد جديد" ? "مدة العقد" : "الخدمة / البيان"}</span><select name="service" required><option value="">اختر</option><option>تنظيف منازل</option><option>تنظيف مكاتب</option><option>تنظيف بعد التشطيب</option><option>تلميع أرضيات</option><option>عقد نظافة دوري</option></select></label>}
    <label><span>ملاحظات</span><textarea name="notes" rows={3} placeholder="أي تفاصيل إضافية"/></label>
    {error && <p className="formError">{error}</p>}
    <div className="formActions"><button type="button" className="cancel" onClick={onClose}>إلغاء</button><button type="submit" className="primary" disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ"}</button></div>
  </form></DialogContent></Dialog>;
}

function DatabaseLogin({ open, connected, onClose, onConnected, onDisconnected }: { open: boolean; connected: boolean; onClose: () => void; onConnected: () => void; onDisconnected: () => void }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setLoading(true); setError("");
    const data = new FormData(event.currentTarget);
    try { await signIn(String(data.get("email")), String(data.get("password"))); onConnected(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "فشل تسجيل الدخول"); }
    finally { setLoading(false); }
  };
  return <Dialog open={open} onOpenChange={value => !value && onClose()}><DialogContent dir="rtl" className="createDialog"><DialogHeader><DialogTitle>اتصال Supabase</DialogTitle><DialogDescription>{connected ? "قاعدة البيانات متصلة بحساب موظف معتمد." : "سجّل الدخول بحساب الموظف الموجود في Supabase."}</DialogDescription></DialogHeader>{connected ? <div className="formActions"><button className="cancel" onClick={() => { signOut(); onDisconnected(); }}>تسجيل الخروج</button><button className="primary" onClick={onClose}>تم</button></div> : <form className="createForm" onSubmit={submit}><label><span>البريد الإلكتروني</span><input name="email" type="email" required/></label><label><span>كلمة المرور</span><input name="password" type="password" minLength={8} required/></label>{error && <p className="formError">{error}</p>}<button className="primary" disabled={loading}>{loading ? "جاري الاتصال..." : "دخول"}</button></form>}</DialogContent></Dialog>;
}

function Stat({ label, value, note, icon }: { label: string; value: string; note: string; icon: React.ReactNode }) { return <article className="stat"><div>{icon}</div><span>{label}</span><h3>{value}</h3><p>{note}</p></article>; }
function Mini({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) { return <article><i>{icon}</i><div><span>{label}</span><b>{value}</b></div></article>; }
function Visit({ t, title, client }: { t: string; title: string; client: string }) { return <div className="visit"><time>{t}</time><i/><div><strong>{title}</strong><span>{client}</span><button><Phone/>تواصل</button></div></div>; }
