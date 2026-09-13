-- Purity Ritual — Complete Service Lifecycle Sprint
-- Prerequisite: run 007 once. This file is idempotent.
begin;

alter table public.pr_profiles add column if not exists job_title text;
alter table public.pr_profiles add column if not exists permissions text[] not null default '{}';
drop trigger if exists pr_protect_employee_access_trigger on public.pr_profiles;
alter table public.pr_profiles drop constraint if exists pr_profiles_role_check;
alter table public.pr_profiles add constraint pr_profiles_role_check check(role in('customer','super_admin','admin','manager','sales','operations','accountant'));

create or replace function public.pr_is_staff() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.pr_profiles where id=auth.uid() and is_active=true and role in('super_admin','admin','manager','sales','operations','accountant'));$$;
create or replace function public.pr_has_role(allowed_roles text[]) returns boolean language sql stable security definer set search_path=public as $$
 select lower(coalesce(auth.jwt()->>'email',''))='melnaeema@gmail.com' or exists(select 1 from public.pr_profiles where id=auth.uid() and is_active=true and(role='super_admin' or role=any(allowed_roles)));$$;
create or replace function public.pr_is_super_admin() returns boolean language sql stable security definer set search_path=public,auth as $$
 select lower(coalesce(auth.jwt()->>'email',''))='melnaeema@gmail.com' or exists(select 1 from public.pr_profiles where id=auth.uid() and is_active=true and role='super_admin');$$;

create or replace function public.pr_handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.pr_profiles(id,full_name,phone,role,is_active) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),new.raw_user_meta_data->>'phone','customer',true) on conflict(id) do nothing;return new;end;$$;
drop trigger if exists pr_on_auth_user_created on auth.users;
create trigger pr_on_auth_user_created after insert on auth.users for each row execute function public.pr_handle_new_user();
insert into public.pr_profiles(id,full_name,phone,role,is_active)
select u.id,coalesce(u.raw_user_meta_data->>'full_name',''),u.raw_user_meta_data->>'phone','customer',true from auth.users u on conflict(id) do nothing;
update public.pr_profiles set role='super_admin',is_active=true where id=(select id from auth.users where lower(email)='melnaeema@gmail.com');
update public.pr_profiles set role='customer',permissions='{}' where id=(select id from auth.users where lower(email)='melnaeem@gmail.com');

