-- Purity Ritual V1.9 — public quote requests without registration
create table if not exists public.pr_public_quote_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  email text,
  service_type text not null,
  city text not null default 'جدة',
  district text,
  notes text,
  status text not null default 'new' check (status in ('new','contacted','qualified','converted','closed')),
  created_at timestamptz not null default now()
);

alter table public.pr_public_quote_requests enable row level security;
drop policy if exists "public can request quote" on public.pr_public_quote_requests;
create policy "public can request quote" on public.pr_public_quote_requests
for insert to anon, authenticated with check (status='new');
drop policy if exists "staff can read quote requests" on public.pr_public_quote_requests;
create policy "staff can read quote requests" on public.pr_public_quote_requests
for select to authenticated using (public.pr_has_role(array['admin','manager','sales']));
drop policy if exists "staff can update quote requests" on public.pr_public_quote_requests;
create policy "staff can update quote requests" on public.pr_public_quote_requests
for update to authenticated using (public.pr_has_role(array['admin','manager','sales']))
with check (public.pr_has_role(array['admin','manager','sales']));

grant insert on public.pr_public_quote_requests to anon, authenticated;
grant select,update on public.pr_public_quote_requests to authenticated;
create index if not exists pr_public_quotes_status_idx on public.pr_public_quote_requests(status,created_at desc);
notify pgrst, 'reload schema';
