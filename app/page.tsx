"use client";

import { useEffect, useMemo, useState } from "react";
import { LayoutDashboard, ClipboardList, Users, FileText, ReceiptText, WalletCards, Settings, Bell, Search, Plus, CalendarDays, MapPin, Phone, CheckCircle2, Clock3, MoreHorizontal, Menu, X, Eye, Send, Download, Filter, BadgeCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { callRpc, createEmployeeAccount, getSession, getUserId, insertPublicRecord, insertRecord, selectRecords, signIn, signOut, signUp, updateRecord } from "@/lib/supabase";

const nav = [["نظرة عامة", LayoutDashboard], ["دورة التشغيل", CalendarDays], ["مهامي", CheckCircle2], ["طلبات الخدمة", ClipboardList], ["العملاء", Users], ["عروض الأسعار", FileText], ["العقود", ReceiptText], ["الفواتير والتحصيل", WalletCards], ["الموظفون والصلاحيات", Settings]] as const;
type Role = "السوبر أدمن" | "المدير العام" | "مدير العمليات" | "المبيعات" | "مشرف العمليات" | "المحاسب";
const permissions: Record<Role, { sections: string[]; create: string[]; export: boolean }> = {
  "السوبر أدمن": { sections: nav.map(([n]) => n), create: nav.map(([n]) => n), export: true },
  "المدير العام": { sections: nav.filter(([n]) => n !== "الموظفون والصلاحيات").map(([n]) => n), create: ["طلبات الخدمة", "العملاء", "عروض الأسعار", "العقود", "الفواتير والتحصيل"], export: true },
  "مدير العمليات": { sections: ["نظرة عامة", "دورة التشغيل", "مهامي", "طلبات الخدمة", "العملاء"], create: ["طلبات الخدمة"], export: false },
  "المبيعات": { sections: ["نظرة عامة", "مهامي", "طلبات الخدمة", "العملاء", "عروض الأسعار"], create: ["طلبات الخدمة", "العملاء", "عروض الأسعار"], export: false },
  "مشرف العمليات": { sections: ["نظرة عامة", "دورة التشغيل", "مهامي", "طلبات الخدمة", "العملاء"], create: ["طلبات الخدمة"], export: false },
  "المحاسب": { sections: ["نظرة عامة", "مهامي", "العملاء", "العقود", "الفواتير والتحصيل"], create: ["الفواتير والتحصيل"], export: true },
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
  const [role, setRole] = useState<Role>("السوبر أدمن");
  const [notice, setNotice] = useState("");
  const [formType, setFormType] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  // Keep the first server and browser render identical; restore the saved session after mount.
  const [connected, setConnected] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [accountKind, setAccountKind] = useState<"loading" | "staff" | "customer">("loading");
  const [profileName, setProfileName] = useState("المستخدم");
  const [assignedSections, setAssignedSections] = useState<string[]>([]);
  const [customerRefresh, setCustomerRefresh] = useState(0);
  const basePermit = permissions[role];
  const permit = role === "السوبر أدمن" || !assignedSections.length ? basePermit : { ...basePermit, sections: ["نظرة عامة", "مهامي", ...assignedSections.filter(x => !["نظرة عامة", "مهامي", "الموظفون والصلاحيات"].includes(x))] };
  useEffect(() => {
    setConnected(Boolean(getSession()));
    setSessionChecked(true);
  }, []);
  useEffect(() => {
    if (!connected) return;
    const id = getUserId();
    if (!id) return;
    selectRecords("pr_profiles", `id=eq.${id}&select=role,full_name,permissions,is_active`).then(rows => {
      const dbRole = String(rows[0]?.role || "");
      if (rows[0]?.is_active === false) { signOut(); setConnected(false); return; }
      setProfileName(String(rows[0]?.full_name || "المستخدم"));
      setAssignedSections(Array.isArray(rows[0]?.permissions) ? rows[0].permissions as string[] : []);
      const roleMap: Record<string, Role> = { super_admin: "السوبر أدمن", admin: "المدير العام", manager: "مدير العمليات", sales: "المبيعات", operations: "مشرف العمليات", accountant: "المحاسب" };
      if (roleMap[dbRole]) { setRole(roleMap[dbRole]); setAccountKind("staff"); }
      else setAccountKind("customer");
    }).catch(() => setAccountKind("customer"));
  }, [connected]);
  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2200); };
  if (!sessionChecked) return <div className="authLoading" dir="rtl"><img src="/brand/logo.png" alt="Purity Ritual"/><span>جاري تحميل النظام...</span></div>;
  if (!connected) return <PublicHome onConnected={() => { setConnected(true); setAccountKind("loading"); }}/>;
  if (accountKind === "loading") return <div className="authLoading" dir="rtl"><img src="/brand/logo.png" alt="Purity Ritual"/><span>جاري تجهيز حسابك...</span></div>;
  if (accountKind === "customer") return <div className="customerOnly" dir="rtl"><header><img src="/brand/logo.png" alt="Purity Ritual"/><strong>بوابة العميل</strong><button onClick={() => { signOut(); setConnected(false); }}>تسجيل الخروج</button></header><Customer key={customerRefresh} notify={notify} onCreate={() => setFormType("طلب خدمة")}/>{notice && <div className="toast"><BadgeCheck/>{notice}</div>}<CreateForm type={formType} onClose={() => setFormType(null)} onNeedLogin={() => undefined} onSaved={(label) => { setFormType(null); setCustomerRefresh(v=>v+1); notify(`تم إرسال ${label} بنجاح`); }}/></div>;
  return <div className="shell" dir="rtl">
    <aside className={open ? "side open" : "side"}>
      <div className="brand"><img src="/brand/logo.png" alt="شعار Purity Ritual"/><div className="brandname"><strong>Purity</strong><span>Ritual</span></div><button onClick={() => setOpen(false)} aria-label="إغلاق القائمة"><X/></button></div>
      <div className="workspace"><span>مساحة الإدارة</span><strong>Purity Ritual</strong><small>{role}</small></div>
      <nav>{nav.filter(([name]) => permit.sections.includes(name)).map(([name, Icon]) => <button key={name} className={active === name ? "active" : ""} onClick={() => { setActive(name); setMode("admin"); setOpen(false); }}><Icon/><span>{name}</span>{name === "طلبات الخدمة" && <b>4</b>}</button>)}</nav>
      <div className="sidefoot"><div className="profile"><i>{profileName.slice(0,1)}</i><div><strong>{profileName}</strong><small>{role}</small></div><MoreHorizontal/></div></div>
    </aside>
    <main><header className="top"><button className="menub" onClick={() => setOpen(true)} aria-label="فتح القائمة"><Menu/></button><div className="search"><Search/><input placeholder="ابحث عن عميل، طلب، أو فاتورة..." aria-label="البحث"/></div><div className="topactions"><button className="bell" aria-label="الإشعارات"><Bell/><i/></button><button className="accountButton" onClick={() => setLoginOpen(true)}>{role}</button></div></header>
      {mode === "customer" ? <Customer notify={notify} onCreate={() => setFormType("طلب خدمة")}/> : active === "نظرة عامة" ? <Dashboard notify={notify} canCreate={permit.create.includes("طلبات الخدمة")} onCreate={() => setFormType("طلب خدمة")}/> : active === "دورة التشغيل" ? <WorkflowBoard notify={notify}/> : active === "مهامي" ? <EmployeeTasks notify={notify}/> : active === "الموظفون والصلاحيات" ? <EmployeesPermissions notify={notify}/> : <Management section={active} connected={connected} notify={notify} canCreate={permit.create.includes(active)} canExport={permit.export} onCreate={() => setFormType(info[active].action)} onRecordPayment={() => setFormType("تسجيل دفعة")}/>} 
      {notice && <div className="toast"><BadgeCheck/>{notice}</div>}
      <DatabaseLogin open={loginOpen} connected={connected} onClose={() => setLoginOpen(false)} onConnected={() => { setConnected(true); setLoginOpen(false); notify("تم تسجيل الدخول"); }} onDisconnected={() => { setConnected(false); setLoginOpen(false); notify("تم تسجيل الخروج"); }}/>
      <CreateForm type={formType} onClose={() => setFormType(null)} onNeedLogin={() => setLoginOpen(true)} onSaved={(label) => { setFormType(null); notify(`تم حفظ ${label} بنجاح`); }}/>
    </main>
  </div>;
}

