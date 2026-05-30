alter table public.lessons
  add column if not exists exam_questions jsonb;
