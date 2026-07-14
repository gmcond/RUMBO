# PRD — RUMBO · Plataforma de formación y servicios náuticos

**Versión:** 1.0 · **Fecha:** 12/07/2026 · **Autor:** Gerard (con Claude)
**Nombre en clave:** `rumbo` (provisional, fácil de cambiar)

---

## 1. Visión

Rumbo es una plataforma web que acompaña a una persona en todo su ciclo de vida náutico:

1. **Aprender** — estudiar y aprobar las titulaciones náuticas de recreo españolas (empezando por el PER) de forma interactiva, visual y con técnicas de memorización modernas.
2. **Informarse** — toda la información práctica del título: requisitos, precios, convocatorias, escuelas y particularidades por comunidad autónoma, mantenida al día mediante un pipeline de actualización semi-automático con IA.
3. **Navegar** — una vez titulado: encontrar amarre, comprar/alquilar embarcación y contratar (u ofrecer) servicios de patrón.

**Principio rector:** el módulo de estudio del PER es el corazón del producto y debe ser excelente antes que amplio. El resto de módulos se construye sobre una arquitectura pensada desde el día 1 para escalar (multi-título, multi-CCAA, marketplaces).

## 2. Usuarios (personas)

| Persona | Necesidad principal |
|---|---|
| **Estudiante PER** (usuario primario, p. ej. Gerard) | Aprobar el examen teórico de su CCAA con el mínimo esfuerzo y máxima retención |
| **Aspirante indeciso** | Entender qué título necesita, cuánto cuesta, dónde y cómo sacárselo |
| **Titulado que progresa** | Seguir con PY, Capitán de Yate; repasar RIPA/balizamiento |
| **Propietario / buscador de amarre** | Publicar o encontrar amarre por puerto |
| **Comprador / vendedor de embarcación** | Publicar o encontrar barcos en venta/alquiler |
| **Patrón profesional** | Ofrecer servicios (excursiones, traslados de barcos) y ser contratado |
| **Admin (Gerard)** | Curar contenido, aprobar actualizaciones del pipeline IA, moderar anuncios |

## 3. Alcance completo — Módulos

### M1 · Núcleo de estudio (PER primero)

Contenido organizado en **Titulación → Unidades Teóricas (UT) → Lecciones → Conceptos**. Para el PER: las 11 UT oficiales del RD 875/2014. El contenido semilla ya existe (manual generado previamente, `content/seed/manual-per.md`).

**Funcionalidades:**

- **Lecciones interactivas**: texto didáctico + imágenes/diagramas + mini-quiz al final de cada lección. Progreso por lección/UT.
- **Diagramas interactivos SVG** (clave para Nomenclatura, UT1): un velero/lancha en SVG con zonas clicables → al tocar una parte (roda, codaste, obra viva, aleta…) se ilumina y muestra nombre + definición. Modo inverso de juego: "toca la regala" (pregunta → clic). Mínimo 4 diagramas: vista lateral casco, vista cenital cubierta, sección transversal (dimensiones: eslora/manga/puntal/calado/francobordo), timón+hélice. Mismo enfoque para UT5 (marcas de balizamiento) y UT6 (luces de buques: composición visual de luces por tipo de buque).
- **Flashcards con repetición espaciada (SRS)**: algoritmo SM-2 simplificado (estilo Anki). Mazos por UT + mazo "Mis fallos" autogenerado. Tipos de tarjeta: término→definición, imagen→término, luz/marca→significado, regla RIPA→acción.
- **Mnemotecnias**: cada concepto puede tener asociadas una o varias reglas mnemotécnicas (campo `mnemonic` en BD). Ej.: cardinales = reloj (E-3, S-6, O-9, N-continua); "de la carta al timón se resta la corrección". Botón "Genérame otra mnemotecnia" (IA) con posibilidad de guardar la favorita.
- **Juegos de aprendizaje**: emparejar (término↔definición), "verdadero/falso" rápido a contrarreloj, ordena-la-jerarquía (preferencias Regla 18), identifica-la-luz (composición nocturna).
- **Tests por unidad**: preguntas tipo examen (4 opciones, 1 correcta, explicación). Filtros: por UT, solo falladas, no vistas.
- **Panel de progreso**: % por UT, curva de retención SRS, predicción de "preparación para el examen" (semáforo por bloque eliminatorio).

### M2 · Simulador de examen