function Dashboard({ notify, canCreate, onCreate }: { notify: (m: string) => void; canCreate: boolean; onCreate: () => void }) {
  return <div className="page"><section className="pagehead"><div><p>الأربعاء، 9 سبتمبر 2026</p><h1>صباح الخير، مجدي</h1><span>هذه خلاصة أعمال Purity Ritual اليوم.</span></div>{canCreate && <button className="primary" onClick={onCreate}><Plus/>طلب خدمة جديد</button>}</section>
    <section className="stats"><Stat label="طلبات جديدة" value="12" note="+18% هذا الشهر" icon={<ClipboardList/>}/><Stat label="معاينات اليوم" value="4" note="التالي 11:30 ص" icon={<CalendarDays/>}/><Stat label="عروض بانتظار الرد" value="7" note="بقيمة 28,450 ر.س" icon={<FileText/>}/><Stat label="تحصيل هذا الشهر" value="86,320" note="72% من المستهدف" icon={<WalletCards/>}/></section>
    <section className="grid"><div className="panel"><h2>أحدث طلبات الخدمة</h2><DataTable columns={["الطلب", "العميل والخدمة", "الموقع", "الحالة", "الإجراء"]} rows={requests} notify={notify}/></div><aside className="panel today"><h2>جدول اليوم</h2><Visit t="09:00" title="معاينة فيلا" client="سارة أحمد - المحمدية"/><Visit t="11:30" title="فحص موقع دوري" client="شركة أفق الأعمال - الشاطئ"/><Visit t="14:00" title="تسليم أعمال" client="معرض لوميير - الروضة"/></aside></section>
    <section className="insight"><div><span>فريق العمل</span><h2>فريق موحّد، جودة ثابتة.</h2><p>موظفون وموظفات بزي Purity Ritual المعتمد لتنفيذ الخدمات باحترافية وأمان.</p><div className="kpis"><div><b>94%</b><small>التزام بالمواعيد</small></div><div><b>4.8</b><small>رضا العملاء</small></div><div><b>3.2 يوم</b><small>متوسط الإنجاز</small></div></div></div><img src="/brand/team-professional.png" alt="فريق Purity Ritual من الرجال والنساء بالزي المعتمد"/></section>
  </div>;
}

const workflowLabels: Record<string,string> = { new:"طلب جديد",reviewing:"قيد المراجعة",quoted:"بانتظار اعتماد العرض",approved:"عرض معتمد",scheduled:"تم إسناد الفريق",in_progress:"قيد التنفيذ",completed:"مكتملة",cancelled:"ملغاة" };

