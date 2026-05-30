-- Ejecutar después de step 1 y step 2.
-- Agrega lecciones iniciales a los dos cursos placeholder.

insert into public.lessons (course_id, title, position, video_url, transcript, reading_content)
select
  courses.id,
  seed.title,
  seed.position,
  seed.video_url,
  seed.transcript,
  seed.reading_content
from public.courses
cross join lateral (
  values
    (1, 'Introducción al curso', null::text, 'Bienvenida y objetivos del curso.', 'Bienvenida y objetivos del curso.'),
    (2, 'Práctica guiada', null::text, 'Actividad práctica con apoyo visual.', 'Actividad práctica con apoyo visual.'),
    (3, 'Cierre y repaso', null::text, 'Resumen de aprendizajes y próximos pasos.', 'Resumen de aprendizajes y próximos pasos.')
) as seed(position, title, video_url, transcript, reading_content)
where courses.slug = 'excel-desde-cero'
on conflict (course_id, position) do nothing;

insert into public.lessons (course_id, title, position, video_url, transcript, reading_content)
select
  courses.id,
  seed.title,
  seed.position,
  seed.video_url,
  seed.transcript,
  seed.reading_content
from public.courses
cross join lateral (
  values
    (1, 'Saludos básicos', null::text, 'Aprende saludos cotidianos en lengua de señas.', 'Aprende saludos cotidianos en lengua de señas.'),
    (2, 'Familia y comunidad', null::text, 'Vocabulario visual para personas cercanas y comunidad.', 'Vocabulario visual para personas cercanas y comunidad.'),
    (3, 'Práctica visual', null::text, 'Ejercicios de reconocimiento y repetición.', 'Ejercicios de reconocimiento y repetición.')
) as seed(position, title, video_url, transcript, reading_content)
where courses.slug = 'lengua-de-senas-nicaraguense'
on conflict (course_id, position) do nothing;
