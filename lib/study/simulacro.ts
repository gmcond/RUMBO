/**
 * Extracción del pool de un simulacro: n preguntas al azar por UT según la
 * distribución de exam_configs (Cataluña: [4,2,4,2,5,10,2,3,4,5,4]). El
 * examen se presenta ordenado por bloques de UT, como el oficial.
 *
 * Puro y con RNG inyectable para poder testear la selección.
 */

export type Rng = () => number;

export interface MissingUnit {
  unit: number;
  needed: number;
  available: number;
}

export type SimulacroPool<T> =
  | { ok: true; questions: T[] }
  | { ok: false; missing: MissingUnit[] };

/** Fisher-Yates sobre una copia, con RNG inyectable. */
export function shuffleWith<T>(items: T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Selecciona el pool del simulacro respetando la distribución. Si alguna UT
 * no tiene preguntas publicadas suficientes devuelve la lista de carencias
 * (la UI explica qué falta en vez de montar un examen inválido).
 */
export function buildSimulacroPool<T extends { unit: number }>(
  candidates: T[],
  distribucion: Record<string, number>,
  rng: Rng = Math.random
): SimulacroPool<T> {
  const byUnit = new Map<number, T[]>();
  for (const candidate of candidates) {
    const list = byUnit.get(candidate.unit) ?? [];
    list.push(candidate);
    byUnit.set(candidate.unit, list);
  }

  const blocks = Object.entries(distribucion)
    .map(([unit, needed]) => ({ unit: Number(unit), needed }))
    .filter((b) => b.needed > 0)
    .sort((a, b) => a.unit - b.unit);

  const missing: MissingUnit[] = blocks
    .map(({ unit, needed }) => ({ unit, needed, available: byUnit.get(unit)?.length ?? 0 }))
    .filter((b) => b.available < b.needed);
  if (missing.length > 0) return { ok: false, missing };

  const questions: T[] = [];
  for (const { unit, needed } of blocks) {
    questions.push(...shuffleWith(byUnit.get(unit) ?? [], rng).slice(0, needed));
  }
  return { ok: true, questions };
}
