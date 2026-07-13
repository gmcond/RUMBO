-- F1: slug de lección para URLs limpias (/estudio/per/ut1/el-casco-y-sus-partes).
-- Nullable hasta que el seed lo rellene; único por unidad.

alter table public.lessons
  add column slug text;

create unique index lessons_unit_slug_key on public.lessons (unit_id, slug);