function WorkflowBoard({ notify }: { notify: (m: string) => void }) {
  const [items,setItems] = useState<Record<string,unknown>[]>([]);
  const [employees,setEmployees] = useState<Record<string,unknown>[]>([]);
  const [amounts,setAmounts] = useState<Record<string,string>>({});
  const [assignees,setAssignees] = useState<Record<string,string>>({});
  const [loading,setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    try {
      const [requestsData,staffData] = await Promise.all([
        selectRecords("pr_service_requests","select=*&order=created_at.desc&limit=100"),
        selectRecords("pr_profiles","role=in.(manager,sales,operations)&is_active=eq.true&select=id,full_name,job_title,role")
      ]);
      setItems(requestsData); setEmployees(staffData);
    } catch(e) { notify(e instanceof Error ? e.message : "تعذر تحميل دورة التشغيل"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const action = async (requestId:string,actionName:string) => {
    try {
      await callRpc("pr_admin_workflow",{ p_request_id:requestId,p_action:actionName,p_amount:amounts[requestId] ? Number(amounts[requestId]) : null,p_employee_id:assignees[requestId] || null,p_note:null });
      notify(actionName==="quote" ? "تم إصدار عرض السعر وإرساله للعميل" : actionName==="invoice" ? "تم إصدار الفاتورة" : "تم تحديث مرحلة الخدمة");
      await load();
    } catch(e) { notify(e instanceof Error ? e.message : "تعذر تنفيذ الإجراء"); }
  };
  return <div className="page management"><section className="pagehead"><div><p>من الطلب حتى التحصيل</p><h1>دورة تشغيل الخدمة</h1><span>متابعة العميل والفريق والعرض والتنفيذ والفاتورة في مسار واحد.</span></div></section>
    <section className="workflowSteps">{["طلب جديد","مراجعة","عرض سعر","اعتماد العميل","إسناد موظف","تنفيذ","فاتورة وتحصيل"].map((x,i)=><div key={x}><b>{i+1}</b><span>{x}</span></div>)}</section>
    {loading ? <div className="emptyState">جاري تحميل الطلبات...</div> : !items.length ? <div className="emptyState">لا توجد طلبات خدمة بعد</div> : <section className="workflowList">{items.map(r => { const id=String(r.id); const status=String(r.status||"new"); return <article className="workflowCard" key={id}><header><div><small>{String(r.request_no||"طلب")}</small><h3>{String(r.customer_name||"عميل")} — {String(r.service_type||"خدمة")}</h3><p>{String(r.address||r.city||"جدة")}</p></div><span className={"stage "+status}>{workflowLabels[status]||status}</span></header><div className="workflowActions">
      {status==="new" && <button onClick={()=>action(id,"review")}>بدء المراجعة</button>}
      {status==="reviewing" && <><label><span>السعر قبل الضريبة</span><input type="number" min="1" value={amounts[id]||""} onChange={e=>setAmounts({...amounts,[id]:e.target.value})}/></label><button onClick={()=>action(id,"quote")}>إصدار وإرسال العرض</button></>}
      {status==="quoted" && <em>بانتظار اعتماد العميل من بوابته</em>}
      {status==="approved" && <><label><span>الموظف المسؤول</span><select value={assignees[id]||""} onChange={e=>setAssignees({...assignees,[id]:e.target.value})}><option value="">اختر الموظف</option>{employees.map(e=><option key={String(e.id)} value={String(e.id)}>{String(e.full_name||"موظف")} — {String(e.job_title||roleArabic(String(e.role)))}</option>)}</select></label><button onClick={()=>action(id,"assign")}>إسناد وجدولة</button></>}
      {status==="scheduled" && <button onClick={()=>action(id,"start")}>بدء التنفيذ</button>}
      {status==="in_progress" && <button onClick={()=>action(id,"complete")}>إنهاء الخدمة</button>}
      {status==="completed" && <><label><span>قيمة الفاتورة قبل الضريبة</span><input type="number" min="1" value={amounts[id]||String(Number(r.quoted_total||0)/1.15||"")} onChange={e=>setAmounts({...amounts,[id]:e.target.value})}/></label><button onClick={()=>action(id,"invoice")}>إصدار الفاتورة</button></>}
    </div></article>; })}</section>}
  </div>;
}

function EmployeeTasks({ notify }: { notify: (m: string) => void }) {
  const [tasks, setTasks] = useState<Record<string, unknown>[]>([]);
  const [state, setState] = useState("جاري تحميل المهام...");
  const load = () => selectRecords("pr_employee_tasks", "select=*&order=created_at.desc").then(rows => { setTasks(rows); setState(rows.length ? "" : "لا توجد مهام مسندة إليك حاليًا"); }).catch(e => setState(e instanceof Error ? e.message : "تعذر تحميل المهام"));
  useEffect(() => { void load(); }, []);
  const setTaskStatus = async (id: string,status:string) => { try { await updateRecord("pr_employee_tasks", id, { status, updated_at: new Date().toISOString() }); notify(status==="completed"?"تم إنهاء المهمة":"تم بدء المهمة"); load(); } catch (e) { notify(e instanceof Error ? e.message : "تعذر تحديث المهمة"); } };
  return <div className="page management"><section className="pagehead"><div><p>مساحة الموظف</p><h1>مهامي</h1><span>ابدأ المهمة، تابع تنفيذها، ثم أكد الإنهاء.</span></div></section><section className="taskGrid">{tasks.map(t => <article className="taskCard" key={String(t.id)}><div><span className={`priority ${t.priority}`}>{t.priority === "urgent" ? "عاجلة" : t.priority === "high" ? "مرتفعة" : "عادية"}</span><small>{String(t.due_date || "بدون تاريخ")}</small></div><h3>{String(t.title)}</h3><p>{String(t.description || "لا توجد تفاصيل إضافية")}</p><footer><b>{t.status === "completed" ? "مكتملة" : t.status === "in_progress" ? "قيد التنفيذ" : "جديدة"}</b>{t.status==="new"?<button onClick={() => setTaskStatus(String(t.id),"in_progress")}>بدء المهمة</button>:t.status==="in_progress"?<button onClick={() => setTaskStatus(String(t.id),"completed")}>إنهاء المهمة</button>:null}</footer></article>)}</section>{state && <div className="emptyState">{state}</div>}</div>;
}

function EmployeesPermissions({ notify }: { notify: (m: string) => void }) {
  const sectionChoices = ["دورة التشغيل", "طلبات الخدمة", "العملاء", "عروض الأسعار", "العقود", "الفواتير والتحصيل"];
  const [staff, setStaff] = useState<Record<string, unknown>[]>([]);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [taskEmployee, setTaskEmployee] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const load = () => callRpc("pr_list_employees").then(setStaff).catch(e => notify(e instanceof Error ? e.message : "تعذر تحميل الموظفين"));
  useEffect(() => { void load(); }, []);
  const savePermissions = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!selected) return; const data = new FormData(event.currentTarget); try { await callRpc("pr_set_employee_access", { target_id: selected.id, new_role: data.get("role"), new_job_title: data.get("job_title"), new_permissions: data.getAll("permissions"), new_is_active: data.get("is_active") === "on" }); notify("تم تفعيل صلاحيات الموظف"); setSelected(null); load(); } catch (e) { notify(e instanceof Error ? e.message : "تعذر حفظ الصلاحيات"); } };
  const addTask = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); try { await insertRecord("pr_employee_tasks", { employee_id: taskEmployee, title: data.get("title"), description: data.get("description"), due_date: data.get("due_date") || null, priority: data.get("priority"), created_by: getUserId() }); notify("تم إسناد المهمة للموظف"); setTaskEmployee(""); } catch (e) { notify(e instanceof Error ? e.message : "تعذر إسناد المهمة"); } };
  const addEmployee = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); const password = String(data.get("password")); if (password.length < 8) { notify("كلمة المرور يجب ألا تقل عن 8 أحرف"); return; } try { const id = await createEmployeeAccount(String(data.get("email")), password, String(data.get("full_name")), String(data.get("phone"))); await callRpc("pr_set_employee_access", { target_id: id, new_role: data.get("role"), new_job_title: data.get("job_title"), new_permissions: data.getAll("permissions"), new_is_active: true }); notify("تم إنشاء الموظف وتفعيل صلاحياته"); setAddOpen(false); await load(); } catch (e) { notify(e instanceof Error ? e.message : "تعذر إنشاء الموظف"); } };
  return <div className="page management"><section className="pagehead"><div><p>الإدارة فقط</p><h1>الموظفون والصلاحيات</h1><span>أضف الموظفين وحدد صلاحياتهم، ثم أسند إليهم المهام.</span></div><button className="primary" onClick={() => setAddOpen(true)}><Plus/>موظف جديد</button></section><section className="staffGrid">{staff.map(s => <article className="staffCard" key={String(s.id)}><div className="staffAvatar">{String(s.full_name || "م").slice(0,1)}</div><div><h3>{String(s.full_name || "موظف")}</h3><p>{String(s.job_title || roleArabic(String(s.role)))}</p><small>{s.is_active === false ? "موقوف" : "نشط"}</small></div><div className="staffActions"><button onClick={() => setSelected(s)}>الصلاحيات</button>{s.role !== "admin" && <button onClick={() => setTaskEmployee(String(s.id))}>إسناد مهمة</button>}</div></article>)}</section>
  <Dialog open={addOpen} onOpenChange={setAddOpen}><DialogContent dir="rtl" className="createDialog"><DialogHeader><DialogTitle>إضافة موظف جديد</DialogTitle><DialogDescription>أنشئ حساب الموظف وحدد ما يمكنه الوصول إليه.</DialogDescription></DialogHeader><form className="createForm" onSubmit={addEmployee}><div className="formGrid"><label><span>الاسم الكامل</span><input name="full_name" required/></label><label><span>رقم الجوال</span><input name="phone" required inputMode="tel"/></label></div><label><span>البريد الإلكتروني</span><input name="email" type="email" required/></label><div className="formGrid"><label><span>كلمة المرور المؤقتة</span><input name="password" type="password" minLength={8} required/></label><label><span>الدور</span><select name="role" defaultValue="operations"><option value="manager">مدير</option><option value="sales">مبيعات</option><option value="operations">مشرف عمليات</option><option value="accountant">محاسب</option></select></label></div><label><span>المسمى الوظيفي</span><input name="job_title" required placeholder="مثال: مشرف فريق النظافة"/></label><fieldset className="permissionChecks"><legend>الشاشات المسموحة</legend>{sectionChoices.map(x => <label key={x}><input type="checkbox" name="permissions" value={x}/><span>{x}</span></label>)}</fieldset><button className="primary">إنشاء وتفعيل الموظف</button></form></DialogContent></Dialog>
  <Dialog open={Boolean(selected)} onOpenChange={v => !v && setSelected(null)}><DialogContent dir="rtl" className="createDialog"><DialogHeader><DialogTitle>صلاحيات {String(selected?.full_name || "الموظف")}</DialogTitle><DialogDescription>تنعكس الصلاحيات على قائمة الموظف فور دخوله التالي.</DialogDescription></DialogHeader>{selected && <form className="createForm" onSubmit={savePermissions}><label><span>الدور الوظيفي</span><select name="role" defaultValue={String(selected.role)}><option value="manager">مدير</option><option value="sales">مبيعات</option><option value="operations">مشرف عمليات</option><option value="accountant">محاسب</option></select></label><label><span>المسمى الوظيفي</span><input name="job_title" defaultValue={String(selected.job_title || "")}/></label><fieldset className="permissionChecks"><legend>الشاشات المسموحة</legend>{sectionChoices.map(x => <label key={x}><input type="checkbox" name="permissions" value={x} defaultChecked={(selected.permissions as string[] || []).includes(x)}/><span>{x}</span></label>)}</fieldset><label className="activeCheck"><input type="checkbox" name="is_active" defaultChecked={selected.is_active !== false}/><span>الحساب فعال</span></label><button className="primary">حفظ وتفعيل الصلاحيات</button></form>}</DialogContent></Dialog>
  <Dialog open={Boolean(taskEmployee)} onOpenChange={v => !v && setTaskEmployee("")}><DialogContent dir="rtl" className="createDialog"><DialogHeader><DialogTitle>إسناد مهمة جديدة</DialogTitle><DialogDescription>ستظهر المهمة داخل شاشة «مهامي» للموظف المحدد فقط.</DialogDescription></DialogHeader><form className="createForm" onSubmit={addTask}><label><span>عنوان المهمة</span><input name="title" required/></label><label><span>التفاصيل</span><textarea name="description" rows={3}/></label><div className="formGrid"><label><span>تاريخ الاستحقاق</span><input type="date" name="due_date"/></label><label><span>الأولوية</span><select name="priority" defaultValue="normal"><option value="normal">عادية</option><option value="high">مرتفعة</option><option value="urgent">عاجلة</option></select></label></div><button className="primary">إسناد المهمة</button></form></DialogContent></Dialog></div>;
}

