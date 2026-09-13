"use client";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://omeapxglhfxbvwkgrbso.supabase.co";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_T6EKMGHotGTBHchSCa49rQ_UxLmHDI9";
const TOKEN_KEY = "purity-supabase-session";

export type SupabaseSession = { access_token: string; refresh_token?: string; user?: { email?: string } };

export function getSession(): SupabaseSession | null {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || "null"); } catch { return null; }
}

export async function signIn(email: string, password: string) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error_description || body.msg || "تعذر تسجيل الدخول");
  localStorage.setItem(TOKEN_KEY, JSON.stringify(body));
  return body as SupabaseSession;
}

export async function signUp(email: string, password: string, fullName: string, phone: string) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, data: { full_name: fullName, phone } }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.msg || body.error_description || "تعذر إنشاء الحساب");
  if (body.access_token) localStorage.setItem(TOKEN_KEY, JSON.stringify(body));
  return body as SupabaseSession;
}

// Creates a separate employee account without replacing the manager's active session.
export async function createEmployeeAccount(email: string, password: string, fullName: string, phone: string) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, data: { full_name: fullName, phone, account_type: "employee_pending" } }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.msg || body.error_description || "تعذر إنشاء حساب الموظف");
  const id = body.user?.id || body.id;
  if (!id) throw new Error("تم إرسال دعوة التأكيد، أكمل تأكيد البريد ثم أعد المحاولة");
  return String(id);
}

export function signOut() { localStorage.removeItem(TOKEN_KEY); }

export function getUserId() {
  const token = getSession()?.access_token;
  if (!token) return null;
  try { return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).sub as string; } catch { return null; }
}

export async function insertRecord(table: string, payload: Record<string, unknown>) {
  const session = getSession();
  if (!session?.access_token) throw new Error("يلزم تسجيل دخول موظف معتمد قبل الحفظ");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || body?.hint || "تعذر حفظ البيانات، حاول مرة أخرى");
  return body;
}

export async function updateRecord(table: string, id: string, payload: Record<string, unknown>) {
  const session = getSession();
  if (!session?.access_token) throw new Error("يلزم تسجيل الدخول");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || "تعذر تحديث البيانات");
  return body;
}

export async function selectRecords(table: string, query = "select=*") {
  const session = getSession();
  if (!session?.access_token) throw new Error("يلزم تسجيل الدخول لعرض البيانات");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}` },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || "تعذر تحميل البيانات");
  return body as Record<string, unknown>[];
}

export async function callRpc(name: string, payload: Record<string, unknown> = {}) {
  const session = getSession();
  if (!session?.access_token) throw new Error("يلزم تسجيل الدخول");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || "تعذر تنفيذ العملية");
  return body as Record<string, unknown>[];
}

export async function insertPublicRecord(table: string, payload: Record<string, unknown>) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || "تعذر إرسال الطلب");
}
