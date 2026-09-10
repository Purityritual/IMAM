-- Purity Ritual — Sprint 3: CRM, contracts, invoices and role-based access
create extension if not exists pgcrypto;

alter table public.pr_profiles drop constraint if exists pr_profiles_role_check;
alter table public.pr_profiles add constraint pr_profiles_role_check
  check (role in ('customer','admin','manager','sales','operations','accountant'));

create or replace function public.pr_has_role(allowed_roles text[])
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.pr_profiles
    where id=auth.uid() and is_active=true and role = any(allowed_roles)
  );
$$;

create table if not exists public.pr_customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  email text,
  city text not null default 'جدة',
  address text,
  notes text,
  created_by uuid references public.pr_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pr_service_requests alter column customer_id drop not null;
alter table public.pr_service_requests add column if not exists customer_record_id uuid references public.pr_customers(id);
alter table public.pr_service_requests add column if not exists customer_name text;
alter table public.pr_service_requests add column if not exists customer_phone text;
alter table public.pr_service_requests add column if not exists created_by uuid references public.pr_profiles(id);
alter table public.pr_service_requests alter column property_type drop not null;
alter table public.pr_service_requests alter column district drop not null;
alter table public.pr_service_requests alter column address drop not null;

alter table public.pr_quotations alter column request_id drop not null;
alter table public.pr_quotations alter column customer_id drop not null;
alter table public.pr_quotations add column if not exists customer_record_id uuid references public.pr_customers(id);
alter table public.pr_quotations add column if not exists customer_name text;

create sequence if not exists public.pr_contract_no_seq start 1;
create table if not exists public.pr_contracts (
  id uuid primary key default gen_random_uuid(),
  contract_no text not null unique default ('PR-C-'||to_char(now(),'YYYY')||'-'||lpad(nextval('public.pr_contract_no_seq')::text,4,'0')),
  customer_record_id uuid references public.pr_customers(id),
  customer_name text not null,
  phone text,
  service text not null,
  duration text,
  value numeric(12,2) not null default 0,
  status text not null default 'draft' check(status in ('draft','pending_signature','active','expired','cancelled')),
  notes text,
  created_by uuid references public.pr_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence if not exists public.pr_invoice_no_seq start 1;
create table if not exists public.pr_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text not null unique default ('PR-INV-'||to_char(now(),'YYYY')||'-'||lpad(nextval('public.pr_invoice_no_seq')::text,4,'0')),
  customer_record_id uuid references public.pr_customers(id),
  customer_name text not null,
  phone text,
  description text not null,
  subtotal numeric(12,2) not null default 0,
  vat_rate numeric(5,2) not null default 15,
  total numeric(12,2) generated always as (subtotal + subtotal * vat_rate / 100) stored,
  due_date date,
  status text not null default 'unpaid' check(status in ('draft','unpaid','partially_paid','paid','overdue','cancelled')),
  notes text,
  created_by uuid references public.pr_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pr_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.pr_invoices(id) on delete cascade,
  amount numeric(12,2) not null check(amount > 0),
  method text not null default 'bank_transfer',
  reference text,
  paid_at timestamptz not null default now(),
  received_by uuid references public.pr_profiles(id),
  created_at timestamptz not null default now()
);

alter table public.pr_customers enable row level security;
alter table public.pr_contracts enable row level security;
alter table public.pr_invoices enable row level security;
alter table public.pr_payments enable row level security;

drop policy if exists "customers staff read" on public.pr_customers;
create policy "customers staff read" on public.pr_customers for select to authenticated
using (public.pr_has_role(array['admin','manager','sales','operations','accountant']));
drop policy if exists "customers staff create" on public.pr_customers;
create policy "customers staff create" on public.pr_customers for insert to authenticated
with check (public.pr_has_role(array['admin','manager','sales']) and created_by=auth.uid());
drop policy if exists "customers staff update" on public.pr_customers;
create policy "customers staff update" on public.pr_customers for update to authenticated
using (public.pr_has_role(array['admin','manager','sales','operations']))
with check (public.pr_has_role(array['admin','manager','sales','operations']));

drop policy if exists "contracts staff read" on public.pr_contracts;
create policy "contracts staff read" on public.pr_contracts for select to authenticated
using (public.pr_has_role(array['admin','manager','accountant']));
drop policy if exists "contracts manager write" on public.pr_contracts;
create policy "contracts manager write" on public.pr_contracts for all to authenticated
using (public.pr_has_role(array['admin','manager']))
with check (public.pr_has_role(array['admin','manager']) and created_by=auth.uid());

drop policy if exists "invoices finance read" on public.pr_invoices;
create policy "invoices finance read" on public.pr_invoices for select to authenticated
using (public.pr_has_role(array['admin','manager','accountant']));
drop policy if exists "invoices finance write" on public.pr_invoices;
create policy "invoices finance write" on public.pr_invoices for all to authenticated
using (public.pr_has_role(array['admin','manager','accountant']))
with check (public.pr_has_role(array['admin','manager','accountant']) and created_by=auth.uid());
drop policy if exists "payments finance" on public.pr_payments;
create policy "payments finance" on public.pr_payments for all to authenticated
using (public.pr_has_role(array['admin','manager','accountant']))
with check (public.pr_has_role(array['admin','manager','accountant']) and received_by=auth.uid());

drop policy if exists "requests staff create" on public.pr_service_requests;
create policy "requests staff create" on public.pr_service_requests for insert to authenticated
with check (public.pr_has_role(array['admin','manager','sales','operations']) and created_by=auth.uid());
drop policy if exists "quotes staff create" on public.pr_quotations;
create policy "quotes staff create" on public.pr_quotations for insert to authenticated
with check (public.pr_has_role(array['admin','manager','sales']) and created_by=auth.uid());

grant select,insert,update on public.pr_customers,public.pr_contracts,public.pr_invoices,public.pr_payments to authenticated;
grant usage,select on sequence public.pr_contract_no_seq,public.pr_invoice_no_seq to authenticated;
create index if not exists pr_customers_phone_idx on public.pr_customers(phone);
create index if not exists pr_contracts_status_idx on public.pr_contracts(status,created_at desc);
create index if not exists pr_invoices_status_idx on public.pr_invoices(status,due_date);

-- Run once for the owner account after signup:
-- update public.pr_profiles set role='admin' where id=(select id from auth.users where email='OWNER_EMAIL');
