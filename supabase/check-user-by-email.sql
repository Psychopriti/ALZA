-- Cambia el email y ejecuta para confirmar que el usuario existe en Auth
-- y ver qué rol tiene en public.profiles.

select
  auth.users.id,
  auth.users.email,
  auth.users.email_confirmed_at,
  public.profiles.role,
  public.profiles.full_name
from auth.users
left join public.profiles on public.profiles.id = auth.users.id
where lower(auth.users.email) = lower('admin@alza.local');
