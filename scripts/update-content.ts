/**
 * Pipeline semi-automático de actualización de contenido (PRD §M5).
 *
 *   npm run update-content -- --scope=tasas|convocatorias|normativa|escuelas [--ccaa=CAT]
 *
 * Flujo: (1) consulta SOLO la whitelist de fuentes oficiales — impuesta a
 * nivel de API con allowed_domains, no solo por prompt —, (2) extrae datos
 * estructurados con claude-sonnet-4-6 + web search y los valida con Zod,
 * (3) los compara con la BD y genera un diff campo a campo con cita por
 * campo, (4) guarda un changeset en estado pending para el panel admin.
 *
 * NUNCA escribe en tablas públicas: solo inserta en content_changesets
 * (service role). Publicar es decisión exclusiva del admin (CLAUDE.md).
 */
import { parseArgs } from "node:util";

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { CCAA, CCAA_CODES, type CcaaCode } from "../lib/ccaa";
import { buildChangesetDiff, type ChangesetDiff, type ExtractedField } from "../lib/content-diff";
import { createAdminClient } from "../lib/supabase/admin";
import type { Json } from "../lib/supabase/database.types";
import { extractionResultSchema, type ExtractionResult } from "../lib/validation/content";

const MODEL = "claude-sonnet-4-6"; // fijado en PRD §M5
// Verificado contra la documentación de la API (14/07/2026): la versión
// vigente con filtrado dinámico es web_search_20260318; soportada en Sonnet 4.6.
const WEB_SEARCH_TOOL_TYPE = "web_search_20260318";
const MAX_SEARCHES = 8;
const PRICE_INPUT_PER_MTOK = 3;
const PRICE_OUTPUT_PER_MTOK = 15;
const PRICE_PER_SEARCH = 0.01; // $10 / 1000 búsquedas

const SCOPES = ["tasas", "convocatorias", "normativa", "escuelas"] as const;
type Scope = (typeof SCOPES)[number];

/**
 * Whitelist de fuentes oficiales (PRD §M5). Los dominios van sin esquema
 * (formato de allowed_domains); un dominio cubre sus subdominios, pero los
 * del PRD se listan explícitos para que la lista sea autodocumentada.
 */
const NATIONAL_SOURCES = ["boe.es", "transportes.gob.es"];
const CCAA_SOURCES: Partial<Record<CcaaCode, string[]>> = {
  CAT: ["nautica.gencat.cat", "agricultura.gencat.cat", "dogc.gencat.cat", "gencat.cat"],
};

function allowedDomains(ccaa: CcaaCode): string[] {
  return [...NATIONAL_SOURCES, ...(CCAA_SOURCES[ccaa] ?? [])];
}

