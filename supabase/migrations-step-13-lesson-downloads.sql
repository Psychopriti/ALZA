alter table public.lessons
  add column if not exists lesson_attachments jsonb;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-videos',
  'course-videos',
  false,
  524288000,
  null
)
on conflict (id) do update
  set public = false,
      file_size_limit = 524288000,
      allowed_mime_types = null;
