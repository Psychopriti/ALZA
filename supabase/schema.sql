create type public.user_role as enum (
  'super_admin',
  'empresa',
  'persona_discapacidad_auditiva',
  'persona_oyente'
);

create type public.plan_audience as enum (
  'persona_oyente',
  'empresa'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null,
  full_name text,
  organization_name text,
  company_seat_label text,
  disability_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plans (
  id text primary key,
  audience public.plan_audience not null,
  name text not null,
  price_usd numeric(8, 2) not null,
  billing_period text not null,
  seats integer,
  discount_label text,
  active boolean not null default true
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  plan_id text references public.plans(id),
  status text not null default 'mock_active',
  mock_transaction_id text,
  created_at timestamptz not null default now()
);

create table public.company_seats (
  id uuid primary key default gen_random_uuid(),
  company_profile_id uuid not null references public.profiles(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  seat_label text not null,
  access_password text not null,
  created_at timestamptz not null default now(),
  unique (company_profile_id, seat_label)
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  summary text not null,
  category text not null,
  audience public.user_role[] not null default array[]::public.user_role[],
  cover_url text,
  published boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  position integer not null,
  content_type text not null default 'lesson' check (content_type in ('lesson', 'exam')),
  video_url text,
  transcript text,
  reading_content text,
  lesson_attachments jsonb,
  exam_question text,
  exam_options jsonb,
  exam_answer text,
  exam_questions jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, position)
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  progress numeric(5, 2) not null default 0,
  streak_days integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, course_id)
);

create table public.lesson_progress (
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
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'super_admin'
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
  disability_identifier text;
begin
  incoming_role := coalesce(
    nullif(new.raw_user_meta_data->>'role', '')::public.user_role,
    'persona_discapacidad_auditiva'::public.user_role
  );
  company_name := nullif(new.raw_user_meta_data->>'organization_name', '');
  full_name := nullif(new.raw_user_meta_data->>'full_name', '');
  disability_identifier := nullif(new.raw_user_meta_data->>'disability_id', '');

  insert into public.profiles (
    id,
    role,
    full_name,
    organization_name,
    company_seat_label,
    disability_id
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
    end,
    case
      when incoming_role = 'persona_discapacidad_auditiva'
      then disability_identifier
      else null
    end
  )
  on conflict (id) do update
    set role = excluded.role,
        full_name = excluded.full_name,
        organization_name = excluded.organization_name,
        company_seat_label = excluded.company_seat_label,
        disability_id = excluded.disability_id,
        updated_at = now();

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.company_seats enable row level security;
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.enrollments enable row level security;
alter table public.lesson_progress enable row level security;

create policy "profiles_select_own_or_admin"
  on public.profiles for select to authenticated
  using (auth.uid() = id or public.is_super_admin());

create policy "profiles_insert_own"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

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

create policy "company_seats_select_own_company_or_admin"
  on public.company_seats for select to anon, authenticated
  using (auth.role() = 'anon' or company_profile_id = auth.uid() or public.is_super_admin());

create policy "company_seats_insert_own_company"
  on public.company_seats for insert to authenticated
  with check (company_profile_id = auth.uid());

create policy "company_seats_delete_own_company_or_admin"
  on public.company_seats for delete to authenticated
  using (company_profile_id = auth.uid() or public.is_super_admin());

create policy "courses_select_published_or_admin"
  on public.courses for select to anon, authenticated
  using (published = true or public.is_super_admin());

create policy "courses_admin_all"
  on public.courses for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "lessons_select_published_courses_or_admin"
  on public.lessons for select to anon, authenticated
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

create policy "enrollments_insert_own"
  on public.enrollments for insert to authenticated
  with check (auth.uid() = profile_id);

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
  ('company-10-accounts', 'empresa', 'Empresa', 8700, 'five_months', 10, '10 cuentas');