function isWhitelisted(url: string, domains: string[]): boolean {
  try {
    const host = new URL(url).hostname;
    return domains.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

// ── Prompts por scope ─────────────────────────────────────────────────────────

const SHAPES: Record<Scope, string> = {
  tasas: `{
  "scope": "tasas",
  "ccaa": "<código>",
  "fields": {
    "tasas": {
      "value": {
        "examen": { "importe_eur": <número>, "concepto": "<denominación oficial de la tasa>" } | null,
        "expedicion": { "importe_eur": <número>, "concepto": "<denominación oficial>" } | null
      },
      "source_url": "<URL exacta de la página oficial donde figura>",
      "confidence": <0-1>
    },
    "sedes": { "value": [{ "nombre": "<sede>", "ciudad": "<ciudad>" | null }], "source_url": "...", "confidence": <0-1> }
  },
  "fuentes": [{ "url": "...", "titulo": "..." }]
}
El campo "sedes" es opcional: inclúyelo solo si la fuente lo detalla.`,
  normativa: `{
  "scope": "normativa",
  "ccaa": "<código>",
  "fields": {
    "organismo": { "value": "<organismo competente para exámenes y expedición>", "source_url": "...", "confidence": <0-1> },
    "particularidades_md": { "value": "<markdown con particularidades de la CCAA (material de examen, plantillas, trámites)>", "source_url": "...", "confidence": <0-1> },
    "enlaces": { "value": [{ "titulo": "...", "url": "..." }], "source_url": "...", "confidence": <0-1> }
  },
  "fuentes": [{ "url": "...", "titulo": "..." }]
}
Todos los campos de "fields" son opcionales: incluye solo los que puedas citar.`,
  convocatorias: `{
  "scope": "convocatorias",
  "ccaa": "<código>",
  "convocatorias": [{
    "fecha_examen": "YYYY-MM-DD" | null,
    "plazo_inicio": "YYYY-MM-DD" | null,
    "plazo_fin": "YYYY-MM-DD" | null,
    "sede": "<sede>" | null,
    "enlace": "<URL de la convocatoria>" | null,
    "estado": "prevista" | "inscripcion_abierta" | "cerrada" | "celebrada",
    "source_url": "<URL exacta>",
    "confidence": <0-1>
  }],
  "fuentes": [{ "url": "...", "titulo": "..." }]
}`,
  escuelas: `{
  "scope": "escuelas",
  "ccaa": "<código>",
  "escuelas": [{
    "nombre": "<nombre oficial>",
    "ciudad": "<ciudad>",
    "web": "<URL>" | null,
    "modalidades": ["presencial" | "online" | "semipresencial"],
    "source_url": "<URL exacta del registro oficial de escuelas homologadas>",
    "confidence": <0-1>
  }],
  "fuentes": [{ "url": "...", "titulo": "..." }]
}`,
};

const SCOPE_BRIEF: Record<Scope, string> = {
  tasas:
    "las tasas oficiales vigentes del examen PER (derechos de examen) y de expedición del título",
  normativa:
    "el organismo competente, particularidades del examen PER y enlaces oficiales de trámites",
  convocatorias:
    "las convocatorias del examen PER del año en curso (fechas de examen, plazos de inscripción, sedes)",
  escuelas: "las escuelas náuticas homologadas que figuren en registros oficiales",
};

function buildPrompt(scope: Scope, ccaa: CcaaCode, domains: string[]): string {
  const ccaaName = CCAA.find((c) => c.code === ccaa)!.name;
  return `Busca ${SCOPE_BRIEF[scope]} para la comunidad autónoma de ${ccaaName} (código "${ccaa}"), España.

Reglas estrictas:
- Consulta ÚNICAMENTE fuentes oficiales; la búsqueda ya está limitada a: ${domains.join(", ")}.
- NO inventes ningún dato. Si un dato no aparece en una fuente oficial, omítelo o usa null.
- Cada campo lleva su "source_url" (la URL exacta de la página donde figura el dato) y una "confidence" entre 0 y 1.
- Importes en euros como número decimal (65.6, no "65,60 €").
- Responde SOLO con un bloque de código JSON válido con exactamente esta forma:

\`\`\`json
${SHAPES[scope]}
\`\`\``;
}

// ── Llamada al modelo (con manejo de pause_turn y reintento de validación) ────

type Usage = { input: number; output: number; searches: number };

function addUsage(total: Usage, usage: Anthropic.Usage): void {
  total.input +=
    usage.input_tokens +
    (usage.cache_creation_input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0);
  total.output += usage.output_tokens;
  total.searches += usage.server_tool_use?.web_search_requests ?? 0;
}

/** Estado de la conversación de extracción que debe sobrevivir entre turnos. */
type Session = { messages: Anthropic.MessageParam[] };

/** Tope de reanudaciones pause_turn: mejor fallar en voz alta que ciclar. */
const MAX_PAUSE_RESUMES = 4;

/**
 * Un turno con streaming: los turnos con muchas búsquedas superan con
 * facilidad el timeout HTTP de una petición no-streaming. El stream además
 * permite mostrar las búsquedas según se lanzan.
 *
 * allowed_callers=["direct"]: búsqueda directa SIN filtrado dinámico. El
 * filtrado dinámico (code execution) demostró ciclarse en este caso de uso
 * (ciclos servidor invisibles + reanudaciones que rebillan el contexto);
 * la búsqueda directa es predecible y el sobrecoste de tokens es menor.
 */
async function runOnce(
  client: Anthropic,
  session: Session,
  domains: string[],
  usage: Usage
): Promise<Anthropic.Message> {
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 8192,
    thinking: { type: "adaptive" },
    messages: session.messages,
    tools: [
      {
        type: WEB_SEARCH_TOOL_TYPE,
        name: "web_search",
        max_uses: MAX_SEARCHES,
        allowed_domains: domains,
        allowed_callers: ["direct"],
        user_location: { type: "approximate", country: "ES", timezone: "Europe/Madrid" },
      } as Anthropic.Messages.ToolUnion,
    ],
  });

  stream.on("contentBlock", (block) => {
    if (block.type === "server_tool_use") {
      const query = (block.input as { query?: string } | null)?.query;
      if (query) console.log(`  · buscando: ${query}`);
    }
  });

  const response = await stream.finalMessage();
  addUsage(usage, response.usage);
  console.log(
    `  · turno: stop=${response.stop_reason} · in=${usage.input} out=${usage.output} ` +
      `· búsquedas=${usage.searches}`
  );
  return response;
}