create table if not exists public.pr_employee_tasks(
 id uuid primary key default gen_random_uuid(),employee_id uuid not null references public.pr_profiles(id) on delete cascade,
 title text not null,description text,due_date date,priority text not null default 'normal' check(priority in('low','normal','high','urgent')),
 status text not null default 'new' check(status in('new','in_progress','completed','cancelled')),
 created_by uuid not null default auth.uid() references public.pr_profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.pr_employee_tasks enable row level security;

drop function if exists public.pr_list_employees();
create function public.pr_list_employees()
returns table(id uuid,email text,full_name text,phone text,role text,job_title text,permissions text[],is_active boolean,pending boolean)
language plpgsql security definer set search_path=public,auth as $$
begin
 if not public.pr_is_super_admin() then raise exception 'Super Admin only';end if;
 return query select p.id,u.email::text,p.full_name,p.phone,p.role,p.job_title,p.permissions,p.is_active,
 (p.role='customer' and coalesce(u.raw_user_meta_data->>'account_type','')='employee_pending')
 from public.pr_profiles p join auth.users u on u.id=p.id
 where p.role<>'customer' or coalesce(u.raw_user_meta_data->>'account_type','')='employee_pending' order by p.created_at desc;
end;$$;

drop function if exists public.pr_set_employee_access(uuid,text,text,text[],boolean);
create function public.pr_set_employee_access(target_id uuid,new_role text,new_job_title text,new_permissions text[],new_is_active boolean)
returns void language plpgsql security definer set search_path=public,auth as $$
begin
 if not public.pr_is_super_admin() then raise exception 'Super Admin only';end if;
 if new_role not in('manager','sales','operations','accountant') then raise exception 'Invalid employee role';end if;
 insert into public.pr_profiles(id,full_name,phone,role,job_title,permissions,is_active)
 select u.id,coalesce(u.raw_user_meta_data->>'full_name',''),u.raw_user_meta_data->>'phone',new_role,new_job_title,coalesce(new_permissions,'{}'),new_is_active from auth.users u where u.id=target_id
 on conflict(id) do update set role=excluded.role,job_title=excluded.job_title,permissions=excluded.permissions,is_active=excluded.is_active,updated_at=now();
 if not found then raise exception 'Employee account not found in Authentication';end if;
end;$$;

drop policy if exists "profiles own read" on public.pr_profiles;
create policy "profiles own read" on public.pr_profiles for select to authenticated using(id=auth.uid() or public.pr_is_staff());
drop policy if exists "employees read own tasks" on public.pr_employee_tasks;
create policy "employees read own tasks" on public.pr_employee_tasks for select to authenticated using(employee_id=auth.uid() or public.pr_is_super_admin());
drop policy if exists "employees update own tasks" on public.pr_employee_tasks;
create policy "employees update own tasks" on public.pr_employee_tasks for update to authenticated using(employee_id=auth.uid() or public.pr_is_super_admin()) with check(employee_id=auth.uid() or public.pr_is_super_admin());
drop policy if exists "management creates tasks" on public.pr_employee_tasks;
create policy "management creates tasks" on public.pr_employee_tasks for insert to authenticated with check(public.pr_is_super_admin() and created_by=auth.uid());
grant execute on function public.pr_list_employees() to authenticated;
grant execute on function public.pr_set_employee_access(uuid,text,text,text[],boolean) to authenticated;
grant execute on function public.pr_is_super_admin() to authenticated;
grant select,insert,update on public.pr_employee_tasks to authenticated;

create or replace function public.pr_protect_employee_access()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if (new.role,new.permissions,new.is_active,new.job_title) is distinct from (old.role,old.permissions,old.is_active,old.job_title)
 and auth.uid() is not null and not public.pr_is_super_admin() then raise exception 'Only Super Admin can change employee access';end if;
 return new;
end;$$;
create trigger pr_protect_employee_access_trigger before update on public.pr_profiles
for each row execute function public.pr_protect_employee_access();

alter table public.pr_service_requests add column if not exists assigned_to uuid references public.pr_profiles(id);
alter table public.pr_service_requests add column if not exists scheduled_at timestamptz;
alter table public.pr_service_requests add column if not exists started_at timestamptz;
alter table public.pr_service_requests add column if not exists completed_at timestamptz;
alter table public.pr_service_requests add column if not exists final_notes text;
alter table public.pr_service_requests add column if not exists quoted_total numeric(12,2);

update public.pr_service_requests r set customer_id=p.id
from public.pr_profiles p
where r.customer_id is null and r.customer_phone is not null and p.phone is not null
  and regexp_replace(r.customer_phone,'[^0-9]','','g')=regexp_replace(p.phone,'[^0-9]','','g');

drop policy if exists "requests customer read" on public.pr_service_requests;
create policy "requests customer read" on public.pr_service_requests for select to authenticated
using(customer_id=auth.uid() or public.pr_is_staff());

alter table public.pr_invoices add column if not exists request_id uuid references public.pr_service_requests(id);
alter table public.pr_invoices add column if not exists customer_id uuid references public.pr_profiles(id);
alter table public.pr_employee_tasks add column if not exists request_id uuid references public.pr_service_requests(id);

drop policy if exists "invoices customer read" on public.pr_invoices;
create policy "invoices customer read" on public.pr_invoices for select to authenticated
using(customer_id=auth.uid() or public.pr_has_role(array['admin','manager','accountant']));
drop policy if exists "payments customer read" on public.pr_payments;
create policy "payments customer read" on public.pr_payments for select to authenticated
using(public.pr_has_role(array['admin','manager','accountant']) or exists(
  select 1 from public.pr_invoices i where i.id=invoice_id and i.customer_id=auth.uid()
));

create or replace function public.pr_admin_workflow(
  p_request_id uuid,p_action text,p_amount numeric default null,
  p_employee_id uuid default null,p_note text default null
) returns void language plpgsql security definer set search_path=public as $$
declare r public.pr_service_requests%rowtype; inv_id uuid;
begin
  if not public.pr_has_role(array['admin','manager','sales','operations','accountant']) then raise exception 'غير مصرح'; end if;
  if p_action in('review','quote') and not public.pr_has_role(array['admin','manager','sales']) then raise exception 'هذا الإجراء للمبيعات والإدارة';end if;
  if p_action in('assign','start','complete') and not public.pr_has_role(array['admin','manager','operations']) then raise exception 'هذا الإجراء للعمليات والإدارة';end if;
  if p_action='invoice' and not public.pr_has_role(array['admin','manager','accountant']) then raise exception 'هذا الإجراء للحسابات والإدارة';end if;
  select * into r from public.pr_service_requests where id=p_request_id for update;
  if not found then raise exception 'الطلب غير موجود'; end if;
  if p_action='review' and r.status='new' then
    update public.pr_service_requests set status='reviewing',admin_notes=p_note,updated_at=now() where id=p_request_id;
  elsif p_action='quote' and r.status in('new','reviewing') then
    if coalesce(p_amount,0)<=0 then raise exception 'قيمة العرض مطلوبة'; end if;
    if exists(select 1 from public.pr_quotations where request_id=r.id and status<>'cancelled') then raise exception 'يوجد عرض سعر لهذا الطلب'; end if;
    insert into public.pr_quotations(request_id,customer_id,status,subtotal,vat_amount,total,scope,created_by)
    values(r.id,r.customer_id,'sent',p_amount,p_amount*.15,p_amount*1.15,coalesce(p_note,r.service_type),auth.uid());
    update public.pr_service_requests set status='quoted',quoted_total=p_amount*1.15,updated_at=now() where id=p_request_id;
  elsif p_action='assign' and r.status='approved' then
    if p_employee_id is null then raise exception 'اختر الموظف'; end if;
    update public.pr_service_requests set assigned_to=p_employee_id,status='scheduled',scheduled_at=now(),updated_at=now() where id=p_request_id;
    insert into public.pr_employee_tasks(employee_id,request_id,title,description,priority,status,created_by)
    values(p_employee_id,r.id,'تنفيذ '||r.service_type,coalesce(r.address,'')||' — '||coalesce(p_note,''),'high','new',auth.uid());
  elsif p_action='start' and r.status='scheduled' then
    update public.pr_service_requests set status='in_progress',started_at=now(),updated_at=now() where id=p_request_id;
  elsif p_action='complete' and r.status='in_progress' then
    update public.pr_service_requests set status='completed',completed_at=now(),final_notes=p_note,updated_at=now() where id=p_request_id;
    update public.pr_employee_tasks set status='completed',updated_at=now()
    where employee_id=r.assigned_to and status<>'completed' and title='تنفيذ '||r.service_type;
  elsif p_action='invoice' and r.status='completed' then
    if exists(select 1 from public.pr_invoices where request_id=r.id and status<>'cancelled') then raise exception 'تم إصدار فاتورة لهذا الطلب'; end if;
    insert into public.pr_invoices(request_id,customer_id,customer_name,phone,description,subtotal,status,notes,created_by)
    values(r.id,r.customer_id,coalesce(r.customer_name,'عميل'),r.customer_phone,r.service_type,
      coalesce(p_amount,r.quoted_total/1.15,0),'unpaid',p_note,auth.uid()) returning id into inv_id;
  else
    raise exception 'الإجراء لا يناسب حالة الطلب الحالية';
  end if;
end;$$;

create or replace function public.pr_sync_task_to_service()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.request_id is not null and new.status is distinct from old.status then
    if new.status='in_progress' then
      update public.pr_service_requests set status='in_progress',started_at=coalesce(started_at,now()),updated_at=now()
      where id=new.request_id and assigned_to=auth.uid() and status='scheduled';
    elsif new.status='completed' then
      update public.pr_service_requests set status='completed',completed_at=now(),updated_at=now()
      where id=new.request_id and assigned_to=auth.uid() and status in('scheduled','in_progress');
    end if;
  end if;
  return new;
end;$$;
drop trigger if exists pr_sync_task_to_service_trigger on public.pr_employee_tasks;
create trigger pr_sync_task_to_service_trigger after update of status on public.pr_employee_tasks
for each row execute function public.pr_sync_task_to_service();

create or replace function public.pr_customer_quote_response(p_quote_id uuid,p_accept boolean,p_note text default null)
returns void language plpgsql security definer set search_path=public as $$
declare req uuid;
begin
  update public.pr_quotations set status=case when p_accept then 'accepted' else 'rejected' end,
    customer_response_note=p_note,responded_at=now(),updated_at=now()
  where id=p_quote_id and customer_id=auth.uid() and status='sent' returning request_id into req;
  if req is null then raise exception 'العرض غير متاح'; end if;
  update public.pr_service_requests set status=case when p_accept then 'approved' else 'reviewing' end,updated_at=now() where id=req;
end;$$;

create or replace function public.pr_record_invoice_payment(p_invoice_id uuid,p_amount numeric,p_method text,p_reference text default null)
returns void language plpgsql security definer set search_path=public as $$
declare total_due numeric; total_paid numeric;
begin
  if not public.pr_has_role(array['admin','accountant']) then raise exception 'غير مصرح'; end if;
  if p_amount<=0 then raise exception 'المبلغ غير صحيح'; end if;
  insert into public.pr_payments(invoice_id,amount,method,reference,received_by)
  values(p_invoice_id,p_amount,p_method,p_reference,auth.uid());
  select i.total,coalesce(sum(p.amount),0) into total_due,total_paid
  from public.pr_invoices i left join public.pr_payments p on p.invoice_id=i.id
  where i.id=p_invoice_id group by i.total;
  update public.pr_invoices set status=case when total_paid>=total_due then 'paid' else 'partially_paid' end,updated_at=now()
  where id=p_invoice_id;
end;$$;

grant execute on function public.pr_admin_workflow(uuid,text,numeric,uuid,text) to authenticated;
grant execute on function public.pr_customer_quote_response(uuid,boolean,text) to authenticated;
grant execute on function public.pr_record_invoice_payment(uuid,numeric,text,text) to authenticated;
grant select on public.pr_invoices,public.pr_payments to authenticated;
notify pgrst,'reload schema';
commit;
