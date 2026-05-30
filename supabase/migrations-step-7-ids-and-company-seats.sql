-- Paso 7: ID para personas con discapacidad auditiva y cuentas bajo empresas.
-- Ejecutar despues de step 6 si el proyecto ya existe.

alter table public.profiles
  add column if not exists disability_id text;

create table if not exists public.company_seats (
  id uuid primary key default gen_random_uuid(),
  company_profile_id uuid not null references public.profiles(id) on delete cascade,
  full_name text not null,
  email text,
  seat_label text not null,
  access_password text not null,
  created_at timestamptz not null default now(),
  unique (company_profile_id, seat_label)
);

alter table public.company_seats
  add column if not exists email text;

create unique index if not exists company_seats_email_key
  on public.company_seats (email)
  where email is not null;

alter table public.company_seats enable row level security;

drop policy if exists "company_seats_select_own_company_or_admin" on public.company_seats;
drop policy if exists "company_seats_insert_own_company" on public.company_seats;
drop policy if exists "company_seats_delete_own_company_or_admin" on public.company_seats;

create policy "company_seats_select_own_company_or_admin"
  on public.company_seats for select to anon, authenticated
  using (auth.role() = 'anon' or company_profile_id = auth.uid() or public.is_super_admin());

create policy "company_seats_insert_own_company"
  on public.company_seats for insert to authenticated
  with check (company_profile_id = auth.uid());

create policy "company_seats_delete_own_company_or_admin"
  on public.company_seats for delete to authenticated
  using (company_profile_id = auth.uid() or public.is_super_admin());

drop policy if exists "lessons_select_published_courses_or_admin" on public.lessons;

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
