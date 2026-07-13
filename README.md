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
| `npm run seed`           | Siembra PER, 11 UT y exam_config CAT desde `content/seed/`          |
| `npm run update-content` | Pipeline IA de actualización (llega en Fase 3)                      |

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
- ⏳ Fase 1 — Estudio PER (lecciones, SRS, diagramas, tests)
- ⏳ Fase 2 — Simulador de examen + trainer de carta
- ⏳ Fase 3 — Guía del título + pipeline IA de contenido
- ⏳ Fases 4-6 — Multi-titulación y marketplaces

## Licencia y contenido

Contenido de estudio propio, elaborado a partir de fuentes oficiales (BOE, RD 875/2014, RIPA/COLREG). No se copian preguntas ni materiales de academias privadas.
