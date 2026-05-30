insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-videos',
  'course-videos',
  false,
  524288000,
  array[
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = 524288000,
      allowed_mime_types = excluded.allowed_mime_types;
