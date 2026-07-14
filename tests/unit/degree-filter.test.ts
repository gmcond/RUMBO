import { describe, expect, it } from "vitest";

import { attemptBelongsToDegree } from "@/lib/study/data";

// Temarios reales (F4): PER = UT1-UT11, PNB = UT1-UT6 compartidas.
const PER_UNITS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
const PNB_UNITS = new Set([1, 2, 3, 4, 5, 6]);

const desglose = (...units: number[]) =>
  Object.fromEntries(units.map((u) => [String(u), { aciertos: 1, fallos: 0, total: 1 }]));

describe("attemptBelongsToDegree", () => {
  it("un test de una UT compartida cuenta para ambas titulaciones", () => {
    const d = desglose(3);
    expect(attemptBelongsToDegree(d, PER_UNITS)).toBe(true);
    expect(attemptBelongsToDegree(d, PNB_UNITS)).toBe(true);
  });

  it("un test con UT7-UT11 solo cuenta para el PER", () => {
    const d = desglose(5, 11);
    expect(attemptBelongsToDegree(d, PER_UNITS)).toBe(true);
    expect(attemptBelongsToDegree(d, PNB_UNITS)).toBe(false);
  });

  it("exige que TODAS las UT del attempt estén en el temario", () => {
    expect(attemptBelongsToDegree(desglose(1, 2, 7), PNB_UNITS)).toBe(false);
  });

  it("un desglose vacío no pertenece a ninguna titulación", () => {
    expect(attemptBelongsToDegree({}, PER_UNITS)).toBe(false);
  });

  it("tolera jsonb malformado sin romper", () => {
    expect(attemptBelongsToDegree(null, PER_UNITS)).toBe(false);
    expect(attemptBelongsToDegree([1, 2], PER_UNITS)).toBe(false);
    expect(attemptBelongsToDegree("ut1", PER_UNITS)).toBe(false);
    expect(attemptBelongsToDegree(desglose(NaN), PER_UNITS)).toBe(false);
  });
});
