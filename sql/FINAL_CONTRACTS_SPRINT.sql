-- Purity Ritual - Final Contracts & Follow-up Sprint
-- Run once in Supabase SQL Editor before testing the new contracts screen.

begin;

alter table if exists public.pr_contracts
  add column if not exists contract_no text,
  add column if not exists phone text,
  add column if not exists service text,
  add column if not exists duration text,
  add column if not exists value numeric(14,2) not null default 0,
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists owner_name text,
  add column if not exists payment_terms text,
  add column if not exists auto_renew boolean not null default false,
  add column if not exists renewal_notice_days integer not null default 30,
  add column if not exists signed_date date,
  add column if not exists document_url text,
  add column if not exists status text not null default 'draft',
  add column if not exists notes text,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists pr_contracts_contract_no_uidx
  on public.pr_contracts(contract_no)
  where contract_no is not null;
create index if not exists pr_contracts_end_date_idx on public.pr_contracts(end_date);
create index if not exists pr_contracts_status_idx on public.pr_contracts(status);

create table if not exists public.pr_contract_followups (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.pr_contracts(id) on delete cascade,
  action_type text not null default 'note',
  note text not null,
  next_action_date date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists pr_contract_followups_contract_idx on public.pr_contract_followups(contract_id, created_at desc);

alter table if exists public.pr_invoices
  add column if not exists contract_id uuid references public.pr_contracts(id) on delete set null;
create index if not exists pr_invoices_contract_idx on public.pr_invoices(contract_id);

alter table public.pr_contract_followups enable row level security;

drop policy if exists "staff can read contract followups" on public.pr_contract_followups;
create policy "staff can read contract followups"
on public.pr_contract_followups for select
to authenticated
using (exists (
  select 1 from public.pr_profiles p
  where p.id = auth.uid()
    and coalesce(p.is_active,true) = true
    and coalesce(p.role,'customer') <> 'customer'
));

drop policy if exists "staff can create contract followups" on public.pr_contract_followups;
create policy "staff can create contract followups"
on public.pr_contract_followups for insert
to authenticated
with check (exists (
  select 1 from public.pr_profiles p
  where p.id = auth.uid()
    and coalesce(p.is_active,true) = true
    and coalesce(p.role,'customer') <> 'customer'
));

drop policy if exists "staff can update contract followups" on public.pr_contract_followups;
create policy "staff can update contract followups"
on public.pr_contract_followups for update
to authenticated
using (exists (
  select 1 from public.pr_profiles p
  where p.id = auth.uid()
    and coalesce(p.is_active,true) = true
    and coalesce(p.role,'customer') <> 'customer'
))
with check (exists (
  select 1 from public.pr_profiles p
  where p.id = auth.uid()
    and coalesce(p.is_active,true) = true
    and coalesce(p.role,'customer') <> 'customer'
));

-- Normalize records that already have dates but no explicit lifecycle state.
update public.pr_contracts
set status = case
  when end_date is not null and end_date < current_date then 'expired'
  when status is null or status = '' then 'draft'
  else status
end,
updated_at = now()
where status is null or status = '' or (end_date is not null and end_date < current_date and status not in ('cancelled','renewed'));

commit;

notify pgrst, 'reload schema';
