-- Purity Ritual — Unified Employees, Permissions & Tasks Sprint
-- Run this file only. It safely replaces the previous partial permission migrations.
begin;

alter table public.pr_profiles add column if not exists job_title text;
alter table public.pr_profiles add column if not exists permissions text[] not null default '{}';
drop trigger if exists pr_protect_employee_access_trigger on public.pr_profiles;
alter table public.pr_profiles drop constraint if exists pr_profiles_role_check;
alter table public.pr_profiles add constraint pr_profiles_role_check
check (role in ('customer','super_admin','admin','manager','sales','operations','accountant'));

create or replace function public.pr_is_staff()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.pr_profiles
    where id=auth.uid() and is_active=true
      and role in ('super_admin','admin','manager','sales','operations','accountant'));
$$;

create or replace function public.pr_has_role(allowed_roles text[])
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.pr_profiles
    where id=auth.uid() and is_active=true
      and (role='super_admin' or role=any(allowed_roles)));
$$;

update public.pr_profiles set role='super_admin',is_active=true
where id=(select id from auth.users where lower(email)='melnaeema@gmail.com');
update public.pr_profiles set role='customer',permissions='{}'
where id=(select id from auth.users where lower(email)='melnaeem@gmail.com');

create table if not exists public.pr_employee_tasks(
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.pr_profiles(id) on delete cascade,
  title text not null, description text, due_date date,
  priority text not null default 'normal' check(priority in('low','normal','high','urgent')),
  status text not null default 'new' check(status in('new','in_progress','completed','cancelled')),
  created_by uuid not null default auth.uid() references public.pr_profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.pr_employee_tasks enable row level security;

drop policy if exists "profiles own read" on public.pr_profiles;
create policy "profiles own read" on public.pr_profiles for select to authenticated
using(id=auth.uid() or public.pr_is_staff());

drop policy if exists "employees read own tasks" on public.pr_employee_tasks;
create policy "employees read own tasks" on public.pr_employee_tasks for select to authenticated
using(employee_id=auth.uid() or public.pr_has_role(array['super_admin']));
drop policy if exists "employees update own tasks" on public.pr_employee_tasks;
create policy "employees update own tasks" on public.pr_employee_tasks for update to authenticated
using(employee_id=auth.uid() or public.pr_has_role(array['super_admin']))
with check(employee_id=auth.uid() or public.pr_has_role(array['super_admin']));
drop policy if exists "management creates tasks" on public.pr_employee_tasks;
create policy "management creates tasks" on public.pr_employee_tasks for insert to authenticated
with check(public.pr_has_role(array['super_admin']) and created_by=auth.uid());
drop policy if exists "management deletes tasks" on public.pr_employee_tasks;
create policy "management deletes tasks" on public.pr_employee_tasks for delete to authenticated
using(public.pr_has_role(array['super_admin']));

create or replace function public.pr_protect_employee_access()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if (new.role,new.permissions,new.is_active,new.job_title)
     is distinct from (old.role,old.permissions,old.is_active,old.job_title)
     and auth.uid() is not null and not public.pr_has_role(array['super_admin']) then
    raise exception 'Only Super Admin can change employee access';
  end if;
  return new;
end;$$;
create trigger pr_protect_employee_access_trigger before update on public.pr_profiles
for each row execute function public.pr_protect_employee_access();

drop function if exists public.pr_list_employees();
create function public.pr_list_employees()
returns table(id uuid,email text,full_name text,phone text,role text,job_title text,permissions text[],is_active boolean,pending boolean)
language plpgsql security definer set search_path=public,auth as $$
begin
  if not public.pr_has_role(array['super_admin']) then raise exception 'Super Admin only'; end if;
  return query select p.id,u.email::text,p.full_name,p.phone,p.role,p.job_title,p.permissions,p.is_active,
    (p.role='customer' and coalesce(u.raw_user_meta_data->>'account_type','')='employee_pending')
  from public.pr_profiles p join auth.users u on u.id=p.id
  where p.role<>'customer' or coalesce(u.raw_user_meta_data->>'account_type','')='employee_pending'
  order by p.created_at desc;
end;$$;

drop function if exists public.pr_set_employee_access(uuid,text,text,text[],boolean);
create function public.pr_set_employee_access(target_id uuid,new_role text,new_job_title text,new_permissions text[],new_is_active boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.pr_has_role(array['super_admin']) then raise exception 'Super Admin only'; end if;
  if new_role not in ('manager','sales','operations','accountant') then raise exception 'Invalid employee role'; end if;
  update public.pr_profiles set role=new_role,job_title=new_job_title,
    permissions=coalesce(new_permissions,'{}'),is_active=new_is_active,updated_at=now()
  where id=target_id;
  if not found then raise exception 'Employee profile not found'; end if;
end;$$;

grant execute on function public.pr_list_employees() to authenticated;
grant execute on function public.pr_set_employee_access(uuid,text,text,text[],boolean) to authenticated;
grant select,insert,update,delete on public.pr_employee_tasks to authenticated;
create index if not exists pr_employee_tasks_employee_idx on public.pr_employee_tasks(employee_id,status,due_date);

notify pgrst,'reload schema';
commit;
