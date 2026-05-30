-- Paso 1: ejecutar solo este SQL primero.
-- Luego, cuando Supabase termine, ejecutar el paso 2.

alter type public.user_role add value if not exists 'super_admin';
