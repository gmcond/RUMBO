/**
 * Corrección de simulacros de examen dirigida por exam_configs (PRD §7.1).
 *
 * APTO ⇔ aciertos ≥ min_aciertos ∧ fallos por UT ≤ tope de cada bloque
 * eliminatorio. Pregunta en blanco (elegida = null) cuenta como fallo.
 * El NO APTO lleva siempre todos sus motivos (global y/o cada tope superado)
 * para que la UI pueda explicar también el caso "32+ aciertos pero suspenso
 * por tope". Los valores (32, {5:2, 6:5, 11:2}, …) vienen SIEMPRE de la BD;
 * aquí no se hardcodea ninguna comunidad.
 *
 * Funciones puras: la persistencia del attempt vive en las server actions,
 * igual que en lib/srs.ts.
 */

import type { Json } from "@/lib/supabase/database.types";

/** Subconjunto de exam_configs que dirige la corrección. */
export interface ExamGradingConfig {
  minAciertos: number;
  /** Fallos máximos por nº de UT en bloques eliminatorios, p. ej. {"5": 2}. */
  topes: Record<string, number>;
}

/** Respuesta corregible (shape de attempts.respuestas fijado en F1). */
export interface ExamAnswer {
  unit: number;
  elegida: number | null;
  correcta: number;
}

/** Type alias (no interface): así Record<string, UnitBreakdown> encaja en Json. */
export type UnitBreakdown = {
  aciertos: number;
  fallos: number;
  total: number;
};

export type Veredicto = "APTO" | "NO APTO";

export type NoAptoMotivo =
  | { kind: "global"; aciertos: number; minAciertos: number }
  | { kind: "tope"; unit: number; fallos: number; tope: number };

export interface ExamGrade {
  aciertos: number;
  fallos: number;
  total: number;
  desglosePorUt: Record<string, UnitBreakdown>;
  veredicto: Veredicto;
  /** Vacío si APTO; si NO APTO, todas las causas (global primero, topes por UT). */
  motivos: NoAptoMotivo[];
}

/** Corrige un simulacro completo según la config de la comunidad. */
export function gradeExam(answers: ExamAnswer[], config: ExamGradingConfig): ExamGrade {
  const desglosePorUt: Record<string, UnitBreakdown> = {};
  let aciertos = 0;

  for (const answer of answers) {
    const ok = answer.elegida !== null && answer.elegida === answer.correcta;
    const bucket = (desglosePorUt[String(answer.unit)] ??= { aciertos: 0, fallos: 0, total: 0 });
    bucket.total++;
    if (ok) {
      bucket.aciertos++;
      aciertos++;
    } else {
      bucket.fallos++;
    }
  }

  const motivos: NoAptoMotivo[] = [];
  if (aciertos < config.minAciertos) {
    motivos.push({ kind: "global", aciertos, minAciertos: config.minAciertos });
  }
  for (const [unit, tope] of Object.entries(config.topes).sort(
    ([a], [b]) => Number(a) - Number(b)
  )) {
    const fallos = desglosePorUt[unit]?.fallos ?? 0;
    if (fallos > tope) {
      motivos.push({ kind: "tope", unit: Number(unit), fallos, tope });
    }
  }

  return {
    aciertos,
    fallos: answers.length - aciertos,
    total: answers.length,
    desglosePorUt,
    veredicto: motivos.length === 0 ? "APTO" : "NO APTO",
    motivos,
  };
}

/**
 * Valida un jsonb de exam_configs con forma {"<nºUT>": n} (distribucion,
 * topes). Lanza si el shape no es el esperado: mejor fallar en la carga que
 * corregir con una config corrupta.
 */
function parseUtNumberMap(json: Json, field: string): Record<string, number> {
  if (json === null || typeof json !== "object" || Array.isArray(json)) {
    throw new Error(`exam_configs.${field}: se esperaba un objeto {"<nºUT>": n}`);
  }
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(json)) {
    const unit = Number(key);
    if (!Number.isInteger(unit) || unit < 1) {
      throw new Error(`exam_configs.${field}: clave de UT inválida "${key}"`);
    }
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
      throw new Error(`exam_configs.${field}: valor inválido para UT${key}`);
    }
    result[key] = value;
  }
  return result;
}

/** distribucion jsonb → {"<nºUT>": nº de preguntas}. */
export function parseDistribucion(json: Json): Record<string, number> {
  return parseUtNumberMap(json, "distribucion");
}

/** topes jsonb → {"<nºUT>": fallos máximos}. */
export function parseTopes(json: Json): Record<string, number> {
  return parseUtNumberMap(json, "topes");
}