- Configurable **por comunidad autónoma** (tabla `exam_configs`). Config Cataluña (verificada, por defecto):
  - 45 preguntas, 4 opciones, 90 minutos, sin penalización por fallo.
  - Distribución por UT: **4+2+4+2+5+10+2+3+4+5+4** (UT1…UT11).
  - Aprobado: **≥ 32 aciertos** Y topes eliminatorios: **máx. 2 fallos en UT5 Balizamiento, máx. 5 en UT6 RIPA, máx. 2 en UT11 Carta**.
  - Pregunta en blanco = fallo.
- Cronómetro, navegación entre preguntas, marcar para revisar, corrección final con desglose por bloque y veredicto APTO/NO APTO explicado (incluye el caso "32+ aciertos pero suspenso por tope").
- Modo examen (sin ayudas) y modo práctica (explicación inmediata).
- Histórico de simulacros con evolución.
- Decisiones fijadas en F2:
  - **Reanudación**: la sesión en curso se persiste en el cliente (localStorage: pool completo, respuestas, marcas y **hora de fin absoluta**, nunca un contador) para sobrevivir recargas/cierres en móvil sin regalar tiempo; al volver se ofrece reanudar o descartar, con aviso `beforeunload` al salir. En modo examen el pool guardado no incluye la respuesta correcta.
  - **Cronómetro en práctica**: visible y ascendente (informativo); no hay autoenvío por tiempo. La práctica se registra como attempt `tipo='test'` (sin veredicto en BD, no computa en el semáforo) y su veredicto en pantalla es orientativo, calculado en cliente.
  - **Semáforo de preparación** (panel, sobre los últimos 3 simulacros modo examen, por bloque eliminatorio y mínimo global): rojo si incumple el límite en el último o en 2 de 3; ámbar si lo incumplió en 1 antiguo o va al límite exacto en el último; verde si cumple con margen en todos.

### M3 · Trainer de carta náutica (UT11)

- Ejercicios guiados de los 8 tipos del examen: coordenadas, rumbo+distancia+ETA, corrección total (dm de la carta L105: 2°50'W 2005, variación anual 7'E, redondeo al medio grado), Rv↔Ra, situación por dos demoras, enfilación+demora, rumbo tangente a distancia de un peligro, corriente básica.
- **v1**: generador de ejercicios numéricos con datos aleatorios plausibles + resolución paso a paso (los cálculos se corrigen automáticamente; el trazado se explica con diagramas estáticos).
- **v2 (post-MVP)**: carta interactiva en canvas (imagen de carta de práctica libre de derechos) con trazado real de líneas.
- Calculadoras auxiliares: dm actualizada al año en curso, Ct, conversor Rv/Ra/Dv, ETA.

### M4 · Guía del título (información viva)

- Páginas por titulación: qué es, atribuciones, requisitos, prácticas obligatorias, proceso paso a paso, FAQs.
- **Por comunidad autónoma**: convocatorias del año (fechas, plazos de inscripción), tasas de examen y expedición, sedes, enlaces oficiales, particularidades (p. ej., en Cataluña el anuario de mareas lo aporta el alumno).
- Directorio de **escuelas náuticas** (nombre, ciudad, CCAA, modalidades, web; alta manual + sugerencias de usuarios con moderación).
- Cada dato "vivo" lleva metadatos: `source_url`, `last_verified_at`, `confidence`. La UI muestra "verificado el DD/MM/AAAA".

### M5 · Pipeline de contenido semi-automático (comando + IA)

- Script CLI: `npm run update-content -- --scope=convocatorias|tasas|normativa|escuelas [--ccaa=CAT]`.
- Flujo: (1) el script consulta una **whitelist de fuentes oficiales** (nautica.gencat.cat, agricultura.gencat.cat, transportes.gob.es, boe.es, DOGC y equivalentes autonómicos); (2) un agente con la **API de Anthropic** (modelo `claude-sonnet-4-6`, con herramienta de web search) extrae datos estructurados y los compara con la BD; (3) genera un **changeset** (diff campo a campo con cita de fuente); (4) el changeset entra en la **cola de revisión del panel admin**; (5) Gerard aprueba/edita/rechaza → se publica y se registra en `content_audit_log`.
- **Nada se publica sin aprobación humana.** El agente nunca escribe directamente en tablas públicas.
- El mismo pipeline sirve para proponer nuevas preguntas de test y mnemotecnias (marcadas como `ai_generated: true`, siempre en cola de revisión).

### M6 · Multi-titulación (escalado)

- La titulación es **dato, no código**: `degrees` (LN, PNB, PER, PY, CY) con sus UT, atribuciones y exam_configs. Añadir PY = insertar contenido, no tocar arquitectura.
- Reutilización inteligente: PNB comparte UT1-UT6 parciales con PER; PY añade unidades propias. Modelo de "unidad compartida entre titulaciones" (`degree_units` como tabla puente).
- Roadmap de contenido: PER (completo) → PNB (subconjunto, casi gratis) → PY → CY → Licencia de Navegación.

