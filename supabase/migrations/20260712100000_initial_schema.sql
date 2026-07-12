-- ============================================================================
-- RUMBO · Migración inicial: tablas de contenido y usuario (PRD §6)
-- ============================================================================

-- ── Enums ────────────────────────────────────────────────────────────────────

create type public.question_origin as enum ('seed', 'oficial', 'ai_generated');
create type public.content_status as enum ('draft', 'review', 'published');
create type public.user_role as enum ('user', 'admin');
create type public.attempt_type as enum ('test', 'simulacro');

-- ── Helper: updated_at automático ────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── Contenido de estudio ─────────────────────────────────────────────────────

create table public.degrees (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nombre text not null,
  descripcion text,
  atribuciones_md text,
  orden int not null default 0,
  created_at timestamptz not null default now()
);

-- Las unidades no cuelgan de una titulación: se comparten vía degree_units
-- (PRD §M6: PNB reutiliza UT1-UT6 del PER).
create table public.units (
  id uuid primary key default gen_random_uuid(),
  numero int not null,
  titulo text not null,
  descripcion text,
  created_at timestamptz not null default now()
);

create table public.degree_units (
  degree_id uuid not null references public.degrees (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  orden int not null,
  primary key (degree_id, unit_id)
);

create index degree_units_unit_idx on public.degree_units (unit_id);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  orden int not null default 0,
  titulo text not null,
  cuerpo_md text not null default '',
  media jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lessons_unit_orden_idx on public.lessons (unit_id, orden);

create trigger lessons_set_updated_at
before update on public.lessons
for each row execute function public.set_updated_at();

create table public.concepts (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  termino text not null,
  definicion text not null,
  imagen text,
  mnemonic text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index concepts_unit_idx on public.concepts (unit_id);

create table public.diagrams (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  titulo text not null,
  svg_path text not null,
  hotspots jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index diagrams_unit_idx on public.diagrams (unit_id);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  enunciado text not null,
  opciones jsonb not null,
  correcta smallint not null,
  explicacion text,
  dificultad smallint,
  origen public.question_origin not null default 'seed',
  estado public.content_status not null default 'draft',
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint questions_opciones_son_4 check (
    jsonb_typeof(opciones) = 'array' and jsonb_array_length(opciones) = 4
  ),
  constraint questions_correcta_en_rango check (correcta between 0 and 3),
  constraint questions_dificultad_en_rango check (dificultad is null or dificultad between 1 and 5)
);

create index questions_unit_idx on public.questions (unit_id);
create index questions_estado_idx on public.questions (estado);

create trigger questions_set_updated_at
before update on public.questions
for each row execute function public.set_updated_at();

-- Config de examen por titulación y CCAA. La corrección se dirige SIEMPRE por
-- esta tabla, nunca por valores hardcodeados (CLAUDE.md, reglas de dominio).
create table public.exam_configs (
  id uuid primary key default gen_random_uuid(),
  degree_id uuid not null references public.degrees (id) on delete cascade,
  ccaa text not null,
  num_preguntas int not null,
  duracion_min int not null,
  min_aciertos int not null,
  -- distribución de preguntas por nº de UT, p. ej. {"1": 4, "2": 2, ...}
  distribucion jsonb not null,
  -- topes de fallos por nº de UT (bloques eliminatorios), p. ej. {"5": 2, "6": 5, "11": 2}
  topes jsonb not null default '{}'::jsonb,
  notas text,
  created_at timestamptz not null default now(),
  unique (degree_id, ccaa)
);

-- ── Usuario y aprendizaje ────────────────────────────────────────────────────

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nombre text,
  ccaa_objetivo text,
  degree_objetivo uuid references public.degrees (id) on delete set null,
  rol public.user_role not null default 'user',
  onboarding_completado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create table public.lesson_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  completado_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table public.srs_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  concept_id uuid references public.concepts (id) on delete cascade,
  question_id uuid references public.questions (id) on delete cascade,
  ease numeric(4, 2) not null default 2.5,
  interval_days numeric(6, 2) not null default 0,
  due_at timestamptz not null default now(),
  reps int not null default 0,
  lapses int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- cada tarjeta apunta a un concepto O a una pregunta, nunca a ambos
  constraint srs_cards_un_solo_objetivo check (num_nonnulls(concept_id, question_id) = 1),
  unique (user_id, concept_id),
  unique (user_id, question_id)
);

create index srs_cards_user_due_idx on public.srs_cards (user_id, due_at);

create trigger srs_cards_set_updated_at
before update on public.srs_cards
for each row execute function public.set_updated_at();

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tipo public.attempt_type not null,
  exam_config_id uuid references public.exam_configs (id) on delete set null,
  respuestas jsonb not null,
  aciertos int not null,
  desglose_por_ut jsonb not null default '{}'::jsonb,
  veredicto text,
  duracion_seg int,
  created_at timestamptz not null default now()
);

create index attempts_user_created_idx on public.attempts (user_id, created_at desc);
