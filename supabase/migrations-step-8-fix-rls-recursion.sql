-- Paso 8: corrige recursion de RLS en is_super_admin().
-- Ejecutar si aparece "stack depth limit exceeded" al cargar cursos.

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
  );
$$;

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
