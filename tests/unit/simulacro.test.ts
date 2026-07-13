import { describe, expect, it } from "vitest";

import { buildSimulacroPool, shuffleWith } from "@/lib/study/simulacro";

const DISTRIBUCION: Record<string, number> = {
  "1": 4,
  "2": 2,
  "3": 4,
  "4": 2,
  "5": 5,
  "6": 10,
  "7": 2,
  "8": 3,
  "9": 4,
  "10": 5,
  "11": 4,
};

interface Candidate {
  id: string;
  unit: number;
}

/** n candidatos por UT: ids "ut<unidad>-<i>". */
function candidates(perUnit: number, units = Object.keys(DISTRIBUCION).map(Number)): Candidate[] {
  return units.flatMap((unit) =>
    Array.from({ length: perUnit }, (_, i) => ({ id: `ut${unit}-${i}`, unit }))
  );
}

/** RNG determinista (LCG) para tests reproducibles. */
function seededRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 2 ** 32;
    return state / 2 ** 32;
  };
}

describe("lib/study/simulacro · buildSimulacroPool", () => {
  it("respeta la distribución [4,2,4,2,5,10,2,3,4,5,4] y ordena por bloques de UT", () => {
    const result = buildSimulacroPool(candidates(12), DISTRIBUCION, seededRng(7));
    if (!result.ok) throw new Error("pool debería ser válido");

    expect(result.questions).toHaveLength(45);
    const byUnit = new Map<number, number>();
    for (const q of result.questions) byUnit.set(q.unit, (byUnit.get(q.unit) ?? 0) + 1);
    for (const [ut, needed] of Object.entries(DISTRIBUCION)) {
      expect(byUnit.get(Number(ut))).toBe(needed);
    }
    // Orden de examen: bloques de UT ascendentes, como el oficial.
    const unitsInOrder = result.questions.map((q) => q.unit);
    expect(unitsInOrder).toEqual([...unitsInOrder].sort((a, b) => a - b));
  });

  it("no repite preguntas dentro del mismo simulacro", () => {
    const result = buildSimulacroPool(candidates(12), DISTRIBUCION, seededRng(3));
    if (!result.ok) throw new Error("pool debería ser válido");
    expect(new Set(result.questions.map((q) => q.id)).size).toBe(45);
  });

  it("la selección es aleatoria dentro de cada UT (rng inyectable)", () => {
    const a = buildSimulacroPool(candidates(30), DISTRIBUCION, seededRng(1));
    const b = buildSimulacroPool(candidates(30), DISTRIBUCION, seededRng(2));
    if (!a.ok || !b.ok) throw new Error("pools deberían ser válidos");
    expect(a.questions.map((q) => q.id)).not.toEqual(b.questions.map((q) => q.id));
  });

  it("informa de las UT sin preguntas suficientes en vez de montar un examen inválido", () => {
    // 4 preguntas por UT y ninguna de UT11: fallan UT5 (5), UT6 (10), UT10 (5) y UT11 (4).
    const result = buildSimulacroPool(
      candidates(4, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
      DISTRIBUCION,
      seededRng(5)
    );
    if (result.ok) throw new Error("pool debería ser insuficiente");
    expect(result.missing).toEqual([
      { unit: 5, needed: 5, available: 4 },
      { unit: 6, needed: 10, available: 4 },
      { unit: 10, needed: 5, available: 4 },
      { unit: 11, needed: 4, available: 0 },
    ]);
  });

  it("ignora UT con 0 preguntas pedidas", () => {
    const result = buildSimulacroPool(candidates(3, [1]), { "1": 2, "2": 0 }, seededRng(9));
    if (!result.ok) throw new Error("pool debería ser válido");
    expect(result.questions).toHaveLength(2);
  });
});

describe("lib/study/simulacro · shuffleWith", () => {
  it("devuelve una permutación sin mutar el original", () => {
    const original = [1, 2, 3, 4, 5, 6, 7, 8];
    const copy = [...original];
    const shuffled = shuffleWith(original, seededRng(11));
    expect(original).toEqual(copy);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(copy);
  });
});