function roleArabic(role: string) { return ({ super_admin: "السوبر أدمن", admin: "المدير العام", manager: "مدير العمليات", sales: "المبيعات", operations: "مشرف العمليات", accountant: "المحاسب" } as Record<string,string>)[role] || role; }

function Management({ section, connected, notify, canCreate, canExport, onCreate, onRecordPayment }: { section: string; connected: boolean; notify: (m: string) => void; canCreate: boolean; canExport: boolean; onCreate: () => void; onRecordPayment: () => void }) {
  const [filter, setFilter] = useState("الكل");
  const demoRows = useMemo(() => getRows(section), [section]);
  const [rows, setRows] = useState<string[][]>(demoRows);
  const [loadState, setLoadState] = useState("");
  useEffect(() => {
    setRows(demoRows);
    if (!connected) return;
    const tables: Record<string, string> = { "طلبات الخدمة": "pr_service_requests", "العملاء": "pr_customers", "عروض الأسعار": "pr_quotations", "العقود": "pr_contracts", "الفواتير والتحصيل": "pr_invoices" };
    setLoadState("جاري تحميل البيانات...");
    selectRecords(tables[section], "select=*&order=created_at.desc&limit=50")
      .then(data => { setRows(mapDatabaseRows(section, data)); setLoadState(data.length ? "بيانات محدثة" : "لا توجد سجلات بعد"); })
      .catch(error => setLoadState(error instanceof Error ? error.message : "تعذر التحميل"));
  }, [section, connected, demoRows]);
  return <div className="page management"><section className="pagehead managementhead"><div><p>إدارة العمليات</p><h1>{section}</h1><span>{info[section].note}</span>{connected && <small className="liveData">{loadState}</small>}</div><div className="headActions">{section === "الفواتير والتحصيل" && canCreate && <button className="secondaryAction" onClick={onRecordPayment}>تسجيل دفعة</button>}{canCreate ? <button className="primary" onClick={onCreate}><Plus/>{info[section].action}</button> : <span className="readOnly">صلاحية عرض فقط</span>}</div></section>
    <section className="miniStats"><Mini label="الإجمالي" value={String(rows.length)} icon={<ClipboardList/>}/><Mini label="بانتظار إجراء" value="2" icon={<Clock3/>}/><Mini label="مكتمل هذا الشهر" value="18" icon={<CheckCircle2/>}/></section>
    <section className="panel dataPanel"><div className="dataTools"><div className="filters"><Filter/>{["الكل", "جديد", "قيد التنفيذ", "مكتمل"].map(item => <button key={item} className={filter === item ? "chosen" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div>{canExport && <div className="export"><button onClick={() => notify("تم السماح بتصدير البيانات")}><Download/>تصدير</button></div>}</div><DataTable columns={info[section].columns} rows={rows} notify={notify}/></section>
  </div>;
}

function mapDatabaseRows(section: string, data: Record<string, unknown>[]): string[][] {
  const money = (value: unknown) => `${Number(value || 0).toLocaleString("ar-SA")} ر.س`;
  if (section === "طلبات الخدمة") return data.map(r => [String(r.request_no || "—"), `${r.customer_name || "عميل"} — ${r.service_type || "خدمة"}`, String(r.address || r.city || "جدة"), String(r.status || "جديد"), "عرض"]);
  if (section === "العملاء") return data.map(r => [String(r.full_name || "—"), String(r.phone || "—"), String(r.address || "—"), "0 ر.س", "عرض"]);
  if (section === "عروض الأسعار") return data.map(r => [String(r.quote_no || "—"), String(r.customer_name || "—"), money(r.total), String(r.status || "مسودة"), "عرض"]);
  if (section === "العقود") return data.map(r => [String(r.contract_no || "—"), String(r.customer_name || "—"), String(r.duration || "—"), money(r.value), String(r.status || "مسودة")]);
  return data.map(r => [String(r.invoice_no || "—"), String(r.customer_name || "—"), String(r.due_date || "—"), money(r.total), String(r.status || "غير مدفوع")]);
}

function DataTable({ columns, rows, notify }: { columns: string[]; rows: string[][]; notify: (m: string) => void }) { return <div className="tablewrap"><table className="managementTable"><thead><tr>{columns.map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>{rows.map((row, ri) => <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{ci === row.length - 1 && ["عرض", "إرسال"].includes(cell) ? <button className="rowAction" onClick={() => notify(cell === "إرسال" ? "تم تجهيز العرض للإرسال" : "تم فتح التفاصيل")}>{cell === "إرسال" ? <Send/> : <Eye/>}{cell}</button> : <span className={cell.includes("مستحق") ? "due" : ""}>{cell}</span>}</td>)}</tr>)}</tbody></table></div>; }

function getRows(section: string): string[][] {
  if (section === "طلبات الخدمة") return requests;
  if (section === "العملاء") return [["شركة أفق الأعمال", "055 982 1470", "تنظيف مكاتب دوري", "0 ر.س", "عرض"], ["سارة أحمد", "055 421 8860", "تنظيف عميق لفيلا", "2,875 ر.س", "عرض"], ["معرض لوميير", "050 773 2190", "تلميع أرضيات", "7,250 ر.س", "عرض"]];
  if (section === "عروض الأسعار") return [["PR-Q-2026-0007", "سارة أحمد", "2,875 ر.س", "بانتظار الاعتماد", "إرسال"], ["PR-Q-2026-0006", "معرض لوميير", "7,250 ر.س", "تم الإرسال", "عرض"], ["PR-Q-2026-0005", "شركة أفق الأعمال", "4,600 ر.س", "معتمد", "عرض"]];
  if (section === "العقود") return [["PR-C-2026-0011", "شركة أفق الأعمال", "12 شهرًا", "55,200 ر.س", "نشط"], ["PR-C-2026-0010", "معرض لوميير", "6 أشهر", "43,500 ر.س", "بانتظار التوقيع"], ["PR-C-2026-0009", "مجمع عيادات الروضة", "12 شهرًا", "78,000 ر.س", "نشط"]];
  return [["PR-INV-2026-0042", "شركة أفق الأعمال", "15 سبتمبر 2026", "4,600 ر.س", "مستحق"], ["PR-INV-2026-0041", "معرض لوميير", "10 سبتمبر 2026", "7,250 ر.س", "مستحق اليوم"], ["PR-INV-2026-0040", "محمد السالم", "5 سبتمبر 2026", "5,900 ر.س", "مدفوع"]];
}

function Customer({ notify, onCreate }: { notify: (m: string) => void; onCreate: () => void }) {
  const [requestsData,setRequestsData]=useState<Record<string,unknown>[]>([]);
  const [quotes,setQuotes]=useState<Record<string,unknown>[]>([]);
  const [invoices,setInvoices]=useState<Record<string,unknown>[]>([]);
  const load=async()=>{ try { const [r,q,i]=await Promise.all([selectRecords("pr_service_requests","select=*&order=created_at.desc"),selectRecords("pr_quotations","select=*&order=created_at.desc"),selectRecords("pr_invoices","select=*&order=created_at.desc")]);setRequestsData(r);setQuotes(q);setInvoices(i); } catch(e){ notify(e instanceof Error?e.message:"تعذر تحميل بياناتك"); } };
  useEffect(()=>{void load();},[]);
  const respond=async(id:string,accept:boolean)=>{try{await callRpc("pr_customer_quote_response",{p_quote_id:id,p_accept:accept,p_note:null});notify(accept?"تم اعتماد عرض السعر":"تم رفض العرض");await load();}catch(e){notify(e instanceof Error?e.message:"تعذر تحديث العرض");}};
  return <div className="page customer"><section className="customerhero"><div><span>بوابة العميل</span><h1>أهلًا بك في Purity Ritual</h1><p>تابع الطلب، اعتمد عرض السعر، وراجع الفاتورة والدفع من مكان واحد.</p><button className="primary" onClick={onCreate}><Plus/>اطلب خدمة</button></div><img src="/brand/hero-professional.png" alt="موظفة Purity Ritual بالزي المعتمد"/></section>
  <section className="customerFlow"><div><b>1</b><span>إرسال الطلب</span></div><div><b>2</b><span>اعتماد العرض</span></div><div><b>3</b><span>تنفيذ الخدمة</span></div><div><b>4</b><span>الفاتورة والدفع</span></div></section>
  <section className="portalSection"><h2>طلباتي</h2><div className="portalGrid">{requestsData.length?requestsData.map(r=><article key={String(r.id)}><Clock3/><small>{String(r.request_no||"طلب")}</small><h3>{String(r.service_type)}</h3><p>{workflowLabels[String(r.status)]||String(r.status)}</p></article>):<p className="emptyState">لا توجد طلبات بعد</p>}</div></section>
  <section className="portalSection"><h2>عروض الأسعار</h2><div className="portalGrid">{quotes.length?quotes.map(q=><article key={String(q.id)}><FileText/><small>{String(q.quote_no||"عرض سعر")}</small><h3>{Number(q.total||0).toLocaleString("ar-SA")} ر.س</h3><p>{q.status==="sent"?"بانتظار قرارك":q.status==="accepted"?"تم الاعتماد":q.status==="rejected"?"مرفوض":String(q.status)}</p>{q.status==="sent"&&<div className="quoteButtons"><button onClick={()=>respond(String(q.id),true)}>اعتماد العرض</button><button className="reject" onClick={()=>respond(String(q.id),false)}>رفض</button></div>}</article>):<p className="emptyState">لا توجد عروض أسعار</p>}</div></section>
  <section className="portalSection"><h2>الفواتير والدفع</h2><div className="portalGrid">{invoices.length?invoices.map(i=><article key={String(i.id)}><WalletCards/><small>{String(i.invoice_no||"فاتورة")}</small><h3>{Number(i.total||0).toLocaleString("ar-SA")} ر.س</h3><p>{i.status==="paid"?"مدفوعة":i.status==="partially_paid"?"مدفوعة جزئيًا":"مستحقة"}</p></article>):<p className="emptyState">لا توجد فواتير</p>}</div></section></div>;
}

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
    let record = type === "إضافة عميل"
      ? { table: "pr_customers", payload: { full_name: data.client, phone: data.phone, address: data.value, notes: data.notes, created_by: userId } }
      : type === "طلب خدمة"
        ? { table: "pr_service_requests", payload: { customer_id: userId, customer_name: data.client, customer_phone: data.phone, service_type: data.service, city: "جدة", address: data.value, notes: data.notes, created_by: userId } }
        : type === "عرض سعر جديد"
          ? { table: "pr_quotations", payload: { customer_name: data.client, scope: data.service, subtotal: amount, vat_amount: amount * .15, total: amount * 1.15, created_by: userId } }
          : type === "عقد جديد"
            ? { table: "pr_contracts", payload: { customer_name: data.client, phone: data.phone, service: data.service, duration: data.notes, value: amount, notes: data.notes, created_by: userId } }
            : type === "تسجيل دفعة"
              ? { table: "pr_payments", payload: { invoice_id: "", amount, method: data.service, reference: data.phone, received_by: userId } }
              : { table: "pr_invoices", payload: { customer_name: data.client, phone: data.phone, description: data.service, subtotal: amount, notes: data.notes, created_by: userId } };
    if (type === "تسجيل دفعة") {
      try {
        const invoices = await selectRecords("pr_invoices", `invoice_no=eq.${encodeURIComponent(data.client)}&select=id&limit=1`);
        if (!invoices[0]?.id) throw new Error("رقم الفاتورة غير موجود");
        await callRpc("pr_record_invoice_payment", { p_invoice_id: invoices[0].id, p_amount: amount, p_method: data.service, p_reference: data.phone });
        onSaved(type); setSaving(false); return;
      } catch (reason) { setError(reason instanceof Error ? reason.message : "تعذر العثور على الفاتورة"); setSaving(false); return; }
    }
    try { await insertRecord(record.table, record.payload); onSaved(type); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "تعذر الحفظ"); }
    finally { setSaving(false); }
  };
  const isClient = type === "إضافة عميل";
  const isPayment = type === "تسجيل دفعة";
  return <Dialog open={Boolean(type)} onOpenChange={open => !open && onClose()}><DialogContent dir="rtl" className="createDialog"><DialogHeader><DialogTitle>{type}</DialogTitle><DialogDescription>أدخل البيانات المطلوبة ثم اضغط حفظ.</DialogDescription></DialogHeader><form className="createForm" onSubmit={save}>
    <label><span>{isPayment ? "رقم الفاتورة" : isClient ? "اسم العميل" : "العميل"}</span><input name="client" required placeholder={isPayment ? "PR-INV-2026-0001" : "اكتب اسم العميل"}/></label>
    <div className="formGrid"><label><span>{isPayment ? "مرجع التحويل" : "رقم الجوال"}</span><input name="phone" required placeholder={isPayment ? "رقم العملية البنكية" : "05xxxxxxxx"}/></label><label><span>{isPayment ? "المبلغ المحصل (ر.س)" : type === "فاتورة جديدة" || type === "عرض سعر جديد" || type === "عقد جديد" ? "القيمة (ر.س)" : "الحي / الموقع"}</span><input name="value" required placeholder={type === "طلب خدمة" ? "جدة - الحي" : "0.00"}/></label></div>
    {!isClient && <label><span>{isPayment ? "طريقة الدفع" : type === "عقد جديد" ? "مدة العقد" : "الخدمة / البيان"}</span><select name="service" required><option value="">اختر</option>{isPayment ? <><option value="bank_transfer">تحويل بنكي</option><option value="cash">نقدي</option><option value="card">بطاقة</option></> : <><option>تنظيف منازل</option><option>تنظيف مكاتب</option><option>تنظيف بعد التشطيب</option><option>تلميع أرضيات</option><option>عقد نظافة دوري</option></>}</select></label>}
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
  return <Dialog open={open} onOpenChange={value => !value && onClose()}><DialogContent dir="rtl" className="createDialog"><DialogHeader><DialogTitle>حساب المستخدم</DialogTitle><DialogDescription>{connected ? "أنت مسجل الدخول بحساب معتمد." : "أدخل بيانات حسابك للمتابعة."}</DialogDescription></DialogHeader>{connected ? <div className="formActions"><button className="cancel" onClick={() => { signOut(); onDisconnected(); }}>تسجيل الخروج</button><button className="primary" onClick={onClose}>تم</button></div> : <form className="createForm" onSubmit={submit}><label><span>البريد الإلكتروني</span><input name="email" type="email" required/></label><label><span>كلمة المرور</span><input name="password" type="password" minLength={8} required/></label>{error && <p className="formError">{error}</p>}<button className="primary" disabled={loading}>{loading ? "جاري الدخول..." : "دخول"}</button></form>}</DialogContent></Dialog>;
}

