-- Purity Ritual — Super Admin and reduced employee access
alter table public.pr_profiles drop constraint if exists pr_profiles_role_check;
alter table public.pr_profiles add constraint pr_profiles_role_check
check (role in ('customer','super_admin','admin','manager','sales','operations','accountant'));

-- Super Admin automatically passes every existing role check.
create or replace function public.pr_has_role(allowed_roles text[])
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.pr_profiles
    where id=auth.uid() and is_active=true
      and (role='super_admin' or role = any(allowed_roles))
  );
$$;

-- Only Super Admin can change employee roles and permissions.
drop policy if exists "profiles management update" on public.pr_profiles;
create policy "profiles management update" on public.pr_profiles for update to authenticated
using (public.pr_has_role(array['super_admin']))
with check (public.pr_has_role(array['super_admin']));

create or replace function public.pr_protect_employee_access()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if (new.role, new.permissions, new.is_active, new.job_title)
     is distinct from (old.role, old.permissions, old.is_active, old.job_title)
     and not public.pr_has_role(array['super_admin']) then
    raise exception 'Only Super Admin can change employee access';
  end if;
  return new;
end; $$;
drop trigger if exists pr_protect_employee_access_trigger on public.pr_profiles;
create trigger pr_protect_employee_access_trigger before update on public.pr_profiles
for each row execute function public.pr_protect_employee_access();

-- Only Super Admin can create/delete assigned tasks; staff can update their own task status.
drop policy if exists "management creates tasks" on public.pr_employee_tasks;
create policy "management creates tasks" on public.pr_employee_tasks for insert to authenticated
with check (public.pr_has_role(array['super_admin']) and created_by=auth.uid());
drop policy if exists "management deletes tasks" on public.pr_employee_tasks;
create policy "management deletes tasks" on public.pr_employee_tasks for delete to authenticated
using (public.pr_has_role(array['super_admin']));

create or replace function public.pr_protect_task_assignment()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if not public.pr_has_role(array['super_admin']) and
     (new.employee_id, new.title, new.description, new.due_date, new.priority, new.created_by)
     is distinct from
     (old.employee_id, old.title, old.description, old.due_date, old.priority, old.created_by) then
    raise exception 'Employees can only update task status';
  end if;
  return new;
end; $$;
drop trigger if exists pr_protect_task_assignment_trigger on public.pr_employee_tasks;
create trigger pr_protect_task_assignment_trigger before update on public.pr_employee_tasks
for each row execute function public.pr_protect_task_assignment();

-- Exact account separation.
update public.pr_profiles set role='super_admin', is_active=true
where id=(select id from auth.users where lower(email)='melnaeema@gmail.com');
update public.pr_profiles set role='customer', permissions='{}'
where id=(select id from auth.users where lower(email)='melnaeem@gmail.com');

notify pgrst, 'reload schema';