### M7 · Marketplace de amarres

- Anuncios de **alquiler o venta de amarres**: puerto (tabla `ports` con geodatos), eslora/manga máxima, precio, periodo, fotos, contacto.
- Búsqueda por mapa (Leaflet + OpenStreetMap) y filtros. Ficha de puerto con sus amarres activos.
- Publicación con cuenta verificada (email) + moderación admin. Mensajería interna básica comprador↔anunciante.

### M8 · Marketplace de embarcaciones

- Anuncios de **venta o alquiler** de embarcaciones: tipo, eslora, año, motor, puerto base, precio, fotos, equipamiento.
- Misma infraestructura de anuncios/mensajería/moderación que M7 (módulo `listings` genérico con `listing_type`).

### M9 · Servicios de patrón

- Perfiles profesionales: titulación (con **verificación documental por admin**: badge "titulación verificada"), zona, servicios (excursiones, traslados, clases prácticas), tarifas orientativas, reseñas.
- Solicitud de contacto/presupuesto vía mensajería interna. Sin pasarela de pago en v1 (solo conexión entre partes).
- **⚠️ Nota legal (mostrar en la UI y en T&C):** en España el gobierno remunerado de embarcaciones exige titulación profesional o habilitación profesional específica; el PER recreativo por sí solo no habilita para cobrar. La plataforma solo publica perfiles que declaren titulación habilitante y muestra un aviso de responsabilidad. Verificar normativa vigente en el momento del lanzamiento de este módulo.

## 4. Requisitos no funcionales

- **Idiomas:** español (por defecto) y catalán (i18n con `next-intl`; el contenido de estudio arranca solo en ES, la UI en ES+CA).
- **Mobile-first**: se estudiará mayoritariamente desde el móvil. PWA instalable con modo offline básico para flashcards (post-MVP).
- **SEO**: la Guía del título (M4) es contenido público indexable (App Router, SSG/ISR). El área de estudio requiere login.
- **Accesibilidad** AA razonable; **RGPD**: consentimiento, borrado de cuenta, datos mínimos.
- **Rendimiento**: LCP < 2,5 s en móvil 4G para páginas públicas.
- **Coste contenido IA**: el pipeline se ejecuta bajo demanda (semi-auto), presupuesto acotado por ejecución.

## 5. Stack técnico (decidido)

| Capa | Elección |
|---|---|
| Framework | **Next.js 15+ (App Router) + TypeScript** |
| UI | Tailwind CSS + shadcn/ui + lucide-react; diagramas en SVG propios |
| Backend/BD | **Supabase**: Postgres + Auth (email/OAuth Google) + Storage (fotos anuncios) + **RLS obligatorio** |
| Validación | Zod en todos los inputs (server actions / route handlers) |
| Mapas | Leaflet + OpenStreetMap (módulos M7/M8) |
| IA | API Anthropic (`claude-sonnet-4-6`) para pipeline de contenido, generador de mnemotecnias y tutor de dudas |
| Tests | Vitest (unitario: SRS, corrección de exámenes, cálculos de carta) + Playwright (e2e flujos críticos) |
| Deploy | Vercel (primera opción para Next.js) o Netlify; Supabase cloud |
| Repo | GitHub, commits convencionales, CI con lint+test |

## 6. Modelo de datos (tablas principales)

**Contenido de estudio**
- `degrees` (id, slug, nombre, descripcion, atribuciones_md, orden)
- `units` (id, degree_id*, numero, titulo, descripcion) — *vía `degree_units` si se comparte
- `lessons` (id, unit_id, orden, titulo, cuerpo_md, media[])
- `concepts` (id, unit_id, termino, definicion, imagen, mnemonic, tags[])
- `diagrams` (id, unit_id, titulo, svg_path, hotspots jsonb)
- `questions` (id, unit_id, enunciado, opciones jsonb[4], correcta, explicacion, dificultad, origen enum[seed|oficial|ai_generated], estado enum[draft|review|published], source_url)
- `exam_configs` (id, degree_id, ccaa, num_preguntas, duracion_min, min_aciertos, distribucion jsonb, topes jsonb, notas)

