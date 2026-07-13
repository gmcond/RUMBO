/**
 * Seed de RUMBO (Fases 0 y 1):
 *   - Titulación PER, sus 11 unidades y el exam_config de Cataluña (F0)
 *   - Lecciones por UT troceadas del manual (F1)
 *   - Conceptos curados (content/seed/concepts.json) (F1)
 *   - Banco de preguntas: 105 del manual (origen seed, published) +
 *     extra generadas por IA (origen ai_generated, estado review) (F1)
 *   - Los 2 diagramas interactivos de UT1 (F1)
 *
 * Idempotente: upserts o diff por clave natural; puede ejecutarse tantas
 * veces como haga falta. Las preguntas ya existentes NO se tocan (respeta
 * las decisiones del admin sobre estado/edición).
 * Ejecutar con: npm run seed  (requiere .env.local con SUPABASE_SERVICE_ROLE_KEY)
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { z } from "zod";

import { createAdminClient } from "../lib/supabase/admin";
import type { Database } from "../lib/supabase/database.types";
import {
  parseBateria,
  parseLessons,
  parseSimulacro,
  type ParsedLesson,
  type ParsedQuestion,
} from "./seed-parsers";

type ConceptInsert = Database["public"]["Tables"]["concepts"]["Insert"];
type QuestionInsert = Database["public"]["Tables"]["questions"]["Insert"];

const SEED_DIR = path.join(process.cwd(), "content", "seed");
const MANUAL_PATH = path.join(SEED_DIR, "manual-per.md");

// CLAUDE.md (reglas de dominio): 45 preguntas, 90 min, APTO ⇔ aciertos ≥ 32
// y fallos_UT5 ≤ 2 y fallos_UT6 ≤ 5 y fallos_UT11 ≤ 2. Blanco = fallo.
const EXAM_CONFIG_CAT = {
  ccaa: "CAT",
  num_preguntas: 45,
  duracion_min: 90,
  min_aciertos: 32,
  distribucion: { 1: 4, 2: 2, 3: 4, 4: 2, 5: 5, 6: 10, 7: 2, 8: 3, 9: 4, 10: 5, 11: 4 },
  topes: { 5: 2, 6: 5, 11: 2 },
  notas:
    "Sin penalización por fallo; pregunta en blanco cuenta como fallo. " +
    "Distribución y topes según Anexo II del RD 875/2014 (BOE-A-2014-10344). " +
    "El tribunal entrega la carta L105; el anuario de mareas lo aporta el alumno.",
} as const;

const PER_DEGREE = {
  slug: "per",
  nombre: "Patrón de Embarcaciones de Recreo (PER)",
  descripcion:
    "Habilita para el gobierno de embarcaciones de recreo a motor de hasta 15 metros de " +
    "eslora y navegación hasta 12 millas de la costa (zona 4), ampliable a travesía " +
    "Península–Baleares y a vela con las prácticas complementarias.",
  atribuciones_md:
    "Según el art. 8 del RD 875/2014: gobierno de embarcaciones de recreo a motor de " +
    "hasta 15 m de eslora, para navegar entre la costa y una línea paralela trazada a " +
    "12 millas de ésta (zona 4). Con la práctica de navegación complementaria se habilita " +
    "la travesía Península–Baleares; con la práctica de vela, las atribuciones a vela. " +
    "Edad mínima: 18 años.",
  orden: 3,
} as const;

// Definiciones de los hotspots tomadas del manual (UT1.1-1.4).
type DiagramSeed = {
  unitNumero: number;
  titulo: string;
  svg_path: string;
  hotspots: Array<{ id: string; termino: string; definicion: string }>;
};

const DIAGRAMS: DiagramSeed[] = [
  {
    unitNumero: 1,
    titulo: "Vista lateral del casco",
    svg_path: "/diagrams/casco-lateral.svg",
    hotspots: [
      { id: "proa", termino: "Proa", definicion: "Parte delantera de la embarcación, la que corta el agua." },
      { id: "popa", termino: "Popa", definicion: "Parte trasera de la embarcación." },
      { id: "amura", termino: "Amura", definicion: "Zona curva del costado próxima a la proa." },
      { id: "aleta", termino: "Aleta", definicion: "Zona curva del costado próxima a la popa." },
      { id: "obra-viva", termino: "Obra viva", definicion: "Parte sumergida del casco, también llamada carena." },
      { id: "obra-muerta", termino: "Obra muerta", definicion: "Parte del casco que emerge del agua." },
      { id: "linea-flotacion", termino: "Línea de flotación", definicion: "Línea que marca el agua sobre el casco; separa la obra viva de la obra muerta." },
      { id: "roda", termino: "Roda", definicion: "Pieza que prolonga la quilla hacia proa." },
      { id: "codaste", termino: "Codaste", definicion: "Pieza que prolonga la quilla hacia popa." },
      { id: "quilla", termino: "Quilla", definicion: "Viga longitudinal inferior, la columna vertebral del barco." },
      { id: "timon", termino: "Timón", definicion: "Órgano de gobierno: la mecha es su eje y la pala la superficie que desvía el agua." },
      { id: "helice", termino: "Hélice", definicion: "Propulsor del barco; su paso es el avance teórico en una vuelta completa." },
    ],
  },
  {
    unitNumero: 1,
    titulo: "Sección de dimensiones",
    svg_path: "/diagrams/dimensiones.svg",
    hotspots: [
      { id: "eslora", termino: "Eslora", definicion: "Longitud del barco de proa a popa." },
      { id: "manga", termino: "Manga", definicion: "Anchura máxima del barco." },
      { id: "puntal", termino: "Puntal", definicion: "Altura desde la quilla hasta la cubierta." },
      { id: "calado", termino: "Calado", definicion: "Profundidad de la obra viva: de la flotación al punto más bajo de la quilla." },
      { id: "francobordo", termino: "Francobordo", definicion: "Altura desde la flotación hasta la cubierta." },
    ],
  },
];

const conceptSchema = z.object({
  unit: z.number().int().min(1).max(11),
  termino: z.string().min(2),
  definicion: z.string().min(10),
  mnemonic: z.string().min(5).optional(),
  tags: z.array(z.string()).default([]),
});

const extraQuestionSchema = z.object({
  unit: z.number().int().min(1).max(11),
  enunciado: z.string().min(10),
  opciones: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1), z.string().min(1)]),
  correcta: z.number().int().min(0).max(3),
  explicacion: z.string().min(10),
  dificultad: z.number().int().min(1).max(5).optional(),
});

type SeedConcept = z.infer<typeof conceptSchema>;
type ExtraQuestion = z.infer<typeof extraQuestionSchema>;

type ParsedUnit = { numero: number; titulo: string; descripcion: string };

/** Extrae de manual-per.md las cabeceras `## UTn — Título` y su primer párrafo. */
export function parseUnits(markdown: string): ParsedUnit[] {
  const lines = markdown.split(/\r?\n/);
  const units: ParsedUnit[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = /^## UT(\d+) — (.+)$/.exec(lines[i]);
    if (!match) continue;

    // primer párrafo no vacío tras la cabecera = descripción de la unidad
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === "") j++;
    const paragraph: string[] = [];
    while (j < lines.length && lines[j].trim() !== "" && !lines[j].startsWith("#")) {
      paragraph.push(lines[j].trim());
      j++;
    }

    units.push({
      numero: Number(match[1]),
      titulo: match[2].trim(),
      descripcion: paragraph.join(" "),
    });
  }

  return units;
}

