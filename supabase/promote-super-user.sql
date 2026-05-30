-- Promover un usuario existente de Supabase Auth a super admin.
-- 1. Cambia el email de abajo por el correo real del usuario.
-- 2. Ejecuta este archivo en Supabase SQL Editor.
-- 3. Debe devolver una fila con role = super_admin.

with target_user as (
  select id, email
  from auth.users
  where lower(email) = lower('admin@alza.local')
  limit 1
),
upsert_profile as (
  insert into public.profiles (
    id,
    role,
    full_name,
    organization_name,
    updated_at
  )
  select
    id,
    'super_admin'::public.user_role,
    coalesce(split_part(email, '@', 1), 'Super admin'),
    null,
    now()
  from target_user
  on conflict (id) do update
    set role = 'super_admin'::public.user_role,
        updated_at = now()
  returning id, role
)
select
  auth.users.email,
  public.profiles.id,
  public.profiles.role
from public.profiles
join auth.users on auth.users.id = public.profiles.id
where public.profiles.id in (select id from upsert_profile);
