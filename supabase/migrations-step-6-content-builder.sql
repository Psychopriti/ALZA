-- Paso 6: contenido administrable real, examenes y planes actualizados.
-- Ejecutar despues de step 1-5 si el proyecto ya existe.

alter table public.lessons
  add column if not exists content_type text not null default 'lesson',
  add column if not exists exam_question text,
  add column if not exists exam_options jsonb,
  add column if not exists exam_answer text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lessons_content_type_check'
  ) then
    alter table public.lessons
      add constraint lessons_content_type_check
      check (content_type in ('lesson', 'exam'));
  end if;
end $$;

update public.plans
set active = false
where id in (
  'listener-monthly',
  'listener-annual',
  'company-5',
  'company-10',
  'company-unlimited'
);

insert into public.plans (id, audience, name, price_usd, billing_period, seats, discount_label, active)
values
  ('listener-5-months', 'persona_oyente', 'Oyente individual', 2500, 'five_months', null, null, true),
  ('company-10-accounts', 'empresa', 'Empresa', 8700, 'five_months', 10, '10 cuentas', true)
on conflict (id) do update
  set name = excluded.name,
      price_usd = excluded.price_usd,
      billing_period = excluded.billing_period,
      seats = excluded.seats,
      discount_label = excluded.discount_label,
      active = true;
