import { describe, expect, it } from "vitest";

import {
  computeReadiness,
  type ReadinessConfig,
  type SimulacroSummary,
} from "@/lib/study/readiness";

const CONFIG: ReadinessConfig = { minAciertos: 32, topes: { "5": 2, "6": 5, "11": 2 } };

/** Simulacro con los fallos indicados por UT y el resto de aciertos hasta 45. */
function sim(aciertos: number, fallosPorUt: Record<number, number> = {}): SimulacroSummary {
  const desglosePorUt: SimulacroSummary["desglosePorUt"] = {};
  for (const [ut, fallos] of Object.entries(fallosPorUt)) {
    desglosePorUt[ut] = { aciertos: 0, fallos, total: fallos };
  }
  return { aciertos, desglosePorUt };
}

function row(rows: ReturnType<typeof computeReadiness>, unit: number | null) {
  const r = rows.find((r) => r.unit === unit);
  if (!r) throw new Error(`fila ${unit} no encontrada`);
  return r;
}

describe("lib/study/readiness · estructura", () => {
  it("sin simulacros no hay filas (la UI muestra 'sin datos')", () => {
    expect(computeReadiness([], CONFIG)).toEqual([]);
  });

  it("devuelve global + bloques eliminatorios en orden de UT", () => {
    const rows = computeReadiness([sim(40)], CONFIG);
    expect(rows.map((r) => r.unit)).toEqual([null, 5, 6, 11]);
    expect(row(rows, null).limit).toBe(32);
    expect(row(rows, 5).limit).toBe(2);
  });

  it("usa como mucho los 3 simulacros más recientes", () => {
    // El 4º (muy malo) no debe contar.
    const rows = computeReadiness([sim(40), sim(40), sim(40), sim(0, { 5: 5 })], CONFIG);
    expect(row(rows, null).level).toBe("green");
    expect(row(rows, 5).level).toBe("green");
  });
});

describe("lib/study/readiness · regla verde/ámbar/rojo", () => {
  it("verde: cumple con margen en los 3", () => {
    const rows = computeReadiness(
      [sim(40, { 5: 1 }), sim(38, { 5: 0 }), sim(35, { 5: 2 })],
      CONFIG
    );
    expect(row(rows, null).level).toBe("green");
    expect(row(rows, 5).level).toBe("green");
  });

  it("ámbar: al límite exacto en el último (tope o mínimo global)", () => {
    const rows = computeReadiness([sim(32, { 5: 2 }), sim(40), sim(40)], CONFIG);
    expect(row(rows, null).level).toBe("amber");
    expect(row(rows, 5).level).toBe("amber");
    expect(row(rows, 6).level).toBe("green");
  });

  it("ámbar: un incumplimiento antiguo entre los 3 (no en el último)", () => {
    const rows = computeReadiness(
      [sim(40, { 6: 4 }), sim(40, { 6: 6 }), sim(40, { 6: 2 })],
      CONFIG
    );
    expect(row(rows, 6).level).toBe("amber");
  });

  it("rojo: incumple en el último aunque los anteriores fueran bien", () => {
    const rows = computeReadiness([sim(28), sim(40), sim(40)], CONFIG);
    expect(row(rows, null).level).toBe("red");
  });

  it("rojo: incumple en 2 de 3 aunque el último fuera bien", () => {
    const rows = computeReadiness(
      [sim(40, { 11: 1 }), sim(40, { 11: 3 }), sim(40, { 11: 4 })],
      CONFIG
    );
    expect(row(rows, 11).level).toBe("red");
  });

  it("con un único simulacro también funciona", () => {
    const rows = computeReadiness([sim(33, { 5: 3 })], CONFIG);
    expect(row(rows, null).level).toBe("green");
    expect(row(rows, 5).level).toBe("red");
    expect(row(rows, 5).lastValue).toBe(3);
  });

  it("una UT ausente del desglose cuenta como 0 fallos", () => {
    const rows = computeReadiness([sim(40)], CONFIG);
    expect(row(rows, 6).level).toBe("green");
    expect(row(rows, 6).lastValue).toBe(0);
  });
});
