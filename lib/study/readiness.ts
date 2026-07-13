/**
 * Semáforo de preparación para el examen (F2): estado verde/ámbar/rojo por
 * bloque eliminatorio y para el mínimo global, calculado sobre los últimos 3
 * simulacros en modo examen (los attempts tipo 'simulacro').
 *
 * Regla (fijada en el plan de F2):
 * - ROJO: incumple el límite en el último simulacro, o en 2 o más de los 3.
 * - ÁMBAR: lo incumple en 1 de 3 (pero no en el último), o en el último va
 *   justo al límite (fallos = tope; aciertos = mínimo en el global).
 * - VERDE: lo cumple en los 3 (o en todos los que haya) con margen.
 * - Sin simulacros: sin datos.
 */

import type { UnitBreakdown } from "@/lib/exam-grading";

export type ReadinessLevel = "green" | "amber" | "red";

export interface SimulacroSummary {
  aciertos: number;
  desglosePorUt: Record<string, UnitBreakdown>;
}

export interface BlockReadiness {
  /** Número de UT del bloque eliminatorio; null para el mínimo global. */
  unit: number | null;
  level: ReadinessLevel;
  /** Último simulacro: fallos del bloque (o aciertos si es el global). */
  lastValue: number;
  /** Límite aplicable: tope de fallos (o mínimo de aciertos si es global). */
  limit: number;
}

export interface ReadinessConfig {
  minAciertos: number;
  topes: Record<string, number>;
}

/** ¿Incumple el límite? (bloque: fallos > tope · global: aciertos < mínimo) */
function fails(sim: SimulacroSummary, unit: number | null, config: ReadinessConfig): boolean {
  if (unit === null) return sim.aciertos < config.minAciertos;
  const fallos = sim.desglosePorUt[String(unit)]?.fallos ?? 0;
  return fallos > (config.topes[String(unit)] ?? Infinity);
}

/** ¿Va justo al límite exacto? */
function atLimit(sim: SimulacroSummary, unit: number | null, config: ReadinessConfig): boolean {
  if (unit === null) return sim.aciertos === config.minAciertos;
  const fallos = sim.desglosePorUt[String(unit)]?.fallos ?? 0;
  return fallos === (config.topes[String(unit)] ?? Infinity);
}

function levelFor(
  sims: SimulacroSummary[],
  unit: number | null,
  config: ReadinessConfig
): ReadinessLevel {
  const failures = sims.map((s) => fails(s, unit, config));
  const count = failures.filter(Boolean).length;
  if (failures[0] || count >= 2) return "red";
  if (count === 1 || atLimit(sims[0], unit, config)) return "amber";
  return "green";
}

/**
 * Estado por bloque a partir de los últimos simulacros (el MÁS RECIENTE
 * primero; se usan como mucho los 3 primeros). Devuelve el global (unit=null)
 * seguido de los bloques eliminatorios en orden de UT. Vacío si no hay datos.
 */
export function computeReadiness(
  simulacros: SimulacroSummary[],
  config: ReadinessConfig
): BlockReadiness[] {
  const sims = simulacros.slice(0, 3);
  if (sims.length === 0) return [];

  const rows: BlockReadiness[] = [
    {
      unit: null,
      level: levelFor(sims, null, config),
      lastValue: sims[0].aciertos,
      limit: config.minAciertos,
    },
  ];

  for (const [unitKey, tope] of Object.entries(config.topes).sort(
    ([a], [b]) => Number(a) - Number(b)
  )) {
    const unit = Number(unitKey);
    rows.push({
      unit,
      level: levelFor(sims, unit, config),
      lastValue: sims[0].desglosePorUt[unitKey]?.fallos ?? 0,
      limit: tope,
    });
  }

  return rows;
}
