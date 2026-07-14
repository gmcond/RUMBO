# PROMPTS para Claude Code — Proyecto RUMBO

Cómo usar este documento: Claude Code trabaja mucho mejor **por fases cortas y revisables** que con un único mega-prompt. Por eso aquí tienes: (0) la preparación, (1) el prompt de arranque y (2) un prompt por fase. Copia cada prompt cuando toque, revisa el resultado, y no abras la fase siguiente hasta cerrar la anterior.

---

## 0 · Preparación (5 minutos, una sola vez)

1. Crea la carpeta del proyecto y coloca dentro:
   - `CLAUDE.md` (el archivo entregado) en la **raíz**.
   - `docs/PRD.md` (el PRD entregado).
   - `content/seed/manual-per.md` → pega aquí el manual completo de teoría del PER que ya generamos.
2. Ten a mano: cuenta de GitHub, proyecto de Supabase creado (URL + anon key + service key) y una API key de Anthropic (para el pipeline, se usará más adelante).
3. Abre Claude Code en esa carpeta (app de escritorio o `claude` en el terminal).
4. Consejo: usa el **modo plan** (Shift+Tab en el terminal) para las tareas grandes: primero te propone el plan y solo ejecuta cuando lo apruebas.

---

## 1 · PROMPT DE ARRANQUE (Fase 0 — Fundación)

```text
Lee CLAUDE.md y docs/PRD.md enteros antes de hacer nada.

Vamos a construir RUMBO por fases. Empezamos por la FASE 0 (Fundación) tal
como la define el PRD §8. Primero preséntame un plan de ejecución concreto
(archivos, migraciones, decisiones) y espera mi OK antes de escribir código.

Alcance exacto de la Fase 0:
1. Scaffolding: Next.js 15 App Router + TypeScript estricto + Tailwind +
   shadcn/ui + estructura de carpetas del CLAUDE.md. ESLint+Prettier, Vitest
   y Playwright configurados. .env.example con todas las variables.
2. Supabase: cliente server/client tipado, migración inicial con las tablas
   de contenido y usuario del PRD §6 (degrees, units, degree_units, lessons,
   concepts, diagrams, questions, exam_configs, profiles, lesson_progress,
   srs_cards, attempts) con RLS deny-by-default y policies mínimas
   (lectura pública de contenido published, datos de usuario solo owner,
   admin vía claim de rol). Script npm run db:types.
3. Auth: registro/login con email y Google, onboarding mínimo (nombre,
   CCAA objetivo, titulación objetivo = PER por defecto), y perfil creado
   por trigger al registrarse.
4. Layout base: landing pública sencilla explicando el producto, navbar,
   dark mode, página /estudio protegida (placeholder), página /admin
   protegida por rol.
5. Seed inicial: script npm run seed que inserta la titulación PER, sus 11
   unidades (títulos y descripciones desde content/seed/manual-per.md) y el
   exam_config de Cataluña con los valores exactos del CLAUDE.md.
6. CI de GitHub Actions: lint + test + build. README con instrucciones de
   arranque local y deploy en Vercel.

Criterio de cierre (PRD F0): login/logout operativo, migraciones
versionadas, seed ejecutado sin errores y build limpio. Al terminar, dame
un resumen de lo hecho y una checklist de verificación manual para mí.
```

---

## 2 · PROMPT FASE 1 — Módulo de estudio del PER

```text
Fase 0 cerrada. Lee de nuevo docs/PRD.md §M1 y §8-F1. Plan primero, espera
mi OK, después ejecuta.

Alcance Fase 1:
1. Ingesta de contenido: amplía scripts/seed.ts para trocear
   content/seed/manual-per.md en lessons por unidad, y extraer conceptos
   clave de UT1 (nomenclatura) a la tabla concepts con definición y, si
   existe, mnemonic. Genera además un banco inicial de ≥150 preguntas: usa
   las 60+45 del manual semilla (marcadas origen='seed') y crea las
   restantes tú mismo marcadas origen='ai_generated' y estado='review'
   para que yo las apruebe en el admin.
2. Lecciones: /estudio/[degree]/[unidad]/[leccion] con render markdown
   bonito, mini-quiz de 3 preguntas al final, y progreso persistido.
3. Flashcards SRS: implementa lib/srs.ts (SM-2 del PRD §7.2) CON TESTS
   UNITARIOS, sesión de repaso diaria (Otra vez/Difícil/Bien/Fácil),
   mazos por UT y mazo automático "Mis fallos".
4. Diagramas interactivos: componente DiagramViewer que carga un SVG con
   hotspots (jsonb) y soporta modo explorar (clic → nombre+definición) y
   modo juego (te pide una pieza, aciertas/fallas). Crea tú los 2 primeros
   SVG: vista lateral del casco (proa, popa, amura, aleta, obra viva/muerta,
   línea de flotación, roda, codaste, quilla, timón, hélice) y sección de
   dimensiones (eslora, manga, puntal, calado, francobordo). Estilo limpio,
   sin copiar imágenes de terceros.
5. Tests por unidad: /estudio/tests con filtros (por UT, falladas, no
   vistas), corrección con explicación, y registro en attempts.
6. Panel de progreso v1: % por unidad, tarjetas vencidas hoy, últimos tests.
7. Admin: vista simple para aprobar/editar/rechazar preguntas en review.

Criterio de cierre (PRD F1): puedo estudiar UT1 end-to-end
(lección → diagrama → flashcards → test) desde el móvil.
```

