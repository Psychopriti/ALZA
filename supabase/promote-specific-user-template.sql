-- Cambia SOLO este valor por tu correo real y ejecuta todo.
-- Si devuelve role = super_admin, ya quedó.

do $$
declare
  target_email text := 'TU_CORREO_AQUI@example.com';
  target_id uuid;
begin
  select id
  into target_id
  from auth.users
  where lower(email) = lower(target_email)
  limit 1;

  if target_id is null then
    raise exception 'No existe usuario en auth.users con email: %', target_email;
  end if;

  insert into public.profiles (
    id,
    role,
    full_name,
    organization_name,
    updated_at
  )
  values (
    target_id,
    'super_admin'::public.user_role,
    'Super admin',
    null,
    now()
  )
  on conflict (id) do update
    set role = 'super_admin'::public.user_role,
        updated_at = now();
end $$;

select
  auth.users.email,
  public.profiles.id,
  public.profiles.role
from public.profiles
join auth.users on auth.users.id = public.profiles.id
where lower(auth.users.email) = lower('TU_CORREO_AQUI@example.com');