function assertSeedInvariants(
  units: ParsedUnit[],
  lessons: ParsedLesson[],
  concepts: SeedConcept[],
  manualQuestions: ParsedQuestion[],
  extraQuestions: ExtraQuestion[]
) {
  const numeros = units.map((u) => u.numero);
  const expected = Array.from({ length: 11 }, (_, i) => i + 1);

  if (JSON.stringify(numeros) !== JSON.stringify(expected)) {
    throw new Error(`Se esperaban las UT 1..11 en orden; encontradas: ${numeros.join(", ")}`);
  }
  for (const u of units) {
    if (!u.titulo || !u.descripcion) {
      throw new Error(`UT${u.numero} sin título o descripción`);
    }
  }

  const totalDistribucion = Object.values(EXAM_CONFIG_CAT.distribucion).reduce((a, b) => a + b, 0);
  if (totalDistribucion !== EXAM_CONFIG_CAT.num_preguntas) {
    throw new Error(
      `La distribución suma ${totalDistribucion}, no ${EXAM_CONFIG_CAT.num_preguntas}`
    );
  }

  // F1: cobertura mínima del módulo de estudio (PRD §8-F1)
  for (const numero of expected) {
    if (!lessons.some((l) => l.unitNumero === numero)) {
      throw new Error(`UT${numero} sin lecciones parseadas`);
    }
  }
  const conceptosUt1 = concepts.filter((c) => c.unit === 1).length;
  if (conceptosUt1 < 25) {
    throw new Error(`UT1 necesita sus conceptos completos (≥25); hay ${conceptosUt1}`);
  }
  if (manualQuestions.length !== 105) {
    throw new Error(`Se esperaban 105 preguntas del manual (60+45); hay ${manualQuestions.length}`);
  }
  const totalQuestions = manualQuestions.length + extraQuestions.length;
  if (totalQuestions < 150) {
    throw new Error(`El banco necesita ≥150 preguntas; hay ${totalQuestions}`);
  }
}

