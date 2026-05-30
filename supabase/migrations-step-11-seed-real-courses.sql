insert into public.courses (title, slug, summary, category, audience, cover_url, published)
values
  (
    'Excel desde cero',
    'excel-desde-cero',
    'Curso introductorio de hojas de cálculo, fórmulas y organización de datos.',
    'Productividad',
    array['empresa', 'persona_discapacidad_auditiva', 'persona_oyente']::public.user_role[],
    null,
    true
  ),
  (
    'Lengua de Señas Nicaragüense',
    'lengua-de-senas-nicaraguense',
    'Curso visual para aprender comunicación básica en lengua de señas nicaragüense.',
    'Comunicación inclusiva',
    array['empresa', 'persona_discapacidad_auditiva', 'persona_oyente']::public.user_role[],
    null,
    true
  )
on conflict (slug) do update
set
  title = excluded.title,
  summary = excluded.summary,
  category = excluded.category,
  audience = excluded.audience,
  cover_url = excluded.cover_url,
  published = excluded.published;

insert into public.lessons (course_id, title, position, content_type, video_url, transcript, reading_content)
select
  courses.id,
  'Bienvenido',
  1,
  'lesson',
  './public/assets/alza-bienvenido.gif',
  '<p><strong>Bienvenido a ALZA.</strong></p><p>Esta es la primera lección del curso. Desde aquí podés reemplazar el contenido por tus videos, textos y recursos.</p>',
  '<p><strong>Bienvenido a ALZA.</strong></p><p>Esta es la primera lección del curso. Desde aquí podés reemplazar el contenido por tus videos, textos y recursos.</p>'
from public.courses
where courses.slug in ('excel-desde-cero', 'lengua-de-senas-nicaraguense')
on conflict (course_id, position) do update
set
  title = excluded.title,
  content_type = excluded.content_type,
  video_url = excluded.video_url,
  transcript = excluded.transcript,
  reading_content = excluded.reading_content;
