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
  if (!response.ok) throw new Error(body?.message || body?.hint || "تعذر حفظ البيانات في Supabase");
  return body;
}
