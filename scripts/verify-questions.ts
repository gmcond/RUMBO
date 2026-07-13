/**
 * Verificación sistemática de las preguntas ai_generated contra el manual
 * (content/seed/manual-per.md, fuente de verdad).
 *
 * content/seed/questions-extra-verification.json contiene, por pregunta:
 *   - verdict "publish": exige ≥1 cita literal del manual, y cada cita debe
 *     encontrarse DENTRO de la sección de la UT asignada (valida a la vez el
 *     respaldo textual y la asignación de unidad).
 *   - verdict "hold": exige un motivo; la pregunta se queda en review.
 *
 * El script publica (estado='published') solo las preguntas "publish" que
 * sigan en 'review'. Nunca toca las published/draft (decisiones del admin).
 *
 * Uso: npm run verify-questions [-- --dry-run]
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { z } from "zod";

import { createAdminClient } from "../lib/supabase/admin";

const SEED_DIR = path.join(process.cwd(), "content", "seed");

const verificationSchema = z
  .object({
    unit: z.number().int().min(1).max(11),
    enunciado: z.string().min(10),
    verdict: z.enum(["publish", "hold"]),
    citas: z.array(z.string().min(8)).default([]),
    motivo: z.string().min(10).optional(),
  })
  .refine((e) => (e.verdict === "publish" ? e.citas.length > 0 : Boolean(e.motivo)), {
    message: "publish exige citas; hold exige motivo",
  });

const extraQuestionSchema = z.object({
  unit: z.number().int().min(1).max(11),
  enunciado: z.string().min(10),
});

export type Verification = z.infer<typeof verificationSchema>;

/** Misma normalización para manual y citas: fuera énfasis markdown y saltos. */
function normalize(text: string): string {
  return text.replace(/[*`]/g, "").replace(/\s+/g, " ").trim();
}

/** Contenido normalizado de cada sección `## UTn — …` del manual. */
export function unitSections(manual: string): Map<number, string> {
  const lines = manual.split(/\r?\n/);
  const sections = new Map<number, string>();
  let current: number | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (current !== null) sections.set(current, normalize(buffer.join("\n")));
    buffer = [];
  };

  for (const line of lines) {
    const match = /^## UT(\d+) — /.exec(line);
    if (match) {
      flush();
      current = Number(match[1]);
      continue;
    }
    if (/^## /.test(line)) {
      flush();
      current = null;
      continue;
    }
    if (current !== null) buffer.push(line);
  }
  flush();
  return sections;
}

/**
 * Validación pura (sin BD): correspondencia 1:1 con questions-extra.json y
 * citas presentes en la sección correcta. Devuelve la lista de problemas.
 */
export function validateVerification(
  manual: string,
  extras: Array<{ unit: number; enunciado: string }>,
  verifications: Verification[]
): string[] {
  const problems: string[] = [];
  const sections = unitSections(manual);

  const key = (unit: number, enunciado: string) => `${unit}::${enunciado}`;
  const extraKeys = new Set(extras.map((q) => key(q.unit, q.enunciado)));
  const verificationKeys = new Set(verifications.map((v) => key(v.unit, v.enunciado)));

  for (const q of extras) {
    if (!verificationKeys.has(key(q.unit, q.enunciado))) {
      problems.push(`Sin veredicto: [UT${q.unit}] ${q.enunciado}`);
    }
  }
  for (const v of verifications) {
    if (!extraKeys.has(key(v.unit, v.enunciado))) {
      problems.push(
        `Veredicto huérfano (no existe en questions-extra): [UT${v.unit}] ${v.enunciado}`
      );
    }
  }
  if (verifications.length !== extras.length) {
    problems.push(`Cardinalidad: ${extras.length} preguntas vs ${verifications.length} veredictos`);
  }

  for (const v of verifications) {
    if (v.verdict !== "publish") continue;
    const section = sections.get(v.unit);
    if (!section) {
      problems.push(`UT${v.unit} no encontrada en el manual (${v.enunciado})`);
      continue;
    }
    for (const cita of v.citas) {
      if (!section.includes(normalize(cita))) {
        problems.push(`Cita no hallada en la sección UT${v.unit} para "${v.enunciado}": «${cita}»`);
      }
    }
  }

  return problems;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const manual = readFileSync(path.join(SEED_DIR, "manual-per.md"), "utf8");
  const extras = z
    .array(extraQuestionSchema)
    .parse(JSON.parse(readFileSync(path.join(SEED_DIR, "questions-extra.json"), "utf8")));
  const verifications = z
    .array(verificationSchema)
    .parse(
      JSON.parse(readFileSync(path.join(SEED_DIR, "questions-extra-verification.json"), "utf8"))
    );

  const problems = validateVerification(manual, extras, verifications);
  if (problems.length > 0) {
    console.error(`Validación FALLIDA (${problems.length} problemas):`);
    for (const p of problems) console.error(` - ${p}`);
    process.exit(1);
  }

  const toPublish = verifications.filter((v) => v.verdict === "publish");
  const held = verifications.filter((v) => v.verdict === "hold");
  console.log(
    `Validación OK: ${verifications.length} veredictos (${toPublish.length} publish con citas ` +
      `verificadas en su UT, ${held.length} hold)`
  );

  if (dryRun) {
    console.log("--dry-run: no se toca la base de datos.");
    return;
  }

  const supabase = createAdminClient();

  const { data: units, error: unitsError } = await supabase.from("units").select("id, numero");
  if (unitsError) throw new Error(`units: ${unitsError.message}`);
  const unitIdByNumero = new Map((units ?? []).map((u) => [u.numero, u.id]));

  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select("id, unit_id, enunciado, estado")
    .eq("origen", "ai_generated");
  if (questionsError) throw new Error(`questions: ${questionsError.message}`);

  const byKey = new Map((questions ?? []).map((q) => [`${q.unit_id}::${q.enunciado}`, q]));

  let published = 0;
  let alreadyPublished = 0;
  let notFound = 0;
  let skippedDraft = 0;

  for (const v of toPublish) {
    const unitId = unitIdByNumero.get(v.unit);
    const question = unitId ? byKey.get(`${unitId}::${v.enunciado}`) : undefined;
    if (!question) {
      console.warn(` ! No encontrada en BD (¿editada o movida por el admin?): ${v.enunciado}`);
      notFound++;
      continue;
    }
    if (question.estado === "published") {
      alreadyPublished++;
      continue;
    }
    if (question.estado === "draft") {
      // El admin la rechazó: su decisión manda.
      skippedDraft++;
      continue;
    }
    const { error } = await supabase
      .from("questions")
      .update({ estado: "published" })
      .eq("id", question.id);
    if (error) throw new Error(`questions ${question.id}: ${error.message}`);
    published++;
  }

  console.log(
    `Publicadas ahora: ${published} · ya publicadas: ${alreadyPublished} · ` +
      `descartadas por el admin (draft, sin tocar): ${skippedDraft} · no encontradas: ${notFound}`
  );
  console.log(`Quedan en review (hold): ${held.length}`);
  for (const v of held) {
    console.log(` - [UT${v.unit}] ${v.enunciado}\n   Motivo: ${v.motivo}`);
  }
}

// tsx ejecuta este archivo directamente; el guard permite importarlo en tests
if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/verify-questions.ts")) {
  main().catch((error) => {
    console.error("Verificación FALLIDA:", error.message ?? error);
    process.exit(1);
  });
}
