-- Purity Ritual — employee permissions and assigned tasks
alter table public.pr_profiles add column if not exists job_title text;
alter table public.pr_profiles add column if not exists permissions text[] not null default '{}';

create table if not exists public.pr_employee_tasks (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.pr_profiles(id) on delete cascade,
  title text not null,
  description text,
  due_date date,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'new' check (status in ('new','in_progress','completed','cancelled')),
  created_by uuid not null default auth.uid() references public.pr_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pr_employee_tasks enable row level security;

drop policy if exists "employees read own tasks" on public.pr_employee_tasks;
create policy "employees read own tasks" on public.pr_employee_tasks for select to authenticated
using (employee_id=auth.uid() or public.pr_has_role(array['admin','manager']));
drop policy if exists "employees update own tasks" on public.pr_employee_tasks;
create policy "employees update own tasks" on public.pr_employee_tasks for update to authenticated
using (employee_id=auth.uid() or public.pr_has_role(array['admin','manager']))
with check (employee_id=auth.uid() or public.pr_has_role(array['admin','manager']));
drop policy if exists "management creates tasks" on public.pr_employee_tasks;
create policy "management creates tasks" on public.pr_employee_tasks for insert to authenticated
with check (public.pr_has_role(array['admin','manager']));
drop policy if exists "management deletes tasks" on public.pr_employee_tasks;
create policy "management deletes tasks" on public.pr_employee_tasks for delete to authenticated
using (public.pr_has_role(array['admin','manager']));

drop policy if exists "profiles management update" on public.pr_profiles;
create policy "profiles management update" on public.pr_profiles for update to authenticated
using (public.pr_has_role(array['admin','manager']))
with check (public.pr_has_role(array['admin','manager']));

grant select,insert,update,delete on public.pr_employee_tasks to authenticated;
grant update(job_title,permissions,is_active,role) on public.pr_profiles to authenticated;
create index if not exists pr_employee_tasks_employee_idx on public.pr_employee_tasks(employee_id,status,due_date);

-- Protect the known customer account from being treated as staff.
update public.pr_profiles set role='customer', permissions='{}'
where id=(select id from auth.users where lower(email)='melnaeem@gmail.com');

-- Keep the owner as administrator.
update public.pr_profiles set role='admin'
where id=(select id from auth.users where lower(email)='melnaeema@gmail.com');

notify pgrst, 'reload schema';