async function seedLessons(
  supabase: ReturnType<typeof createAdminClient>,
  unitIdByNumero: Map<number, string>,
  lessons: ParsedLesson[]
) {
  const rows = lessons.map((l) => {
    const unit_id = unitIdByNumero.get(l.unitNumero);
    if (!unit_id) throw new Error(`UT${l.unitNumero} sin id para la lección ${l.slug}`);
    return { unit_id, slug: l.slug, orden: l.orden, titulo: l.titulo, cuerpo_md: l.cuerpoMd };
  });

  const { error } = await supabase.from("lessons").upsert(rows, { onConflict: "unit_id,slug" });
  if (error) throw new Error(`lessons: ${error.message}`);
  console.log(`Lecciones sembradas: ${rows.length}`);
}

async function seedConcepts(
  supabase: ReturnType<typeof createAdminClient>,
  unitIdByNumero: Map<number, string>,
  concepts: SeedConcept[]
) {
  const { data: existing, error: readError } = await supabase
    .from("concepts")
    .select("id, unit_id, termino");
  if (readError) throw new Error(`concepts (lectura): ${readError.message}`);

  const existingByKey = new Map((existing ?? []).map((c) => [`${c.unit_id}/${c.termino}`, c.id]));
  const inserts: ConceptInsert[] = [];
  let updates = 0;

  for (const c of concepts) {
    const unit_id = unitIdByNumero.get(c.unit);
    if (!unit_id) throw new Error(`UT${c.unit} sin id para el concepto ${c.termino}`);

    const row = {
      unit_id,
      termino: c.termino,
      definicion: c.definicion,
      mnemonic: c.mnemonic ?? null,
      tags: c.tags,
    };
    const existingId = existingByKey.get(`${unit_id}/${c.termino}`);
    if (existingId) {
      const { error } = await supabase.from("concepts").update(row).eq("id", existingId);
      if (error) throw new Error(`concepts ${c.termino}: ${error.message}`);
      updates++;
    } else {
      inserts.push(row);
    }
  }

  if (inserts.length > 0) {
    const { error } = await supabase.from("concepts").insert(inserts);
    if (error) throw new Error(`concepts (insert): ${error.message}`);
  }
  console.log(`Conceptos: ${inserts.length} nuevos, ${updates} actualizados`);
}

