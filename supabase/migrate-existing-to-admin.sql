-- OBSOLETO: usar los dos archivos por separado:
-- 1) supabase/migrations-step-1-add-super-admin.sql
-- 2) supabase/migrations-step-2-admin-platform.sql
--
-- Postgres no permite agregar un valor de enum y usarlo en la misma transacción.
-- Supabase SQL Editor ejecuta este archivo dentro de una transacción, por eso
-- esta migración monolítica puede fallar.

alter type public.user_role add value if not exists 'super_admin';

do $$
begin
  if not exists (select 1 from pg_type where typname = 'plan_audience') then
    create type public.plan_audience as enum ('persona_oyente', 'empresa');
  end if;
end $$;

alter table public.profiles
  add column if not exists company_seat_label text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.courses
  add column if not exists category text not null default 'General',
  add column if not exists created_by uuid references public.profiles(id),
  add column if not exists updated_at timestamptz not null default now();

alter table public.lessons
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists content_type text not null default 'lesson',
  add column if not exists exam_question text,
  add column if not exists exam_options jsonb,
  add column if not exists exam_answer text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lessons_content_type_check'
  ) then
    alter table public.lessons
      add constraint lessons_content_type_check
      check (content_type in ('lesson', 'exam'));
  end if;
end $$;

alter table public.enrollments
  add column if not exists streak_days integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.plans (
  id text primary key,
  audience public.plan_audience not null,
  name text not null,
  price_usd numeric(8, 2) not null,
  billing_period text not null,
  seats integer,
  discount_label text,
  active boolean not null default true
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  plan_id text references public.plans(id),
  status text not null default 'mock_active',
  mock_transaction_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  unique (enrollment_id, lesson_id)
);

create or replace function public.is_super_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'super_admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  incoming_role public.user_role;
  company_name text;
  full_name text;
begin
  incoming_role := coalesce(
    nullif(new.raw_user_meta_data->>'role', '')::public.user_role,
    'persona_discapacidad_auditiva'::public.user_role
  );
  company_name := nullif(new.raw_user_meta_data->>'organization_name', '');
  full_name := nullif(new.raw_user_meta_data->>'full_name', '');

  insert into public.profiles (
    id,
    role,
    full_name,
    organization_name,
    company_seat_label
  )
  values (
    new.id,
    incoming_role,
    full_name,
    company_name,
    case
      when incoming_role = 'empresa' and company_name is not null and full_name is not null
      then full_name || '-' || company_name
      else null
    end
  )
  on conflict (id) do update
    set role = excluded.role,
        full_name = excluded.full_name,
        organization_name = excluded.organization_name,
        company_seat_label = excluded.company_seat_label,
        updated_at = now();

  return new;
end;
$$;

alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.lesson_progress enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "courses_select_published" on public.courses;
drop policy if exists "lessons_select_from_published_courses" on public.lessons;
drop policy if exists "enrollments_select_own" on public.enrollments;
drop policy if exists "enrollments_update_own" on public.enrollments;

create policy "profiles_select_own_or_admin"
  on public.profiles for select to authenticated
  using (auth.uid() = id or public.is_super_admin());

create policy "profiles_update_own_or_admin"
  on public.profiles for update to authenticated
  using (auth.uid() = id or public.is_super_admin())
  with check (auth.uid() = id or public.is_super_admin());

create policy "plans_select_active"
  on public.plans for select to anon, authenticated
  using (active = true);

create policy "subscriptions_select_own_or_admin"
  on public.subscriptions for select to authenticated
  using (profile_id = auth.uid() or public.is_super_admin());

create policy "subscriptions_insert_own"
  on public.subscriptions for insert to authenticated
  with check (profile_id = auth.uid());

create policy "courses_select_published_or_admin"
  on public.courses for select to anon, authenticated
  using (published = true or public.is_super_admin());

create policy "courses_admin_all"
  on public.courses for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "lessons_select_published_courses_or_admin"
  on public.lessons for select to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.courses
      where courses.id = lessons.course_id
        and courses.published = true
    )
  );

create policy "lessons_admin_all"
  on public.lessons for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "enrollments_select_own_or_admin"
  on public.enrollments for select to authenticated
  using (auth.uid() = profile_id or public.is_super_admin());

create policy "enrollments_update_own_or_admin"
  on public.enrollments for update to authenticated
  using (auth.uid() = profile_id or public.is_super_admin())
  with check (auth.uid() = profile_id or public.is_super_admin());

create policy "lesson_progress_select_own_or_admin"
  on public.lesson_progress for select to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.enrollments
      where enrollments.id = lesson_progress.enrollment_id
        and enrollments.profile_id = auth.uid()
    )
  );

create policy "lesson_progress_upsert_own"
  on public.lesson_progress for all to authenticated
  using (
    exists (
      select 1 from public.enrollments
      where enrollments.id = lesson_progress.enrollment_id
        and enrollments.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.enrollments
      where enrollments.id = lesson_progress.enrollment_id
        and enrollments.profile_id = auth.uid()
    )
  );

insert into public.plans (id, audience, name, price_usd, billing_period, seats, discount_label)
values
  ('listener-5-months', 'persona_oyente', 'Oyente individual', 2500, 'five_months', null, null),
  ('company-10-accounts', 'empresa', 'Empresa', 8700, 'five_months', 10, '10 cuentas')
on conflict (id) do update
  set name = excluded.name,
      price_usd = excluded.price_usd,
      billing_period = excluded.billing_period,
      seats = excluded.seats,
      discount_label = excluded.discount_label,
      active = true;

update public.courses
set category = case
  when slug = 'excel-desde-cero' then 'Productividad'
  when slug = 'lengua-de-senas-nicaraguense' then 'Comunicación inclusiva'
  else category
end;
