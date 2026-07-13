import type { Json } from "@/lib/supabase/database.types";
import type { createClient } from "@/lib/supabase/server";

export type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

export interface StudyUnit {
  id: string;
  numero: number;
  titulo: string;
  descripcion: string | null;
}

/** Pregunta lista para mostrar: opciones barajadas, sin la respuesta. */
export interface DisplayQuestion {
  questionId: string;
  enunciado: string;
  /** Opciones en el orden de presentación. */
  opciones: string[];
  /** map[índiceMostrado] = índice original (el que espera el corrector). */
  map: number[];
}

export function parseUnidadParam(param: string): number | null {
  const match = /^ut(\d{1,2})$/.exec(param);
  if (!match) return null;
  const numero = Number(match[1]);
  return numero >= 1 && numero <= 11 ? numero : null;
}

export async function getDegree(supabase: ServerSupabase, slug: string) {
  const { data } = await supabase
    .from("degrees")
    .select("id, slug, nombre, descripcion")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

export async function getUnitsForDegree(
  supabase: ServerSupabase,
  degreeId: string
): Promise<StudyUnit[]> {
  const { data, error } = await supabase
    .from("degree_units")
    .select("orden, units(id, numero, titulo, descripcion)")
    .eq("degree_id", degreeId)
    .order("orden");
  if (error) throw new Error(`degree_units: ${error.message}`);
  return (data ?? []).map((link) => link.units);
}

export async function getUnit(
  supabase: ServerSupabase,
  degreeId: string,
  numero: number
): Promise<StudyUnit | null> {
  const units = await getUnitsForDegree(supabase, degreeId);
  return units.find((u) => u.numero === numero) ?? null;
}

/** opciones es jsonb en BD (CHECK de array de 4); lo normaliza a string[4]. */
export function parseOpciones(json: Json): string[] {
  if (!Array.isArray(json) || json.length !== 4 || !json.every((o) => typeof o === "string")) {
    throw new Error("Pregunta con opciones mal formadas");
  }
  return json;
}

/**
 * Baraja las opciones para presentación (neutraliza el sesgo de respuesta
 * del contenido semilla). Devuelve el mapeo de vuelta al índice original.
 */
export function shuffleOptions(opciones: string[]): { opciones: string[]; map: number[] } {
  const indices = opciones.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return { opciones: indices.map((i) => opciones[i]), map: indices };
}

/**
 * Último resultado registrado por pregunta en los attempts del usuario
 * (para los filtros "falladas" y "no vistas" del configurador de tests).
 */
export async function getLastAnswerMap(supabase: ServerSupabase): Promise<Map<string, boolean>> {
  const { data, error } = await supabase
    .from("attempts")
    .select("respuestas, created_at")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`attempts: ${error.message}`);

  const last = new Map<string, boolean>();
  for (const attempt of data ?? []) {
    if (!Array.isArray(attempt.respuestas)) continue;
    for (const r of attempt.respuestas) {
      if (
        r !== null &&
        typeof r === "object" &&
        "question_id" in r &&
        typeof r.question_id === "string" &&
        "ok" in r &&
        typeof r.ok === "boolean"
      ) {
        last.set(r.question_id, r.ok);
      }
    }
  }
  return last;
}

/** Elige n preguntas publicadas al azar de una unidad, listas para mostrar. */
export async function pickQuizQuestions(
  supabase: ServerSupabase,
  unitId: string,
  n: number
): Promise<DisplayQuestion[]> {
  const { data, error } = await supabase
    .from("questions")
    .select("id, enunciado, opciones")
    .eq("unit_id", unitId)
    .eq("estado", "published");
  if (error) throw new Error(`questions: ${error.message}`);

  const pool = [...(data ?? [])];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, n).map((q) => {
    const { opciones, map } = shuffleOptions(parseOpciones(q.opciones));
    return { questionId: q.id, enunciado: q.enunciado, opciones, map };
  });
}