---

## 3 · PROMPT FASE 2 — Simulador de examen + Trainer de carta

```text
Lee PRD §M2, §M3, §7.1 y §7.3. Plan primero, espera mi OK.

Alcance Fase 2:
1. lib/exam-grading.ts: corrección de simulacros dirigida por exam_configs
   (distribución, mínimo global, topes por bloque, blanco=fallo). TESTS
   UNITARIOS obligatorios incluyendo los 4 casos límite: apto justo (32),
   no-apto por global, no-apto por tope con 42 aciertos, apto con topes al
   límite exacto (2/5/2).
2. Simulador /estudio/simulacro: selección de config por CCAA (Cataluña por
   defecto), extracción aleatoria respetando la distribución [4,2,4,2,5,10,
   2,3,4,5,4], cronómetro 90 min, marcar preguntas, corrección final con
   desglose por bloque, veredicto explicado e histórico con gráfica de
   evolución (recharts).
3. Modo práctica del simulador con explicación inmediata por pregunta.
4. Trainer de carta v1: lib/chart-math.ts (dm actualizada con redondeo a
   medio grado, Ct, Rv↔Ra, Dv, ETA) con TESTS; generador de ejercicios de
   los 8 tipos del PRD §M3 con datos aleatorios plausibles y resolución
   paso a paso; calculadoras sueltas (dm, Ct, conversor de rumbos, ETA).
5. Semáforo de preparación en el panel: verde/ámbar/rojo por bloque
   eliminatorio según los últimos 3 simulacros.

Criterio de cierre (PRD F2): un simulacro completo cronometrado da
veredicto correcto en los 4 casos límite (verificado por tests).
```

---

## 4 · PROMPT FASE 3 — Guía del título + Pipeline IA semi-automático

```text
Lee PRD §M4, §M5 y §8-F3. Plan primero, espera mi OK. Te pasaré la
ANTHROPIC_API_KEY por variable de entorno cuando toque probar el pipeline.

Alcance Fase 3:
1. Páginas públicas SEO (SSG/ISR): /titulos/per (qué es, atribuciones,
   requisitos, proceso paso a paso) y /titulos/per/[ccaa] con tasas,
   convocatorias, sedes y particularidades desde ccaa_info y convocatorias.
   Cataluña sembrada con los datos del PRD/manual; el resto de CCAA con
   plantilla "pendiente de verificación". Muestra siempre
   "Verificado el {last_verified_at}" y la fuente.
2. Directorio de escuelas /escuelas con filtros por CCAA y ciudad; alta
   manual desde admin + formulario público de sugerencia (entra en
   moderación).
3. Migración: ccaa_info, convocatorias, schools, content_changesets,
   content_audit_log con RLS (público lee published; changesets solo admin).
4. scripts/update-content.ts: CLI con flags --scope y --ccaa que (a) lee la
   whitelist de fuentes del PRD §M5, (b) llama a la API de Anthropic
   (claude-sonnet-4-6 con web search) para extraer datos estructurados
   validados con Zod, (c) compara con BD y genera un changeset con diff
   campo a campo + cita de fuente por campo, (d) lo guarda en estado
   pending. NUNCA escribe en tablas públicas.
5. Panel admin de changesets: ver diff, editar, aprobar (aplica el cambio,
   actualiza last_verified_at, registra en content_audit_log) o rechazar.
6. Documenta en README el flujo completo y el coste estimado por ejecución.

Criterio de cierre (PRD F3): ejecuto npm run update-content --
--scope=tasas --ccaa=CAT, reviso el changeset en el admin, lo apruebo y la
web pública refleja el cambio con fecha de verificación.
```

---

## 5 · PROMPT FASE 4 — Multi-titulación

```text
Lee PRD §M6 y §8-F4. Plan primero.

Alcance: activar la segunda titulación (PNB) reutilizando arquitectura:
1. Verifica que degree_units permite compartir unidades PER↔PNB; siembra
   PNB (unidades UT1-UT6 según temario oficial del RD 875/2014, como
   subconjunto/adaptación del contenido PER ya existente) y su exam_config.
2. Onboarding y toda el área de estudio filtran por titulación activa del
   usuario, con selector para cambiar en cualquier momento.
3. Las páginas públicas /titulos/[degree] funcionan para ambas.

Criterio de cierre (PRD F4): un usuario cambia a PNB y puede estudiar y
simular sin que haya hecho falta código nuevo específico de PNB (solo datos).
```