async function runTurn(
  client: Anthropic,
  session: Session,
  domains: string[],
  usage: Usage
): Promise<Anthropic.Message> {
  let response = await runOnce(client, session, domains, usage);

  // Búsquedas largas: el servidor puede pausar el turno; se reanuda
  // reenviando el mensaje del asistente tal cual (documentación web search).
  for (let resumes = 0; response.stop_reason === "pause_turn"; resumes++) {
    if (resumes >= MAX_PAUSE_RESUMES) {
      throw new Error(
        `El turno sigue en pause_turn tras ${MAX_PAUSE_RESUMES} reanudaciones; se aborta ` +
          "para no consumir tokens en bucle."
      );
    }
    session.messages.push({ role: "assistant", content: response.content });
    response = await runOnce(client, session, domains, usage);
  }

  return response;
}

function extractJson(response: Anthropic.Message): unknown {
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const fenced = /```json\s*([\s\S]*?)```/.exec(text);
  const raw = fenced ? fenced[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(raw);
}

async function extract(
  client: Anthropic,
  scope: Scope,
  ccaa: CcaaCode,
  usage: Usage
): Promise<ExtractionResult> {
  const domains = allowedDomains(ccaa);
  const session: Session = {
    messages: [{ role: "user", content: buildPrompt(scope, ccaa, domains) }],
  };

  let response = await runTurn(client, session, domains, usage);

  for (let attempt = 0; ; attempt++) {
    try {
      return extractionResultSchema.parse(extractJson(response));
    } catch (error) {
      if (attempt >= 1) throw error;
      const detail =
        error instanceof z.ZodError
          ? error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
          : String(error);
      console.warn(`  Respuesta no válida (${detail}); reintentando…`);
      session.messages.push({ role: "assistant", content: response.content });
      session.messages.push({
        role: "user",
        content:
          `Tu respuesta no validó contra el esquema: ${detail}. ` +
          "Devuelve SOLO el bloque de código JSON corregido, sin texto adicional.",
      });
      response = await runTurn(client, session, domains, usage);
    }
  }
}

// ── Generación de changesets por scope ────────────────────────────────────────

type Changeset = {
  scope: Scope;
  ccaa: CcaaCode;
  target_table: "ccaa_info" | "convocatorias" | "schools";
  target_id: string | null;
  diff: ChangesetDiff;
  fuentes: Array<{ url: string; titulo: string }>;
};

/** Descarta campos cuya cita no pertenezca a la whitelist (defensa extra). */
function dropNonWhitelisted(
  fields: Record<string, ExtractedField | undefined>,
  domains: string[]
): Record<string, ExtractedField | undefined> {
  const out: Record<string, ExtractedField | undefined> = {};
  for (const [name, field] of Object.entries(fields)) {
    if (!field) continue;
    if (!isWhitelisted(field.source_url, domains)) {
      console.warn(`  Campo ${name} descartado: fuente fuera de whitelist (${field.source_url})`);
      continue;
    }
    out[name] = field;
  }
  return out;
}

async function buildChangesets(
  supabase: ReturnType<typeof createAdminClient>,
  degreeId: string,
  result: ExtractionResult
): Promise<Changeset[]> {
  const domains = allowedDomains(result.ccaa);
  const fuentes = result.fuentes.filter((f) => isWhitelisted(f.url, domains));

  if (result.scope === "tasas" || result.scope === "normativa") {
    const { data: row, error } = await supabase
      .from("ccaa_info")
      .select("*")
      .eq("degree_id", degreeId)
      .eq("ccaa", result.ccaa)
      .single();
    if (error) throw new Error(`ccaa_info ${result.ccaa}: ${error.message} (¿falta el seed?)`);

    const fields = dropNonWhitelisted(result.fields, domains);

    // Una propuesta de tasas sin ningún importe no aporta nada que revisar.
    const tasasValue = fields.tasas?.value as { examen: unknown; expedicion: unknown } | undefined;
    if (tasasValue && tasasValue.examen === null && tasasValue.expedicion === null) {
      console.warn("  Campo tasas descartado: la fuente no detalla importes.");
      delete fields.tasas;
    }

    const current: Record<string, unknown> = {
      tasas: row.tasas,
      sedes: row.sedes,
      organismo: row.organismo,
      particularidades_md: row.particularidades_md,
      enlaces: row.enlaces,
    };
    const diff = buildChangesetDiff(current, fields);
    if (Object.keys(diff).length === 0) return [];

    return [
      {
        scope: result.scope,
        ccaa: result.ccaa,
        target_table: "ccaa_info",
        target_id: row.id,
        diff,
        fuentes,
      },
    ];
  }

  if (result.scope === "convocatorias") {
    const { data: existing, error } = await supabase
      .from("convocatorias")
      .select("*")
      .eq("degree_id", degreeId)
      .eq("ccaa", result.ccaa);
    if (error) throw new Error(`convocatorias: ${error.message}`);

    const changesets: Changeset[] = [];
    for (const conv of result.convocatorias) {
      if (!isWhitelisted(conv.source_url, domains)) {
        console.warn(`  Convocatoria descartada: fuente fuera de whitelist (${conv.source_url})`);
        continue;
      }
      const match = (existing ?? []).find(
        (row) => row.fecha_examen === conv.fecha_examen && conv.fecha_examen !== null
      );
      const cite = { source_url: conv.source_url, confidence: conv.confidence };
      const fields: Record<string, ExtractedField> = {
        fecha_examen: { value: conv.fecha_examen, ...cite },
        plazo_inicio: { value: conv.plazo_inicio, ...cite },
        plazo_fin: { value: conv.plazo_fin, ...cite },
        sede: { value: conv.sede, ...cite },
        enlace: { value: conv.enlace, ...cite },
        estado: { value: conv.estado, ...cite },
      };
      const diff = buildChangesetDiff(match ?? null, fields);
      if (Object.keys(diff).length === 0) continue;
      changesets.push({
        scope: "convocatorias",
        ccaa: result.ccaa,
        target_table: "convocatorias",
        target_id: match?.id ?? null,
        diff,
        fuentes,
      });
    }
    return changesets;
  }

  // escuelas
  const { data: existing, error } = await supabase
    .from("schools")
    .select("*")
    .eq("ccaa", result.ccaa);
  if (error) throw new Error(`schools: ${error.message}`);

  const changesets: Changeset[] = [];
  for (const school of result.escuelas) {
    if (!isWhitelisted(school.source_url, domains)) {
      console.warn(`  Escuela descartada: fuente fuera de whitelist (${school.source_url})`);
      continue;
    }
    const match = (existing ?? []).find(
      (row) =>
        row.nombre.localeCompare(school.nombre, "es", { sensitivity: "base" }) === 0 &&
        row.ciudad.localeCompare(school.ciudad, "es", { sensitivity: "base" }) === 0
    );
    const cite = { source_url: school.source_url, confidence: school.confidence };
    const diff = buildChangesetDiff(match ?? null, {
      nombre: { value: school.nombre, ...cite },
      ciudad: { value: school.ciudad, ...cite },
      web: { value: school.web, ...cite },
      modalidades: { value: school.modalidades, ...cite },
    });
    if (Object.keys(diff).length === 0) continue;
    changesets.push({
      scope: "escuelas",
      ccaa: result.ccaa,
      target_table: "schools",
      target_id: match?.id ?? null,
      diff,
      fuentes,
    });
  }
  return changesets;
}

// ── CLI ───────────────────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    options: {
      scope: { type: "string" },
      ccaa: { type: "string" },
    },
  });

  const scope = values.scope as Scope | undefined;
  if (!scope || !SCOPES.includes(scope)) {
    console.error(`Uso: npm run update-content -- --scope=${SCOPES.join("|")} [--ccaa=CAT]`);
    process.exit(1);
  }

  let targets: CcaaCode[];
  if (values.ccaa) {
    if (!CCAA_CODES.includes(values.ccaa as CcaaCode)) {
      console.error(`CCAA desconocida: ${values.ccaa}. Válidas: ${CCAA_CODES.join(", ")}`);
      process.exit(1);
    }
    targets = [values.ccaa as CcaaCode];
  } else {
    targets = [...CCAA_CODES];
    console.log(`Sin --ccaa: se procesarán las ${targets.length} CCAA (una llamada por CCAA).`);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Falta ANTHROPIC_API_KEY en el entorno (.env.local)");
    process.exit(1);
  }

  const client = new Anthropic();
  const supabase = createAdminClient();

  const { data: degree, error: degreeError } = await supabase
    .from("degrees")
    .select("id")
    .eq("slug", "per")
    .single();
  if (degreeError) throw new Error(`degrees: ${degreeError.message}`);

  const usage: Usage = { input: 0, output: 0, searches: 0 };
  let created = 0;

  for (const ccaa of targets) {
    console.log(`\n▸ ${scope} · ${ccaa} (fuentes: ${allowedDomains(ccaa).join(", ")})`);

    const result = await extract(client, scope, ccaa, usage);
    if (result.ccaa !== ccaa) {
      console.warn(`  El modelo devolvió ccaa=${result.ccaa}; se fuerza ${ccaa}.`);
      result.ccaa = ccaa;
    }

    const changesets = await buildChangesets(supabase, degree.id, result);
    if (changesets.length === 0) {
      console.log("  Sin cambios respecto a la BD: no se crea changeset.");
      continue;
    }

    for (const changeset of changesets) {
      const { data, error } = await supabase
        .from("content_changesets")
        .insert({
          scope: changeset.scope,
          ccaa: changeset.ccaa,
          target_table: changeset.target_table,
          target_id: changeset.target_id,
          diff: changeset.diff as Json,
          fuentes: changeset.fuentes as Json,
          estado: "pending",
          created_by: "ai",
        })
        .select("id")
        .single();
      if (error) throw new Error(`content_changesets: ${error.message}`);
      created++;
      console.log(
        `  Changeset ${data.id} (${Object.keys(changeset.diff).length} campos → ` +
          `${changeset.target_table}${changeset.target_id ? "" : ", fila nueva"}) en pending.`
      );
    }
  }

  const cost =
    (usage.input / 1_000_000) * PRICE_INPUT_PER_MTOK +
    (usage.output / 1_000_000) * PRICE_OUTPUT_PER_MTOK +
    usage.searches * PRICE_PER_SEARCH;
  console.log(
    `\nResumen: ${created} changeset(s) creados · tokens in=${usage.input} out=${usage.output} · ` +
      `${usage.searches} búsquedas · coste ≈ $${cost.toFixed(3)}`
  );
  console.log("Revísalos en /admin/changesets — nada se publica sin aprobación.");
}

main().catch((error) => {
  console.error("update-content FALLIDO:", error instanceof Error ? error.message : error);
  process.exit(1);
});