async function seedQuestions(
  supabase: ReturnType<typeof createAdminClient>,
  unitIdByNumero: Map<number, string>,
  manualQuestions: ParsedQuestion[],
  extraQuestions: ExtraQuestion[]
) {
  const { data: existing, error: readError } = await supabase
    .from("questions")
    .select("unit_id, enunciado");
  if (readError) throw new Error(`questions (lectura): ${readError.message}`);
  const existingKeys = new Set((existing ?? []).map((q) => `${q.unit_id}/${q.enunciado}`));

  const rows: QuestionInsert[] = [];

  for (const q of manualQuestions) {
    const unit_id = unitIdByNumero.get(q.unitNumero);
    if (!unit_id) throw new Error(`UT${q.unitNumero} sin id (pregunta manual ${q.numero})`);
    if (existingKeys.has(`${unit_id}/${q.enunciado}`)) continue;
    rows.push({
      unit_id,
      enunciado: q.enunciado,
      opciones: q.opciones,
      correcta: q.correcta,
      explicacion: q.explicacion,
      origen: "seed",
      // Contenido propio del manual semilla → publicado directamente.
      estado: "published",
    });
  }

  for (const q of extraQuestions) {
    const unit_id = unitIdByNumero.get(q.unit);
    if (!unit_id) throw new Error(`UT${q.unit} sin id (pregunta extra)`);
    if (existingKeys.has(`${unit_id}/${q.enunciado}`)) continue;
    rows.push({
      unit_id,
      enunciado: q.enunciado,
      opciones: q.opciones,
      correcta: q.correcta,
      explicacion: q.explicacion,
      dificultad: q.dificultad ?? null,
      origen: "ai_generated",
      // PRD §7.4: lo generado por IA nace en review y lo publica el admin.
      estado: "review",
    });
  }

  for (let i = 0; i < rows.length; i += 50) {
    const { error } = await supabase.from("questions").insert(rows.slice(i, i + 50));
    if (error) throw new Error(`questions (insert): ${error.message}`);
  }
  console.log(
    `Preguntas: ${rows.length} insertadas (${existingKeys.size} ya existían y no se tocan)`
  );
}

async function seedDiagrams(
  supabase: ReturnType<typeof createAdminClient>,
  unitIdByNumero: Map<number, string>
) {
  const { data: existing, error: readError } = await supabase
    .from("diagrams")
    .select("id, unit_id, titulo");
  if (readError) throw new Error(`diagrams (lectura): ${readError.message}`);
  const existingByKey = new Map((existing ?? []).map((d) => [`${d.unit_id}/${d.titulo}`, d.id]));

  for (const d of DIAGRAMS) {
    const unit_id = unitIdByNumero.get(d.unitNumero);
    if (!unit_id) throw new Error(`UT${d.unitNumero} sin id para el diagrama ${d.titulo}`);

    const row = { unit_id, titulo: d.titulo, svg_path: d.svg_path, hotspots: d.hotspots };
    const existingId = existingByKey.get(`${unit_id}/${d.titulo}`);
    if (existingId) {
      const { error } = await supabase.from("diagrams").update(row).eq("id", existingId);
      if (error) throw new Error(`diagrams ${d.titulo}: ${error.message}`);
    } else {
      const { error } = await supabase.from("diagrams").insert(row);
      if (error) throw new Error(`diagrams ${d.titulo}: ${error.message}`);
    }
  }
  console.log(`Diagramas sembrados: ${DIAGRAMS.length}`);
}

