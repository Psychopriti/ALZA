-- Storage para videos de cursos.
-- Ejecutar después de step 1, step 2 y step 3.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-videos',
  'course-videos',
  false,
  524288000,
  array['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']
)
on conflict (id) do update
  set public = false,
      file_size_limit = 524288000,
      allowed_mime_types = array['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];

drop policy if exists "course_videos_admin_insert" on storage.objects;
drop policy if exists "course_videos_admin_update" on storage.objects;
drop policy if exists "course_videos_admin_delete" on storage.objects;
drop policy if exists "course_videos_authenticated_select" on storage.objects;

create policy "course_videos_authenticated_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'course-videos');

create policy "course_videos_admin_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'course-videos'
    and public.is_super_admin()
  );

create policy "course_videos_admin_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'course-videos'
    and public.is_super_admin()
  )
  with check (
    bucket_id = 'course-videos'
    and public.is_super_admin()
  );

create policy "course_videos_admin_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'course-videos'
    and public.is_super_admin()
  );
