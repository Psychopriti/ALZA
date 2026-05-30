insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-assets',
  'course-assets',
  false,
  524288000,
  null
)
on conflict (id) do update
  set public = false,
      file_size_limit = 524288000,
      allowed_mime_types = null;

drop policy if exists "course_assets_authenticated_select" on storage.objects;
drop policy if exists "course_assets_admin_insert" on storage.objects;
drop policy if exists "course_assets_admin_update" on storage.objects;
drop policy if exists "course_assets_admin_delete" on storage.objects;

create policy "course_assets_authenticated_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'course-assets');

create policy "course_assets_admin_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'course-assets'
    and public.is_super_admin()
  );

create policy "course_assets_admin_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'course-assets'
    and public.is_super_admin()
  )
  with check (
    bucket_id = 'course-assets'
    and public.is_super_admin()
  );

create policy "course_assets_admin_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'course-assets'
    and public.is_super_admin()
  );
