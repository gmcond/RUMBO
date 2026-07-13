import { describe, expect, it } from "vitest";

import { dmForYear, norm360 } from "@/lib/chart-math";
import {
  CHART_EXERCISE_SLUGS,
  checkFieldAnswer,
  generateExercise,
  type ChartExercise,
  type ExerciseField,
} from "@/lib/study/chart-exercises";

const YEAR = 2026;

/** RNG determinista (LCG), como en simulacro.test.ts. */
function seededRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 2 ** 32;
    return state / 2 ** 32;
  };
}

/** Extrae el número de un valor formateado tipo "087°" o "4,5 millas". */
function parseNum(value: string): number {
  const match = /-?\d+(?:,\d+)?/.exec(value);
  if (!match) throw new Error(`Sin número en "${value}"`);
  return Number(match[0].replace(",", "."));
}

function dataValue(ex: ChartExercise, labelPart: string): string {
  const entry = ex.data.find((d) => d.label.includes(labelPart));
  if (!entry) throw new Error(`Dato "${labelPart}" no encontrado`);
  return entry.value;
}

function field(ex: ChartExercise, id: string): ExerciseField {
  const f = ex.fields.find((f) => f.id === id);
  if (!f) throw new Error(`Campo "${id}" no encontrado`);
  return f;
}

describe("lib/study/chart-exercises · generación", () => {
  it("los 8 tipos generan ejercicios completos y finitos (barrido de semillas)", () => {
    for (const slug of CHART_EXERCISE_SLUGS) {
      for (let seed = 1; seed <= 25; seed++) {
        const ex = generateExercise(slug, YEAR, seededRng(seed));
        expect(ex.type).toBe(slug);
        expect(ex.statement.length, `${slug}#${seed}`).toBeGreaterThan(20);
        expect(ex.data.length, `${slug}#${seed}`).toBeGreaterThan(0);
        expect(ex.fields.length, `${slug}#${seed}`).toBeGreaterThan(0);
        expect(ex.steps.length, `${slug}#${seed}`).toBeGreaterThanOrEqual(2);
        for (const f of ex.fields) {
          expect(Number.isFinite(f.answer), `${slug}#${seed}:${f.id}`).toBe(true);
          expect(f.tolerance, `${slug}#${seed}:${f.id}`).toBeGreaterThan(0);
          expect(f.display.length, `${slug}#${seed}:${f.id}`).toBeGreaterThan(0);
          if (f.kind === "time") {
            expect(f.answer).toBeGreaterThanOrEqual(0);
            expect(f.answer).toBeLessThan(24 * 60);
          }
        }
      }
    }
  });

  it("misma semilla → mismo ejercicio; semillas distintas → datos distintos", () => {
    const a = generateExercise("dos-demoras", YEAR, seededRng(42));
    const b = generateExercise("dos-demoras", YEAR, seededRng(42));
    const c = generateExercise("dos-demoras", YEAR, seededRng(43));
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });
});

describe("lib/study/chart-exercises · coherencia numérica por tipo", () => {
  it("correccion-total: dm = dm del año; Ct − dm = desvío del enunciado", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const ex = generateExercise("correccion-total", YEAR, seededRng(seed));
      const dm = field(ex, "dm").answer;
      const ct = field(ex, "ct").answer;
      expect(dm).toBe(dmForYear(YEAR));
      const desvio = ct - dm;
      expect(Math.abs(desvio)).toBeGreaterThanOrEqual(0.5);
      expect(Math.abs(desvio)).toBeLessThanOrEqual(4);
    }
  });

  it("dos-demoras: la misma Ct separa Da de Dv en ambos faros", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const ex = generateExercise("dos-demoras", YEAR, seededRng(seed));
      const [f1, f2] = ex.fields;
      const da1 = parseNum(ex.data[0].value);
      const da2 = parseNum(ex.data[1].value);
      const ct1 = norm360(f1.answer - da1);
      const ct2 = norm360(f2.answer - da2);
      expect(ct1).toBeCloseTo(ct2, 5);
      expect(ex.diagram).toBe("dos-demoras");
    }
  });

  it("rumbo-tangente: sen(α) = resguardo/distancia y Rv = demora ± α", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const ex = generateExercise("rumbo-tangente", YEAR, seededRng(seed));
      const demora = parseNum(dataValue(ex, "Demora"));
      const dist = parseNum(dataValue(ex, "Distancia"));
      const resguardo = parseNum(dataValue(ex, "Resguardo"));
      const alpha = field(ex, "alpha").answer;
      expect(Math.sin((alpha * Math.PI) / 180)).toBeCloseTo(resguardo / dist, 5);
      const rumbo = field(ex, "rumbo").answer;
      const estribor = dataValue(ex, "peligro queda por") === "estribor";
      expect(rumbo).toBeCloseTo(norm360(estribor ? demora - alpha : demora + alpha), 5);
    }
  });

  it("rumbo-distancia-eta y corriente: ETA coherente con distancia/velocidad", () => {
    for (const slug of ["rumbo-distancia-eta", "corriente"] as const) {
      const ex = generateExercise(slug, YEAR, seededRng(7));
      const dist = parseNum(dataValue(ex, "Distancia"));
      const salida = dataValue(ex, "salida");
      const [h, m] = salida.split(":").map(Number);
      const salidaMin = h * 60 + m;
      const vel =
        slug === "corriente" ? field(ex, "sog").answer : parseNum(dataValue(ex, "Velocidad"));
      const etaField = field(ex, "eta");
      expect(etaField.answer).toBe(Math.round(salidaMin + (dist / vel) * 60) % (24 * 60));
    }
  });

  it("coordenadas: la distancia en millas es la diferencia de latitud en minutos", () => {
    const ex = generateExercise("coordenadas", YEAR, seededRng(9));
    expect(field(ex, "dist").answer).toBe(field(ex, "delta").answer);
  });
});

describe("lib/study/chart-exercises · corrección de respuestas", () => {
  const base: ExerciseField = {
    id: "x",
    label: "x",
    kind: "number",
    answer: 10,
    tolerance: 0.5,
    display: "10",
  };

  it("aplica la tolerancia del campo", () => {
    expect(checkFieldAnswer(base, 10.4)).toBe(true);
    expect(checkFieldAnswer(base, 10.6)).toBe(false);
    expect(checkFieldAnswer(base, NaN)).toBe(false);
  });

  it("los campos circulares comparan en el círculo 0–360", () => {
    const rumbo: ExerciseField = { ...base, answer: 359.8, circular: true };
    expect(checkFieldAnswer(rumbo, 0.1)).toBe(true);
    expect(checkFieldAnswer(rumbo, 358)).toBe(false);
    expect(checkFieldAnswer(rumbo, 359.9)).toBe(true);
  });
});