---

## 6 · PROMPT FASE 4.5 — Rediseño UI (pre-lanzamiento)

```text
Lee PRD §8-F4.5 y §4 (presupuesto de rendimiento). Plan primero.

Fase intermedia antes de F5: rediseño visual para dejar RUMBO listo
para publicarse en un dominio propio.

1. ANTES de tocar código: presenta 2-3 direcciones de arte claramente
   distintas para elegir. Cada una con: nombre y personalidad, paleta
   completa (tokens claro/oscuro), par tipográfico (Google Fonts),
   estilo de componentes (radios, sombras, densidad), tratamiento del
   wordmark RUMBO, y mockup de landing + panel de estudio en ambos
   modos. Evitar el look genérico de plantilla. Espera la elección.
2. Tras la elección: design tokens centralizados (Tailwind/shadcn,
   claro y oscuro) y tipografía global; landing renovada orientada a
   conversión (hero, propuesta de valor, CTA de registro); área de
   estudio pulida (panel, tarjetas, progreso, semáforo, flashcards,
   runner de tests/simulacro, trainer de carta, estados vacíos); guía
   pública /titulos y /escuelas al nuevo estilo; microinteracciones
   sobrias; accesibilidad AA. Checkpoint visual con el product owner
   cuando la landing real esté al nuevo estilo, antes de pintar el
   resto de la app.
3. Restricciones duras: cero cambios de lógica, BD o RLS; e2e en verde
   (ajustar selectores si hace falta, nunca comportamiento);
   mobile-first 390 px; build limpio y LCP móvil dentro del presupuesto.

Criterio de cierre: se puede enseñar RUMBO desde el móvil a un
desconocido y parece un producto publicable, sin regresión funcional.
```

---

## 7 · PROMPT FASE 5 — Marketplaces de amarres y embarcaciones

```text
Lee PRD §M7, §M8 y §8-F5. Plan primero.

Alcance:
1. Migración: ports (siembra inicial con los principales puertos deportivos
   de Cataluña con lat/lng), listings genérico con listing_type, fotos en
   Supabase Storage (bucket privado con URLs firmadas), conversations y
   messages. RLS: listings active son públicos; draft/paused solo owner;
   mensajes solo participantes.
2. /amarres y /barcos: buscador con filtros (tipo, puerto, eslora, precio) y
   mapa Leaflet+OSM con clustering; ficha de anuncio con galería y botón de
   contacto (requiere login) que abre conversación interna.
3. Publicación de anuncio en 3 pasos (datos → fotos → revisión) con
   validación Zod y estado draft hasta moderación.
4. Moderación en admin (aprobar/pausar/eliminar) y motivo al anunciante.
5. Mensajería interna simple (lista de conversaciones + hilo) con
   actualización en tiempo real vía Supabase Realtime.

Criterio de cierre (PRD F5): publico un amarre de prueba, aparece en el
mapa tras moderarlo, y otro usuario me contacta por mensajería.
```

---

## 8 · PROMPT FASE 6 — Servicios de patrón

```text
Lee PRD §M9 y §8-F6, incluida la nota legal. Plan primero.

Alcance:
1. skipper_profiles con subida de documento de titulación a bucket privado;
   badge "Titulación verificada" solo tras aprobación admin; los perfiles
   sin verificar NO se publican.
2. /patrones: directorio con filtros (zona, servicio) y ficha pública con
   servicios, tarifas orientativas y reseñas (solo de usuarios con
   conversación previa con ese patrón).
3. Contacto/solicitud de presupuesto por la mensajería existente.
4. Avisos legales visibles en ficha y en el alta del perfil (texto del PRD
   §M9) + checkbox de declaración responsable del patrón. Página de
   términos y condiciones actualizada.

Criterio de cierre (PRD F6): perfil verificado visible y contactable; el no
verificado no aparece en el directorio.
```

---

## 9 · Consejos de uso de Claude Code para este proyecto

- **Una fase = varias sesiones.** Si una fase es grande, pídele que la divida en tareas y usa `/clear` entre tareas para mantener el contexto limpio; CLAUDE.md se recarga siempre.
- **Revisa los diffs** antes de aceptar cambios grandes, sobre todo migraciones y policies RLS.
- Pídele con frecuencia: *"ejecuta lint, tests y build y arregla lo que falle antes de dar la tarea por cerrada"*.
- Si algo del PRD cambia (lo normal), **edita el PRD y el CLAUDE.md**, no solo el chat: son la memoria del proyecto.
- Para bugs visuales, pega capturas de pantalla directamente en Claude Code: las interpreta muy bien.
- Cuando dudes de una decisión técnica, pídele *"dame 2-3 opciones con pros y contras antes de implementar"*.
- Documentación oficial de Claude Code: https://docs.claude.com/en/docs/claude-code/overview