**Usuario y aprendizaje**
- `profiles` (user_id, nombre, ccaa_objetivo, degree_objetivo, rol enum[user|admin])
- `lesson_progress` (user_id, lesson_id, completado_at)
- `srs_cards` (user_id, concept_id/question_id, ease, interval_days, due_at, reps, lapses)
- `attempts` (id, user_id, tipo enum[test|simulacro], exam_config_id, respuestas jsonb, aciertos, desglose_por_ut jsonb, veredicto, duracion, created_at)
  - Shape fijado en F1 — `respuestas`: `[{question_id, unit, elegida: 0-3|null, correcta: 0-3, ok: bool}]`; `desglose_por_ut`: `{"<nºUT>": {aciertos, fallos, total}}`; `veredicto` es `null` en tipo `test` (se usa en simulacros, F2).

**Información viva (M4/M5)**
- `ccaa_info` (id, degree_id, ccaa, tasas jsonb, sedes jsonb, organismo, enlaces jsonb, particularidades_md, source_url, last_verified_at)
- `convocatorias` (id, degree_id, ccaa, fecha_examen, plazo_inicio, plazo_fin, sede, enlace, estado enum[prevista|inscripcion_abierta|cerrada|celebrada], source_url, last_verified_at)
- `schools` (id, nombre, ccaa, ciudad, web, modalidades[], verificada bool, estado enum[pending|published|rejected], origen enum[admin|sugerencia])
- `content_changesets` (id, scope, ccaa, target_table, target_id, diff jsonb, fuentes jsonb, estado enum[pending|approved|rejected], created_by enum[ai|admin], reviewed_by, reviewed_at)
- `content_audit_log` (id, tabla, registro_id, cambio jsonb, changeset_id, at)
- Decisiones fijadas en F3:
  - **Convocatorias**: el `plazo_inscripcion` original se materializa en dos columnas `date` (`plazo_inicio`, `plazo_fin`) para ordenar y calcular "inscripción abierta" sin parsear texto; cada convocatoria lleva sus propios `source_url`/`last_verified_at`.
  - **Escuelas**: `estado` gobierna la moderación (el formulario público inserta `pending` vía RLS y solo `published` es visible); `verificada` queda como badge independiente y `origen` distingue alta manual de sugerencia.
  - **Changesets**: `ccaa`, `target_table` y `target_id` añadidos para poder aplicar el diff al aprobar (`target_id` null = propone crear la fila). `diff` es campo a campo: `{campo: {old, new, source_url, confidence}}`.

**Marketplace (M7/M8/M9)**
- `ports` (id, nombre, ccaa, lat, lng)
- `listings` (id, owner_id, listing_type enum[amarre_alquiler|amarre_venta|barco_venta|barco_alquiler|servicio_patron], titulo, descripcion_md, precio, moneda, port_id, atributos jsonb, fotos[], estado enum[draft|active|paused|sold|removed], moderado bool)
- `skipper_profiles` (user_id, titulaciones jsonb, verificado bool, doc_verificacion_path, zonas[], servicios[], tarifa_orientativa)
- `conversations` (id, listing_id, buyer_id, seller_id) / `messages` (id, conversation_id, sender_id, cuerpo, at)
- `reviews` (id, skipper_id, author_id, rating, comentario, at)

**RLS (principio):** todo lo de usuario es solo-propietario; contenido publicado es lectura pública; `questions/changesets` en estado no-published solo admin; mensajes solo participantes.

## 7. Reglas de negocio críticas (no inventar: usar estas)

1. **Corrección del simulacro (Cataluña):** APTO ⇔ `aciertos ≥ 32` ∧ `fallos_UT5 ≤ 2` ∧ `fallos_UT6 ≤ 5` ∧ `fallos_UT11 ≤ 2`. Blancos cuentan como fallo. Mostrar siempre el motivo del NO APTO.
2. **SRS (SM-2 simplificado):** calificaciones Otra vez/Difícil/Bien/Fácil → `ease` inicial 2,5 (mín. 1,3); intervalos 1d → 3d → `interval×ease`; fallo resetea a 1d y `lapses+1`. Tope de tarjetas nuevas/día configurable (20 por defecto). Tabla exacta por botón (fijada en F1, implementada en `lib/srs.ts` con tests):

   | Botón    | Tarjeta nueva (reps=0) | Repaso                          | ease            | reps      | lapses |
   | -------- | ---------------------- | ------------------------------- | --------------- | --------- | ------ |
   | Otra vez | 1d                     | 1d (reset)                      | −0,20 (mín 1,3) | reset a 0 | +1     |
   | Difícil  | 1d                     | `max(interval×1,2, interval+1)` | −0,15 (mín 1,3) | +1        | —      |
   | Bien     | 1d                     | reps=1 → 3d; después `i×ease`   | sin cambio      | +1        | —      |
   | Fácil    | 3d                     | `interval×ease×1,3`             | +0,15           | +1        | —      |

   Intervalo redondeado a día entero (mín. 1, tope 365); `due_at = now + intervalo`. Fallar una pregunta en quiz/test crea (o reactiva con `lapses+1` y vencimiento inmediato) su tarjeta SRS: así se autogenera el mazo "Mis fallos" (tarjetas de pregunta con `lapses ≥ 1`).
