# CLAUDE.md — Proyecto RUMBO

Plataforma web de formación y servicios náuticos (España). Documento de referencia completo: **`docs/PRD.md`** — léelo antes de planificar cualquier fase. Contenido semilla del PER: `content/seed/manual-per.md`.

## Stack

- Next.js 15+ (App Router) + TypeScript estricto (`strict: true`, sin `any` salvo justificado)
- Tailwind CSS + shadcn/ui + lucide-react
- Supabase: Postgres + Auth + Storage. **RLS activado en TODAS las tablas** (deny-by-default)
- Zod para validar toda entrada externa (server actions, route handlers, formularios)
- Vitest (unit) + Playwright (e2e) · i18n con next-intl (es, ca)
- API Anthropic para pipeline de contenido (`scripts/update-content.ts`), modelo `claude-sonnet-4-6`

## Comandos

```bash
npm run dev            # desarrollo
npm run build          # build producción (debe pasar sin warnings antes de commit)
npm run lint           # eslint + prettier
npm run test           # vitest
npm run test:e2e       # playwright
npm run db:migrate     # aplicar migraciones supabase
npm run db:types       # regenerar tipos TS desde el esquema
npm run seed           # sembrar contenido desde content/seed/
npm run update-content # pipeline semi-automático de actualización (genera changesets, NO publica)
```

## Estructura

```
app/(public)/      # landing, guía del título (SEO, SSG/ISR)
app/(auth)/        # login, registro, onboarding
app/(study)/       # lecciones, flashcards, diagramas, tests, simulador, carta
app/(market)/      # amarres, embarcaciones, patrones
app/admin/         # panel: cola de changesets, moderación, banco de preguntas
components/        # UI compartida (shadcn en components/ui)
lib/               # supabase clients, srs.ts, exam-grading.ts, chart-math.ts, i18n
content/seed/      # markdown semilla (manual PER)
scripts/           # seed.ts, update-content.ts
supabase/migrations/
docs/PRD.md
```

## Reglas de trabajo

1. **Planifica antes de codificar** en cada fase: propón el plan, espera confirmación, ejecuta.
2. Commits pequeños con Conventional Commits (`feat:`, `fix:`, `chore:`…). Nunca commitees secretos; usa `.env.local` (hay `.env.example`).
3. La lógica crítica lleva tests unitarios **antes** de darse por terminada: `exam-grading.ts`, `srs.ts`, `chart-math.ts`.
4. Server Components por defecto; `"use client"` solo cuando haga falta interactividad.
5. La `service_role` key de Supabase SOLO en servidor (scripts/route handlers). Jamás en cliente.
6. Móvil primero: diseña a 390 px y escala hacia arriba.
7. Español en la UI (con i18n preparado para catalán). Código y nombres de variables en inglés.

## Reglas de dominio náutico (NO inventar: fuente de verdad)

- **Examen PER Cataluña:** 45 preguntas (4 opciones), 90 min, sin penalización. Distribución UT1→UT11: `[4,2,4,2,5,10,2,3,4,5,4]`. APTO ⇔ aciertos ≥ 32 **y** fallos_UT5 ≤ 2 **y** fallos_UT6 ≤ 5 **y** fallos_UT11 ≤ 2. Blanco = fallo. Config en BD (`exam_configs`), nunca hardcodeada en componentes.
- **SRS:** SM-2 simplificado según PRD §7.2.
- **Carta L105:** dm = 2°50'W (2005), variación 7'E anual; dm_año redondeada al medio grado; Ct = dm + Δ (E positivo, W negativo); Rv = Ra + Ct; Dv = Rv + marcación (estribor +, babor −); ETA = salida + dist/vel; 1 milla = 1852 m.
- Todo contenido náutico nuevo (preguntas, mnemotecnias, datos de CCAA) generado por IA nace con `estado='review'` y **solo el admin lo publica**. Cita siempre `source_url` en datos administrativos.
- No copiar preguntas ni textos de academias privadas (copyright). Fuentes válidas: BOE, webs oficiales (gencat, transportes.gob.es), exámenes publicados por administraciones, y contenido propio del repo.

## Definición de "hecho" (por tarea)

Código tipado sin errores → tests de la lógica tocada en verde → `npm run build` limpio → RLS revisada si hubo cambios de esquema → breve nota en el PR/commit de qué se probó manualmente.
