-- ============================================================================
-- RUMBO · F4: titulación en los changesets (PRD §M5 + §M6)
--
-- Con multi-titulación, un changeset de convocatoria NUEVA (target_id null)
-- no permite recuperar a qué título pertenece al aprobarlo. La columna la
-- fija el pipeline (--degree); en filas antiguas queda null y el admin la
-- resuelve vía target_id o asume PER (todas las filas pre-F4 lo eran).
-- ============================================================================

alter table public.content_changesets
  add column degree_id uuid references public.degrees (id) on delete set null;
