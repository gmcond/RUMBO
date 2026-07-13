import { describe, expect, it } from "vitest";

import {
  gradeExam,
  parseDistribucion,
  parseTopes,
  type ExamAnswer,
  type ExamGradingConfig,
} from "@/lib/exam-grading";

/** Config de Cataluña tal y como la siembra scripts/seed.ts (PRD §7.1). */
const CAT: ExamGradingConfig = { minAciertos: 32, topes: { "5": 2, "6": 5, "11": 2 } };

/** Distribución PER Cataluña UT1→UT11 (suma 45). */
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

/**
 * Simulacro completo de 45 preguntas según la distribución: las primeras
 * `failures[ut]` de cada UT se marcan falladas (elegida ≠ correcta) y, si
 * `blanks[ut]`, las siguientes quedan en blanco (elegida = null).
 */
function buildAnswers(
  failures: Record<number, number> = {},
  blanks: Record<number, number> = {}
): ExamAnswer[] {
  const answers: ExamAnswer[] = [];
  for (const [ut, total] of Object.entries(DISTRIBUCION)) {
    const unit = Number(ut);
    const wrong = failures[unit] ?? 0;
    const blank = blanks[unit] ?? 0;
    for (let i = 0; i < total; i++) {
      if (i < wrong) answers.push({ unit, elegida: 1, correcta: 0 });
      else if (i < wrong + blank) answers.push({ unit, elegida: null, correcta: 0 });
      else answers.push({ unit, elegida: 0, correcta: 0 });
    }
  }
  return answers;
}

describe("lib/exam-grading · los 4 casos límite del PRD §8-F2", () => {
  it("1 · apto justo: 32 aciertos exactos sin superar topes → APTO", () => {
    // 13 fallos repartidos fuera de los bloques eliminatorios.
    const grade = gradeExam(buildAnswers({ 1: 4, 2: 2, 3: 4, 4: 2, 7: 1 }), CAT);
    expect(grade.aciertos).toBe(32);
    expect(grade.veredicto).toBe("APTO");
    expect(grade.motivos).toEqual([]);
  });

  it("2 · no-apto por global: 31 aciertos con topes cumplidos", () => {
    const grade = gradeExam(buildAnswers({ 1: 4, 2: 2, 3: 4, 4: 2, 7: 2 }), CAT);
    expect(grade.aciertos).toBe(31);
    expect(grade.veredicto).toBe("NO APTO");
    expect(grade.motivos).toEqual([{ kind: "global", aciertos: 31, minAciertos: 32 }]);
  });

  it("3 · no-apto por tope con 42 aciertos (3 fallos en UT5)", () => {
    const grade = gradeExam(buildAnswers({ 5: 3 }), CAT);
    expect(grade.aciertos).toBe(42);
    expect(grade.veredicto).toBe("NO APTO");
    expect(grade.motivos).toEqual([{ kind: "tope", unit: 5, fallos: 3, tope: 2 }]);
  });

  it("4 · apto con los tres topes al límite exacto (2/5/2)", () => {
    const grade = gradeExam(buildAnswers({ 5: 2, 6: 5, 11: 2 }), CAT);
    expect(grade.aciertos).toBe(36);
    expect(grade.veredicto).toBe("APTO");
    expect(grade.motivos).toEqual([]);
  });
});

describe("lib/exam-grading · reglas de corrección", () => {
  it("blanco (elegida=null) cuenta como fallo, global y en su UT", () => {
    const grade = gradeExam(buildAnswers({}, { 6: 6 }), CAT);
    expect(grade.aciertos).toBe(39);
    expect(grade.fallos).toBe(6);
    expect(grade.desglosePorUt["6"]).toEqual({ aciertos: 4, fallos: 6, total: 10 });
    expect(grade.veredicto).toBe("NO APTO");
    expect(grade.motivos).toEqual([{ kind: "tope", unit: 6, fallos: 6, tope: 5 }]);
  });

  it("acumula todos los motivos: global + topes en orden de UT", () => {
    const grade = gradeExam(buildAnswers({ 1: 4, 2: 2, 3: 4, 5: 3, 11: 3 }), CAT);
    expect(grade.aciertos).toBe(29);
    expect(grade.motivos).toEqual([
      { kind: "global", aciertos: 29, minAciertos: 32 },
      { kind: "tope", unit: 5, fallos: 3, tope: 2 },
      { kind: "tope", unit: 11, fallos: 3, tope: 2 },
    ]);
  });

  it("el desglose por UT cubre todas las unidades con el shape de F1", () => {
    const grade = gradeExam(buildAnswers({ 6: 1 }), CAT);
    expect(Object.keys(grade.desglosePorUt)).toHaveLength(11);
    expect(grade.desglosePorUt["6"]).toEqual({ aciertos: 9, fallos: 1, total: 10 });
    expect(grade.desglosePorUt["1"]).toEqual({ aciertos: 4, fallos: 0, total: 4 });
    expect(grade.total).toBe(45);
  });

  it("la config dirige el veredicto: otra comunidad, otros límites", () => {
    const config: ExamGradingConfig = { minAciertos: 40, topes: { "1": 0 } };
    const grade = gradeExam(buildAnswers({ 1: 1 }), config);
    expect(grade.aciertos).toBe(44);
    expect(grade.veredicto).toBe("NO APTO");
    expect(grade.motivos).toEqual([{ kind: "tope", unit: 1, fallos: 1, tope: 0 }]);
  });

  it("sin topes (jsonb vacío) solo aplica el mínimo global", () => {
    const grade = gradeExam(buildAnswers({ 5: 5 }), { minAciertos: 32, topes: {} });
    expect(grade.aciertos).toBe(40);
    expect(grade.veredicto).toBe("APTO");
  });
});

describe("lib/exam-grading · parseo del jsonb de exam_configs", () => {
  it("acepta el shape sembrado {'5': 2, '6': 5, '11': 2}", () => {
    expect(parseTopes({ "5": 2, "6": 5, "11": 2 })).toEqual({ "5": 2, "6": 5, "11": 2 });
    expect(parseDistribucion(DISTRIBUCION)).toEqual(DISTRIBUCION);
  });

  it("rechaza shapes corruptos en vez de corregir con ellos", () => {
    expect(() => parseTopes(null)).toThrow(/topes/);
    expect(() => parseTopes([2, 5])).toThrow(/topes/);
    expect(() => parseTopes({ x: 2 })).toThrow(/UT inválida/);
    expect(() => parseDistribucion({ "5": -1 })).toThrow(/UT5/);
    expect(() => parseDistribucion({ "5": 2.5 })).toThrow(/UT5/);
  });
});