function PublicHome({ onConnected }: { onConnected: () => void }) {
  const [loginOpen, setLoginOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const login = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setLoading(true); setError("");
    const data = new FormData(event.currentTarget);
    try { await signIn(String(data.get("email")), String(data.get("password"))); onConnected(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "تعذر تسجيل الدخول"); }
    finally { setLoading(false); }
  };
  const register = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setLoading(true); setError(""); setMessage("");
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password"));
    if (password !== String(data.get("confirm_password"))) { setError("كلمتا المرور غير متطابقتين"); setLoading(false); return; }
    try {
      const result = await signUp(String(data.get("email")), password, String(data.get("full_name")), String(data.get("phone")));
      if (result.access_token) onConnected();
      else setMessage("تم إنشاء الحساب. افتح بريدك لتأكيد الحساب ثم سجّل الدخول.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "تعذر إنشاء الحساب"); }
    finally { setLoading(false); }
  };
  const quote = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setLoading(true); setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>;
    try { await insertPublicRecord("pr_public_quote_requests", { full_name: data.full_name, phone: data.phone, email: data.email || null, service_type: data.service_type, city: "جدة", district: data.district, notes: data.notes }); setMessage("تم استلام طلبك، وسنتواصل معك قريبًا."); event.currentTarget.reset(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "تعذر إرسال الطلب"); }
    finally { setLoading(false); }
  };
  return <main className="publicHome" dir="rtl"><header className="publicNav"><div><img src="/brand/logo.png" alt="Purity Ritual"/><strong>Purity Ritual</strong></div><nav><a href="#services">خدماتنا</a><a href="#team">فريقنا</a><a href="#contact">تواصل معنا</a></nav><button onClick={() => setLoginOpen(true)}>دخول العملاء والموظفين</button></header><section className="publicHero"><div><span>خدمات تنظيف احترافية في جدة</span><h1>نظافة موثوقة<br/>تشعر بها.</h1><p>للمنازل والمكاتب والمنشآت، بفريق مدرّب وزي موحّد ومتابعة واضحة من الطلب حتى الإنجاز.</p><div><button className="primary" onClick={() => setQuoteOpen(true)}>اطلب عرض سعر مجانًا</button><a href="https://wa.me/966555330406">تواصل واتساب</a></div></div><img src="/brand/team-professional.png" alt="فريق Purity Ritual بالزي المعتمد"/></section><section id="services" className="publicServices"><span>خدماتنا</span><h2>حلول نظافة تناسب احتياجك</h2><div><article><strong>تنظيف المنازل والفلل</strong><p>تنظيف دوري وعميق بعناية دقيقة للمساحات السكنية.</p></article><article><strong>تنظيف المكاتب والمنشآت</strong><p>خطط مرنة للمكاتب والمعارض والمواقع التجارية.</p></article><article><strong>تنظيف ما بعد التشطيب</strong><p>إزالة آثار الأعمال وتجهيز الموقع للتسليم والاستخدام.</p></article><article><strong>تلميع الأرضيات</strong><p>عناية احترافية بالرخام والسيراميك والأسطح المختلفة.</p></article></div></section><section id="team" className="publicTrust"><img src="/brand/team-professional.png" alt="فريق Purity Ritual من الموظفين والموظفات"/><div><span>لماذا Purity Ritual؟</span><h2>فريق محترف وهوية موحدة</h2><p>نلتزم بالمواعيد، ونستخدم معدات مناسبة، ونتابع جودة الخدمة حتى رضا العميل.</p><ul><li>فريق مدرّب وموثوق</li><li>معدات ومنظفات متخصصة</li><li>فحص جودة بعد التنفيذ</li><li>عروض أسعار واضحة</li></ul></div></section><section id="contact" className="publicContact"><span>تواصل معنا</span><h2>نحن جاهزون لخدمتك</h2><p>للطلبات والاستفسارات في جدة، اختر وسيلة التواصل المناسبة.</p><div><a className="whatsappContact" href="https://wa.me/966555330406" target="_blank" rel="noreferrer">واتساب: +966 55 533 0406</a><a href="tel:+966555330406">اتصال مباشر</a><a href="mailto:ahmedazi911@gmail.com">ahmedazi911@gmail.com</a></div></section><footer><strong>Purity Ritual</strong><span>جدة، المملكة العربية السعودية</span><a href="tel:+966555330406">+966 55 533 0406</a><a href="mailto:ahmedazi911@gmail.com">ahmedazi911@gmail.com</a></footer>
  <Dialog open={loginOpen} onOpenChange={value => { setLoginOpen(value); setError(""); setMessage(""); }}><DialogContent dir="rtl" className="createDialog"><div className="loginTabs"><button className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>تسجيل الدخول</button><button className={authMode === "register" ? "active" : ""} onClick={() => setAuthMode("register")}>حساب عميل جديد</button></div><DialogHeader><DialogTitle>{authMode === "login" ? "تسجيل الدخول" : "إنشاء حساب عميل"}</DialogTitle><DialogDescription>{authMode === "login" ? "للعملاء المسجلين وموظفي الشركة." : "أنشئ حسابًا لمتابعة طلباتك وعروض الأسعار والفواتير."}</DialogDescription></DialogHeader>{message ? <div className="quoteSuccess"><CheckCircle2/><strong>{message}</strong><button className="primary" onClick={() => { setMessage(""); setAuthMode("login"); }}>الانتقال للدخول</button></div> : authMode === "login" ? <form className="createForm" onSubmit={login}><label><span>البريد الإلكتروني</span><input name="email" type="email" required/></label><label><span>كلمة المرور</span><input name="password" type="password" minLength={8} required/></label>{error && <p className="formError">{error}</p>}<button className="primary" disabled={loading}>{loading ? "جاري التحقق..." : "دخول"}</button></form> : <form className="createForm" onSubmit={register}><label><span>الاسم الكامل</span><input name="full_name" required/></label><div className="formGrid"><label><span>رقم الجوال</span><input name="phone" inputMode="tel" required/></label><label><span>البريد الإلكتروني</span><input name="email" type="email" required/></label></div><div className="formGrid"><label><span>كلمة المرور</span><input name="password" type="password" minLength={8} required/></label><label><span>تأكيد كلمة المرور</span><input name="confirm_password" type="password" minLength={8} required/></label></div>{error && <p className="formError">{error}</p>}<button className="primary" disabled={loading}>{loading ? "جاري إنشاء الحساب..." : "إنشاء الحساب"}</button></form>}</DialogContent></Dialog>
  <Dialog open={quoteOpen} onOpenChange={value => { setQuoteOpen(value); setError(""); setMessage(""); }}><DialogContent dir="rtl" className="createDialog"><DialogHeader><DialogTitle>طلب عرض سعر</DialogTitle><DialogDescription>لا تحتاج إلى إنشاء حساب. اترك بياناتك وسنتواصل معك.</DialogDescription></DialogHeader>{message ? <div className="quoteSuccess"><CheckCircle2/><strong>{message}</strong><button className="primary" onClick={() => setQuoteOpen(false)}>تم</button></div> : <form className="createForm" onSubmit={quote}><label><span>الاسم الكامل</span><input name="full_name" required/></label><div className="formGrid"><label><span>رقم الجوال</span><input name="phone" inputMode="tel" required/></label><label><span>البريد الإلكتروني (اختياري)</span><input name="email" type="email"/></label></div><div className="formGrid"><label><span>نوع الخدمة</span><select name="service_type" required><option value="">اختر الخدمة</option><option>تنظيف منزل أو فيلا</option><option>تنظيف مكتب أو منشأة</option><option>تنظيف بعد التشطيب</option><option>تلميع أرضيات</option></select></label><label><span>الحي</span><input name="district" required/></label></div><label><span>تفاصيل إضافية</span><textarea name="notes" rows={3}/></label>{error && <p className="formError">{error}</p>}<button className="primary" disabled={loading}>{loading ? "جاري الإرسال..." : "إرسال الطلب"}</button></form>}</DialogContent></Dialog></main>;
}

