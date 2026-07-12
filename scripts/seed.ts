/**
 * Seed inicial de RUMBO (Fase 0):
 *   - Titulación PER
 *   - Sus 11 unidades teóricas (títulos y descripciones desde content/seed/manual-per.md)
 *   - exam_config de Cataluña (valores exactos de CLAUDE.md / Anexo II RD 875/2014)
 *
 * Idempotente: usa upserts y puede ejecutarse tantas veces como haga falta.
 * Ejecutar con: npm run seed  (requiere .env.local con SUPABASE_SERVICE_ROLE_KEY)
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { createAdminClient } from "../lib/supabase/admin";

const MANUAL_PATH = path.join(process.cwd(), "content", "seed", "manual-per.md");

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

function assertSeedInvariants(units: ParsedUnit[]) {
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
}

async function main() {
  const markdown = readFileSync(MANUAL_PATH, "utf8");
  const units = parseUnits(markdown);
  assertSeedInvariants(units);
  console.log(`Manual parseado: ${units.length} unidades`);

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
      console.log(`UT${unit.numero} creada: ${unit.titulo}`);
    }
  }

  // 3 · exam_config Cataluña
  const { error: configError } = await supabase
    .from("exam_configs")
    .upsert({ degree_id: degree.id, ...EXAM_CONFIG_CAT }, { onConflict: "degree_id,ccaa" });
  if (configError) throw new Error(`exam_configs: ${configError.message}`);
  console.log("exam_config CAT sembrado (45 preguntas / 90 min / ≥32 / topes 2-5-2)");

  console.log("Seed completado sin errores ✔");
}

// tsx ejecuta este archivo directamente; el guard evita que corra al importarlo en tests
if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/seed.ts")) {
  main().catch((error) => {
    console.error("Seed FALLIDO:", error.message ?? error);
    process.exit(1);
  });
}