3. **Declinación (trainer de carta):** dm_año = 2°50'W − (año−2005)×7'E, redondeada al medio grado más cercano; Ct = dm + Δ (E=+, W=−); Rv = Ra + Ct; ETA = salida + distancia/velocidad.
4. **Contenido IA:** cualquier cosa generada por IA nace en `estado=review` y jamás se publica sin aprobación admin.
5. **Anuncios:** requieren email verificado; los de servicios de patrón requieren además revisión documental antes de `active`.

## 8. Roadmap de construcción por fases (criterios de aceptación)

**F0 · Fundación (1ª sesión con Claude Code)**
Scaffolding Next.js+TS+Tailwind+shadcn, Supabase (proyecto, migraciones iniciales, RLS base, auth email+Google), layout general (landing, nav, dark mode), CI lint+test, deploy funcionando.
✅ *Login/logout operativo, migraciones versionadas, deploy público.*

**F1 · Estudio PER**
Ingesta del contenido semilla (11 UT desde `content/seed/manual-per.md` → BD vía script), lecciones con progreso, banco de ≥150 preguntas publicadas, tests por UT, flashcards SRS con los conceptos de UT1 completos + resto básico, 2 diagramas SVG interactivos (casco lateral + dimensiones), panel de progreso v1.
✅ *Se puede estudiar UT1 end-to-end: lección → diagrama → flashcards → test.*

**F2 · Simulador + Carta**
Simulador con `exam_configs` (Cataluña sembrada), corrección con topes y desglose, histórico; trainer de carta v1 (generador numérico de los 8 tipos + calculadoras).
✅ *Un simulacro completo cronometrado da veredicto correcto en los 4 casos límite (tests unitarios de la corrección).*

**F3 · Guía del título + Pipeline IA**
Páginas públicas SEO del PER por CCAA (Cataluña con datos reales verificados; resto con plantilla "pendiente de verificar"), directorio de escuelas, panel admin con cola de changesets, comando `update-content` funcionando end-to-end contra fuentes whitelisted.
✅ *Ejecutar el comando genera un changeset revisable y su aprobación actualiza la web con `last_verified_at`.*

**F4 · Multi-título**
Sembrar PNB reutilizando unidades del PER; selector de titulación en onboarding y en toda la app; exam_config PNB.
✅ *Un usuario puede cambiar a PNB y estudiar/simular sin código nuevo.*

**F5 · Marketplaces de amarres y embarcaciones**
Módulo `listings` genérico, mapa de puertos, publicación con fotos (Storage), búsqueda+filtros, mensajería, moderación admin.
✅ *Flujo completo: publicar amarre → aparecer en mapa → recibir mensaje.*

**F6 · Servicios de patrón**
Perfiles, verificación documental, reseñas, avisos legales.
✅ *Perfil verificado visible y contactable; el no verificado no se publica.*

## 9. Monetización (futura, no bloquea el MVP)

Freemium en estudio (X simulacros/mes gratis, ilimitado premium), anuncios destacados en marketplaces, comisión/suscripción a patrones profesionales. Diseñar el esquema de BD sin acoplarlo (campo `plan` en profiles, `featured_until` en listings).

## 10. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| **Copyright de bancos de preguntas** de academias | Usar solo exámenes publicados por administraciones públicas + preguntas propias/IA revisadas. Nunca copiar tests de academias privadas. |
| Precisión normativa (tasas, fechas cambian) | Metadatos de verificación + pipeline semi-auto + disclaimers "verificado el…". |
| Huevo-gallina en marketplaces | Lanzar M7-M9 tras tener tráfico del módulo de estudio; sembrar con puertos catalanes. |
| Legalidad servicios de patrón | Verificación documental + avisos; consultar asesoría antes de activar M9 en público. |
| Scope creep | Este PRD manda; cada fase se cierra con sus criterios ✅ antes de abrir la siguiente. |
| Coste API IA | Pipeline bajo demanda con límites; generación de mnemotecnias cacheada. |

## 11. Fuera de alcance v1

Pasarela de pagos, app nativa, prácticas/radio (solo se informa), foro/comunidad, multi-idioma completo del contenido de estudio (solo ES en v1), exámenes de otras CCAA con datos verificados (plantilla sí, verificación progresiva).