function LoginLanding({ onConnected }: { onConnected: () => void }) {
  const [tab, setTab] = useState<"staff" | "customer">("customer");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setLoading(true); setError("");
    const data = new FormData(event.currentTarget);
    try { await signIn(String(data.get("email")), String(data.get("password"))); onConnected(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "تعذر تسجيل الدخول"); }
    finally { setLoading(false); }
  };
  return <main className="loginPage" dir="rtl"><section className="loginBrand"><img src="/brand/team-professional.png" alt="فريق Purity Ritual بالزي المعتمد"/><div><img src="/brand/logo.png" alt="Purity Ritual"/><h1>النظافة التي تشعر بها</h1><p>خدمات احترافية للمنازل والمكاتب والمنشآت في جدة.</p></div></section><section className="loginCard"><div className="loginTabs"><button className={tab === "customer" ? "active" : ""} onClick={() => setTab("customer")}>دخول العملاء</button><button className={tab === "staff" ? "active" : ""} onClick={() => setTab("staff")}>دخول الموظفين</button></div><h2>{tab === "customer" ? "مرحبًا بك في بوابة العميل" : "دخول فريق الإدارة"}</h2><p>{tab === "customer" ? "تابع طلباتك وعروض الأسعار والفواتير." : "استخدم حساب العمل المخصص لك."}</p><form className="createForm" onSubmit={submit}><label><span>البريد الإلكتروني</span><input name="email" type="email" required autoComplete="email"/></label><label><span>كلمة المرور</span><input name="password" type="password" minLength={8} required autoComplete="current-password"/></label>{error && <p className="formError">{error}</p>}<button className="primary" disabled={loading}>{loading ? "جاري التحقق..." : "دخول آمن"}</button></form><small>لإنشاء حساب عميل جديد تواصل معنا على 055 533 0406</small></section></main>;
}

function Stat({ label, value, note, icon }: { label: string; value: string; note: string; icon: React.ReactNode }) { return <article className="stat"><div>{icon}</div><span>{label}</span><h3>{value}</h3><p>{note}</p></article>; }
function Mini({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) { return <article><i>{icon}</i><div><span>{label}</span><b>{value}</b></div></article>; }
function Visit({ t, title, client }: { t: string; title: string; client: string }) { return <div className="visit"><time>{t}</time><i/><div><strong>{title}</strong><span>{client}</span><button><Phone/>تواصل</button></div></div>; }
