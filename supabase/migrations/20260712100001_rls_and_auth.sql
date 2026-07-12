-- ============================================================================
-- RUMBO · RLS deny-by-default + funciones de auth (PRD §6, CLAUDE.md)
--
-- Principios:
--   · RLS activado en TODAS las tablas; sin policy = sin acceso.
--   · Contenido: lectura pública (questions solo en estado 'published');
--     escritura solo admin.
--   · Datos de usuario: solo el propietario (attempts inmutables).
--   · Admin: public.is_admin() (fuente de verdad en BD) + claim user_role en
--     el JWT vía custom access token hook (para middleware/UI sin round-trip).
-- ============================================================================

-- ── Funciones ────────────────────────────────────────────────────────────────

-- SECURITY DEFINER: evita recursión de RLS al usarse en policies de profiles.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select rol = 'admin'::public.user_role
      from public.profiles
      where user_id = (select auth.uid())
    ),
    false
  );
$$;

-- Crea el perfil al registrarse (bloque 3: onboarding lo completa).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, nombre, degree_objetivo)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'nombre',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    (select id from public.degrees where slug = 'per')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Añade el claim user_role al JWT. Requiere activar el hook
-- "Custom Access Token" en Auth → Hooks (ver README).
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb;
  user_rol text;
begin
  select rol::text into user_rol
  from public.profiles
  where user_id = (event ->> 'user_id')::uuid;

  claims := coalesce(event -> 'claims', '{}'::jsonb);
  claims := jsonb_set(claims, '{user_role}', coalesce(to_jsonb(user_rol), '"user"'::jsonb));
  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
grant usage on schema public to supabase_auth_admin;
grant select on public.profiles to supabase_auth_admin;

-- ── RLS: activar en todas las tablas ─────────────────────────────────────────

alter table public.degrees enable row level security;
alter table public.units enable row level security;
alter table public.degree_units enable row level security;
alter table public.lessons enable row level security;
alter table public.concepts enable row level security;
alter table public.diagrams enable row level security;
alter table public.questions enable row level security;
alter table public.exam_configs enable row level security;
alter table public.profiles enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.srs_cards enable row level security;
alter table public.attempts enable row level security;

-- ── Policies: contenido (lectura pública, escritura admin) ───────────────────

create policy "lectura publica" on public.degrees
  for select to anon, authenticated using (true);
create policy "escritura admin" on public.degrees
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "lectura publica" on public.units
  for select to anon, authenticated using (true);
create policy "escritura admin" on public.units
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "lectura publica" on public.degree_units
  for select to anon, authenticated using (true);
create policy "escritura admin" on public.degree_units
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "lectura publica" on public.lessons
  for select to anon, authenticated using (true);
create policy "escritura admin" on public.lessons
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "lectura publica" on public.concepts
  for select to anon, authenticated using (true);
create policy "escritura admin" on public.concepts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "lectura publica" on public.diagrams
  for select to anon, authenticated using (true);
create policy "escritura admin" on public.diagrams
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- questions: solo las publicadas son públicas; draft/review solo admin
create policy "lectura publica de publicadas" on public.questions
  for select to anon, authenticated using (estado = 'published' or public.is_admin());
create policy "escritura admin" on public.questions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "lectura publica" on public.exam_configs
  for select to anon, authenticated using (true);
create policy "escritura admin" on public.exam_configs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ── Policies: datos de usuario (solo propietario) ────────────────────────────

create policy "perfil propio o admin" on public.profiles
  for select to authenticated using ((select auth.uid()) = user_id or public.is_admin());
create policy "actualiza su perfil" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
-- Sin policy de INSERT/DELETE: el perfil lo crea el trigger (definer) y se
-- borra en cascada con auth.users.

-- El hook de access token corre como supabase_auth_admin y RLS le aplica:
-- necesita su propia policy de lectura.
create policy "auth admin lee perfiles (hook)" on public.profiles
  for select to supabase_auth_admin using (true);

-- El rol NUNCA lo cambia el propio usuario: grants a nivel de columna.
revoke update on public.profiles from authenticated;
grant update (nombre, ccaa_objetivo, degree_objetivo, onboarding_completado)
  on public.profiles to authenticated;

create policy "progreso propio" on public.lesson_progress
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "registra su progreso" on public.lesson_progress
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "borra su progreso" on public.lesson_progress
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "tarjetas propias" on public.srs_cards
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "crea sus tarjetas" on public.srs_cards
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "actualiza sus tarjetas" on public.srs_cards
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "borra sus tarjetas" on public.srs_cards
  for delete to authenticated using ((select auth.uid()) = user_id);

-- attempts: historial inmutable (sin UPDATE ni DELETE)
create policy "intentos propios" on public.attempts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "registra sus intentos" on public.attempts
  for insert to authenticated with check ((select auth.uid()) = user_id);