async function main() {
  const markdown = readFileSync(MANUAL_PATH, "utf8");
  const units = parseUnits(markdown);
  const lessons = parseLessons(markdown);
  const manualQuestions = [...parseBateria(markdown), ...parseSimulacro(markdown)];
  const concepts = z
    .array(conceptSchema)
    .parse(JSON.parse(readFileSync(path.join(SEED_DIR, "concepts.json"), "utf8")));
  const extraQuestions = z
    .array(extraQuestionSchema)
    .parse(JSON.parse(readFileSync(path.join(SEED_DIR, "questions-extra.json"), "utf8")));

  assertSeedInvariants(units, lessons, concepts, manualQuestions, extraQuestions);
  console.log(
    `Manual parseado: ${units.length} unidades, ${lessons.length} lecciones, ` +
      `${manualQuestions.length}+${extraQuestions.length} preguntas, ${concepts.length} conceptos`
  );

  const supabase = createAdminClient();

  // 1 · Titulación PER
  const { data: degree, error: degreeError } = await supabase
    .from("degrees")
    .upsert(PER_DEGREE, { onConflict: "slug" })
    .select("id")
    .single();
  if (degreeError) throw new Error(`degrees: ${degreeError.message}`);
  console.log(`Degree PER: ${degree.id}`);

  // 2 · Unidades + vínculo degree_units (idempotente vía nº de UT dentro del PER)
  const { data: existingLinks, error: linksError } = await supabase
    .from("degree_units")
    .select("unit_id")
    .eq("degree_id", degree.id);
  if (linksError) throw new Error(`degree_units: ${linksError.message}`);

  const linkedIds = (existingLinks ?? []).map((link) => link.unit_id);
  const unitIdByNumero = new Map<number, string>();
  if (linkedIds.length > 0) {
    const { data: linkedUnits, error: unitsError } = await supabase
      .from("units")
      .select("id, numero")
      .in("id", linkedIds);
    if (unitsError) throw new Error(`units: ${unitsError.message}`);
    for (const u of linkedUnits ?? []) unitIdByNumero.set(u.numero, u.id);
  }

  for (const unit of units) {
    const existingId = unitIdByNumero.get(unit.numero);

    if (existingId) {
      const { error } = await supabase
        .from("units")
        .update({ titulo: unit.titulo, descripcion: unit.descripcion })
        .eq("id", existingId);
      if (error) throw new Error(`units UT${unit.numero}: ${error.message}`);
      console.log(`UT${unit.numero} actualizada: ${unit.titulo}`);
    } else {
      const { data: inserted, error } = await supabase
        .from("units")
        .insert({ numero: unit.numero, titulo: unit.titulo, descripcion: unit.descripcion })
        .select("id")
        .single();
      if (error) throw new Error(`units UT${unit.numero}: ${error.message}`);

      const { error: linkError } = await supabase
        .from("degree_units")
        .insert({ degree_id: degree.id, unit_id: inserted.id, orden: unit.numero });
      if (linkError) throw new Error(`degree_units UT${unit.numero}: ${linkError.message}`);
      unitIdByNumero.set(unit.numero, inserted.id);
      console.log(`UT${unit.numero} creada: ${unit.titulo}`);
    }
  }

  // 3 · exam_config Cataluña
  const { error: configError } = await supabase
    .from("exam_configs")
    .upsert({ degree_id: degree.id, ...EXAM_CONFIG_CAT }, { onConflict: "degree_id,ccaa" });
  if (configError) throw new Error(`exam_configs: ${configError.message}`);
  console.log("exam_config CAT sembrado (45 preguntas / 90 min / ≥32 / topes 2-5-2)");

  // 4 · Contenido de estudio (F1)
  await seedLessons(supabase, unitIdByNumero, lessons);
  await seedConcepts(supabase, unitIdByNumero, concepts);
  await seedQuestions(supabase, unitIdByNumero, manualQuestions, extraQuestions);
  await seedDiagrams(supabase, unitIdByNumero);

  console.log("Seed completado sin errores ✔");
}

// tsx ejecuta este archivo directamente; el guard evita que corra al importarlo en tests
if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/seed.ts")) {
  main().catch((error) => {
    console.error("Seed FALLIDO:", error.message ?? error);
    process.exit(1);
  });
}
