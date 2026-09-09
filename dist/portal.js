import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

const configured=!SUPABASE_URL.includes("YOUR_PROJECT")&&!SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");
const supabase=configured?createClient(SUPABASE_URL,SUPABASE_ANON_KEY):null;
const $=s=>document.querySelector(s);
const authView=$("#authView"),customerView=$("#customerView"),authMessage=$("#authMessage"),requestMessage=$("#requestMessage");
let currentUser=null;

function message(el,text,error=false){el.textContent=text;el.classList.toggle("error",error)}
function authError(error){const map={"Invalid login credentials":"البريد الإلكتروني أو كلمة المرور غير صحيحة","User already registered":"هذا البريد مسجل مسبقًا"};return map[error?.message]||error?.message||"تعذر إكمال العملية"}
function setBusy(form,busy){const btn=form.querySelector('button[type="submit"]');btn.disabled=busy;btn.dataset.label??=btn.textContent;btn.textContent=busy?"جاري التنفيذ...":btn.dataset.label}

document.querySelectorAll(".tab").forEach(tab=>tab.addEventListener("click",()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));tab.classList.add("active");$("#loginForm").classList.toggle("hidden",tab.dataset.tab!=="login");$("#registerForm").classList.toggle("hidden",tab.dataset.tab!=="register");message(authMessage,"")}));

$("#loginForm").addEventListener("submit",async e=>{e.preventDefault();if(!configured)return message(authMessage,"أضف بيانات Supabase في ملف supabase-config.js",true);setBusy(e.currentTarget,true);const f=new FormData(e.currentTarget);const {error}=await supabase.auth.signInWithPassword({email:f.get("email"),password:f.get("password")});setBusy(e.currentTarget,false);if(error)message(authMessage,authError(error),true)});

$("#registerForm").addEventListener("submit",async e=>{e.preventDefault();if(!configured)return message(authMessage,"أضف بيانات Supabase في ملف supabase-config.js",true);setBusy(e.currentTarget,true);const f=new FormData(e.currentTarget);const {data,error}=await supabase.auth.signUp({email:f.get("email"),password:f.get("password"),options:{data:{full_name:f.get("full_name"),phone:f.get("phone")}}});setBusy(e.currentTarget,false);if(error)return message(authMessage,authError(error),true);message(authMessage,data.session?"تم إنشاء الحساب":"تم إنشاء الحساب. راجع بريدك لتأكيد التسجيل")});

$("#logoutBtn").addEventListener("click",()=>supabase?.auth.signOut());
$("#newRequestBtn").addEventListener("click",()=>$("#requestDialog").showModal());
$("#closeDialog").addEventListener("click",()=>$("#requestDialog").close());
$("#refreshBtn").addEventListener("click",loadRequests);

async function showSession(session){currentUser=session?.user||null;authView.classList.toggle("hidden",!!currentUser);customerView.classList.toggle("hidden",!currentUser);$("#logoutBtn").classList.toggle("hidden",!currentUser);if(currentUser){$("#welcome").textContent=`مرحبًا ${currentUser.user_metadata?.full_name||"بك"}`;await loadRequests()}}

async function loadRequests(){const list=$("#requestsList");list.innerHTML='<p class="empty">جاري تحميل الطلبات...</p>';const {data,error}=await supabase.from("pr_service_requests").select("id,request_no,service_type,property_type,city,status,created_at").order("created_at",{ascending:false});if(error){list.innerHTML=`<p class="empty">${authError(error)}</p>`;return}const rows=data||[];$("#totalRequests").textContent=rows.length;$("#completedRequests").textContent=rows.filter(x=>x.status==="completed").length;$("#openRequests").textContent=rows.filter(x=>!['completed','cancelled'].includes(x.status)).length;if(!rows.length){list.innerHTML='<p class="empty">لا توجد طلبات حتى الآن. ابدأ بطلب خدمة جديد.</p>';return}const labels={new:"جديد",reviewing:"تحت المراجعة",inspection_scheduled:"تم تحديد المعاينة",quoted:"صدر عرض السعر",approved:"معتمد",scheduled:"مجدول",in_progress:"قيد التنفيذ",completed:"مكتمل",cancelled:"ملغي"};list.innerHTML=rows.map(r=>`<article class="request-item"><div><h3>${escapeHtml(r.service_type)}</h3><small>${escapeHtml(r.request_no)}</small></div><span>${escapeHtml(r.property_type)} · ${escapeHtml(r.city)}</span><small>${new Date(r.created_at).toLocaleDateString("ar-SA")}</small><span class="status ${r.status==='completed'?'completed':''}">${labels[r.status]||r.status}</span></article>`).join("")}

$("#requestForm").addEventListener("submit",async e=>{e.preventDefault();setBusy(e.currentTarget,true);message(requestMessage,"جاري حفظ الطلب...");const f=new FormData(e.currentTarget);const payload={customer_id:currentUser.id,service_type:f.get("service_type"),property_type:f.get("property_type"),city:f.get("city"),district:f.get("district"),address:f.get("address"),area_sqm:Number(f.get("area_sqm"))||null,preferred_date:f.get("preferred_date")||null,notes:f.get("notes")||null};const {data,error}=await supabase.from("pr_service_requests").insert(payload).select("id,request_no").single();if(error){setBusy(e.currentTarget,false);return message(requestMessage,authError(error),true)}const files=[...f.getAll("photos")].filter(x=>x.size).slice(0,5);for(const file of files){const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");const path=`${currentUser.id}/${data.id}/${crypto.randomUUID()}-${safe}`;const up=await supabase.storage.from("service-request-photos").upload(path,file);if(!up.error)await supabase.from("pr_request_attachments").insert({request_id:data.id,customer_id:currentUser.id,storage_path:path,file_name:file.name,mime_type:file.type,file_size:file.size})}setBusy(e.currentTarget,false);message(requestMessage,`تم إرسال الطلب ${data.request_no} بنجاح`);e.currentTarget.reset();setTimeout(()=>$("#requestDialog").close(),900);await loadRequests()});

function escapeHtml(v=""){return String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]))}
if(configured){const {data:{session}}=await supabase.auth.getSession();await showSession(session);supabase.auth.onAuthStateChange((_event,session)=>setTimeout(()=>showSession(session),0))}else message(authMessage,"يلزم ربط Supabase قبل الاستخدام",true);
