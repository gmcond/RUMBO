# RUMBO ⚓

Plataforma web de formación y servicios náuticos (España): estudia el PER con lecciones interactivas, flashcards con repetición espaciada y simulacros de examen configurados por comunidad autónoma; consulta la información viva del título; y, cuando tengas el título, encuentra amarre, embarcación y patrón.

Documentación de producto: [docs/PRD.md](docs/PRD.md) · Reglas de trabajo: [CLAUDE.md](CLAUDE.md)

## Stack

- **Next.js 16** (App Router) + TypeScript estricto
- **Tailwind CSS 4** + shadcn/ui + lucide-react
- **Supabase**: Postgres + Auth + Storage, con RLS deny-by-default en todas las tablas
- **Zod** para validar toda entrada externa · **next-intl** (es, ca)
- **Vitest** (unitario) + **Playwright** (e2e)

## Arranque local

Requisitos: Node 24+, npm 11+, una cuenta de [Supabase](https://supabase.com) con un proyecto creado.

```bash
git clone https://github.com/gmcond/RUMBO.git
cd RUMBO
npm install
cp .env.example .env.local   # y rellena los valores (ver siguiente sección)
```

### 1 · Configurar Supabase

Rellena `.env.local` con los datos de tu proyecto (Dashboard → Project Settings → API):

| Variable                        | Dónde encontrarla                                                          |
| ------------------------------- | -------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Project Settings → API → Project URL                                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → anon public                                       |
| `SUPABASE_SERVICE_ROLE_KEY`     | Project Settings → API → service_role (⚠️ solo servidor, jamás en cliente) |
| `SUPABASE_PROJECT_REF`          | Project Settings → General → Reference ID                                  |
| `NEXT_PUBLIC_SITE_URL`          | `http://localhost:3000` en local                                           |

Autentica la CLI y vincula el proyecto (una sola vez):

```bash
npx supabase login                                  # abre el navegador
npx supabase link --project-ref <tu-project-ref>   # pide la contraseña de la BD
```

Aplica las migraciones, regenera los tipos y siembra el contenido inicial:

```bash
npm run db:migrate   # aplica supabase/migrations/ al proyecto vinculado
npm run db:types     # regenera lib/supabase/database.types.ts desde el esquema
npm run seed         # PER + 11 unidades + exam_config de Cataluña (idempotente)
```

Pasos manuales en el dashboard:

1. **Hook de rol en el JWT** (recomendado): Authentication → Hooks → Custom Access Token → selecciona `public.custom_access_token_hook`. Añade el claim `user_role` al JWT. La app funciona sin él (verifica el rol contra la BD), pero el hook ahorra consultas.
2. **Primer admin**: tras registrarte, en SQL Editor ejecuta
   `update public.profiles set rol = 'admin' where user_id = '<tu-user-id>';`
   (el user id está en Authentication → Users).
3. **Google OAuth** (opcional, la app funciona con email+password): Authentication → Providers → Google, añade el Client ID/Secret de una app OAuth de Google Cloud con redirect `https://<project-ref>.supabase.co/auth/v1/callback`. El botón "Continuar con Google" ya está cableado; no requiere cambios de código.

### 2 · Desarrollo

```bash
npm run dev        # http://localhost:3000
npm run lint       # eslint + prettier
npm run test       # vitest (unitario)
npm run test:e2e   # playwright (requiere: npx playwright install chromium)
npm run build      # build de producción (debe pasar limpio antes de commit)
```

## Comandos de datos

| Comando                  | Qué hace                                                            |
| ------------------------ | ------------------------------------------------------------------- |
| `npm run db:migrate`     | Aplica las migraciones de `supabase/migrations/` al proyecto linked |
| `npm run db:types`       | Regenera los tipos TS desde el esquema remoto                       |
| `npm run seed`           | Siembra PER y PNB (UT compartidas), exam_configs CAT y ccaa_info    |
| `npm run update-content` | Pipeline IA de actualización de información viva (ver abajo)        |

## Pipeline de contenido (`update-content`)

Actualización semi-automática de la información viva de la Guía del título
(PRD §M5). **Nada se publica sin aprobación humana**: el script solo genera
propuestas.

```bash
npm run update-content -- --scope=tasas --ccaa=CAT
npm run update-content -- --scope=convocatorias --ccaa=CAT --degree=pnb
# scopes: tasas | convocatorias | normativa | escuelas
# --ccaa opcional; sin él itera las 19 CCAA (una llamada por CCAA)
# --degree opcional (por defecto per): cualquier titulación sembrada (per, pnb…)
```

Flujo completo:

1. **Extracción** — una llamada a `claude-sonnet-4-6` con la herramienta de
   web search (`web_search_20260318`) restringida por `allowed_domains` a la
   whitelist de fuentes oficiales (BOE, transportes.gob.es y los portales
   autonómicos: gencat para CAT). La restricción se impone a nivel de API,
   no solo de prompt.
2. **Validación** — la respuesta JSON se valida con Zod
   (`lib/validation/content.ts`); cada campo lleva su `source_url` y
   `confidence`. Un campo citado fuera de la whitelist se descarta.
3. **Diff** — se compara con la fila actual de la BD
   (`lib/content-diff.ts`) y, si hay cambios, se inserta un changeset
   `pending` en `content_changesets` (service role), con la titulación en
   `degree_id` (F4). El script **jamás escribe en tablas públicas**.
4. **Revisión** — en `/admin/changesets` se ve el diff campo a campo
   (valor actual → propuesto, con fuente y confianza por campo), editable.
5. **Publicación** — al aprobar, el cambio se aplica a la tabla destino con
   la sesión del admin bajo RLS, se sella `last_verified_at`, se registra en
   `content_audit_log` y se revalidan las páginas públicas. Rechazar deja
   constancia de revisor y fecha.

**Coste por ejecución** (medido el 14/07/2026, scope `tasas` de una CCAA):
**≈ $0,85** (236k tokens de entrada, 5,5k de salida y 6 búsquedas). Esa
ejecución incluyó un reintento de validación hoy ya innecesario (esquema de
sedes tolerante); sin reintento el coste esperable es **~$0,40-0,50 por CCAA**
(~$8-10 si se recorren las 19). El script imprime tokens, búsquedas
($10/1000) y coste estimado al final de cada ejecución.

## Deploy en Vercel

1. En [vercel.com](https://vercel.com) → Add New Project → importa `gmcond/RUMBO` (framework autodetectado: Next.js).
2. En Environment Variables añade las mismas de `.env.local`, cambiando `NEXT_PUBLIC_SITE_URL` por el dominio de producción (p. ej. `https://rumbo.vercel.app`).
3. Deploy. Después, en Supabase → Authentication → URL Configuration:
   - **Site URL**: el dominio de producción.
   - **Redirect URLs**: añade `https://<dominio>/auth/callback` y `https://<dominio>/auth/confirm`.

## Estructura

```
app/(public)/      landing y páginas públicas (SEO)
app/(auth)/        login, registro, onboarding
app/(study)/       área de estudio (protegida por sesión)
app/admin/         panel de administración (protegido por rol)
components/        UI compartida (shadcn en components/ui)
lib/supabase/      clientes tipados (browser, server, admin) y middleware de sesión
content/seed/      manual PER en markdown (fuente del seed)
scripts/           seed.ts, update-content.ts
supabase/          config y migraciones versionadas
docs/PRD.md        documento de producto (fuente de verdad)
```

## Estado del proyecto

- ✅ **Fase 0 — Fundación**: scaffolding, esquema con RLS, auth email+password, landing, seed, CI
- ✅ **Fase 1 — Estudio PER**: lecciones, SRS, diagramas, tests, banco de preguntas
- ✅ **Fase 2 — Simulador + Carta**: simulacros con topes eliminatorios, histórico, trainer de carta
- ✅ **Fase 3 — Guía del título + pipeline IA**: páginas públicas por CCAA, escuelas, changesets con aprobación admin
- ⏳ Fases 4-6 — Multi-titulación y marketplaces

## Licencia y contenido

Contenido de estudio propio, elaborado a partir de fuentes oficiales (BOE, RD 875/2014, RIPA/COLREG). No se copian preguntas ni materiales de academias privadas.
