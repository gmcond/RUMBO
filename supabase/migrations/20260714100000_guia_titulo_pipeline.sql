-- ============================================================================
-- RUMBO · Fase 3: información viva de la Guía del título + pipeline IA
-- (PRD §M4, §M5 y §6 «Información viva»)
--
-- Principios:
--   · Datos «vivos» con metadatos de verificación (source_url, last_verified_at).
--   · El pipeline (scripts/update-content.ts, service role) SOLO escribe en
--     content_changesets; las tablas públicas las toca únicamente el admin al
--     aprobar, y cada aplicación queda registrada en content_audit_log.
--   · RLS deny-by-default como en el resto del esquema.
-- ============================================================================

-- ── Enums ────────────────────────────────────────────────────────────────────

create type public.convocatoria_estado as enum
  ('prevista', 'inscripcion_abierta', 'cerrada', 'celebrada');
create type public.school_estado as enum ('pending', 'published', 'rejected');
create type public.school_origen as enum ('admin', 'sugerencia');
create type public.changeset_scope as enum
  ('tasas', 'convocatorias', 'normativa', 'escuelas');
create type public.changeset_estado as enum ('pending', 'approved', 'rejected');
create type public.changeset_autor as enum ('ai', 'admin');

-- ── Información viva por CCAA ────────────────────────────────────────────────

create table public.ccaa_info (
  id uuid primary key default gen_random_uuid(),
  degree_id uuid not null references public.degrees (id) on delete cascade,
  ccaa text not null,
  -- {"examen": {"importe_eur": 65.6, "concepto": "..."}, "expedicion": {...}}
  tasas jsonb,
  -- [{"nombre": "...", "ciudad": "..."}]
  sedes jsonb,
  organismo text,
  -- [{"titulo": "...", "url": "https://..."}]
  enlaces jsonb,
  particularidades_md text,
  source_url text,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (degree_id, ccaa)
);

create trigger ccaa_info_set_updated_at
before update on public.ccaa_info
for each row execute function public.set_updated_at();

-- El plazo_inscripcion del PRD se materializa como dos columnas date para
-- poder ordenar y calcular «inscripción abierta» sin parsear texto.
create table public.convocatorias (
  id uuid primary key default gen_random_uuid(),
  degree_id uuid not null references public.degrees (id) on delete cascade,
  ccaa text not null,
  fecha_examen date,
  plazo_inicio date,
  plazo_fin date,
  sede text,
  enlace text,
  estado public.convocatoria_estado not null default 'prevista',
  source_url text,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index convocatorias_ccaa_fecha_idx
  on public.convocatorias (degree_id, ccaa, fecha_examen);

create trigger convocatorias_set_updated_at
before update on public.convocatorias
for each row execute function public.set_updated_at();

-- ── Directorio de escuelas náuticas ──────────────────────────────────────────

-- `estado` gobierna la moderación (solo 'published' es visible); `verificada`
-- es el badge «escuela verificada» del PRD, independiente de la moderación.
create table public.schools (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  ccaa text not null,
  ciudad text not null,
  web text,
  modalidades text[] not null default '{}',
  verificada boolean not null default false,
  estado public.school_estado not null default 'pending',
  origen public.school_origen not null default 'sugerencia',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index schools_estado_ccaa_idx on public.schools (estado, ccaa, ciudad);

create trigger schools_set_updated_at
before update on public.schools
for each row execute function public.set_updated_at();

-- ── Cola de changesets y auditoría (PRD §M5) ─────────────────────────────────

create table public.content_changesets (
  id uuid primary key default gen_random_uuid(),
  scope public.changeset_scope not null,
  ccaa text,
  -- tabla y fila destino; target_id null = el changeset propone crear la fila
  target_table text not null,
  target_id uuid,
  -- diff campo a campo: {"campo": {"old": ..., "new": ..., "source_url": "...", "confidence": 0.9}}
  diff jsonb not null,
  -- [{"url": "...", "titulo": "..."}] — todas las fuentes consultadas
  fuentes jsonb not null default '[]'::jsonb,
  estado public.changeset_estado not null default 'pending',
  created_by public.changeset_autor not null default 'ai',
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index content_changesets_estado_idx
  on public.content_changesets (estado, created_at desc);

create table public.content_audit_log (
  id uuid primary key default gen_random_uuid(),
  tabla text not null,
  registro_id uuid,
  cambio jsonb not null,
  changeset_id uuid references public.content_changesets (id) on delete set null,
  at timestamptz not null default now()
);

create index content_audit_log_tabla_idx on public.content_audit_log (tabla, at desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table public.ccaa_info enable row level security;
alter table public.convocatorias enable row level security;
alter table public.schools enable row level security;
alter table public.content_changesets enable row level security;
alter table public.content_audit_log enable row level security;

create policy "lectura publica" on public.ccaa_info
  for select to anon, authenticated using (true);
create policy "escritura admin" on public.ccaa_info
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "lectura publica" on public.convocatorias
  for select to anon, authenticated using (true);
create policy "escritura admin" on public.convocatorias
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- schools: solo lo publicado es visible; el formulario público de sugerencia
-- puede insertar EXCLUSIVAMENTE filas pendientes sin verificar (moderación).
create policy "lectura publica de publicadas" on public.schools
  for select to anon, authenticated using (estado = 'published' or public.is_admin());
create policy "sugerencia publica en moderacion" on public.schools
  for insert to anon, authenticated
  with check (estado = 'pending' and verificada = false and origen = 'sugerencia');
create policy "escritura admin" on public.schools
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- changesets y auditoría: solo admin (el pipeline usa service role, que
-- salta RLS; jamás se exponen a usuarios normales).
create policy "solo admin" on public.content_changesets
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "solo admin" on public.content_audit_log
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
