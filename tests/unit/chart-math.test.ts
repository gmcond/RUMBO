import { describe, expect, it } from "vitest";

import {
  ctPorEnfilacion,
  demoraDesdeMarcacion,
  demoraVerdadera,
  dmForYear,
  dmForYearExact,
  eta,
  formatDuration,
  formatEW,
  formatHm,
  formatLat,
  formatLon,
  formatRumbo,
  fromDegreesMinutes,
  metersToNm,
  nmToMeters,
  norm360,
  roundToHalfDegree,
  rumboAguja,
  rumboVerdadero,
  toDegreesMinutes,
  totalCorrection,
  travelHours,
} from "@/lib/chart-math";

describe("lib/chart-math · dm de la carta L105 (PRD §7.3)", () => {
  it("2005: 2°50'W exactos; redondeada al medio grado queda 3°W", () => {
    expect(dmForYearExact(2005)).toBeCloseTo(-2.8333, 3);
    expect(dmForYear(2005)).toBe(-3);
  });

  it("2024: 2°50'W − 19×7'E = 37'W → −0,5°", () => {
    expect(dmForYearExact(2024)).toBeCloseTo(-0.6167, 3);
    expect(dmForYear(2024)).toBe(-0.5);
  });

  it("2026: 23'W → −0,5° (más cerca del medio grado que de 0)", () => {
    expect(dmForYearExact(2026)).toBeCloseTo(-0.3833, 3);
    expect(dmForYear(2026)).toBe(-0.5);
  });

  it("2030: la dm cruza a ~5'E y redondea a 0°", () => {
    expect(dmForYearExact(2030)).toBeCloseTo(0.0833, 3);
    expect(dmForYear(2030)).toBe(0);
  });

  it("2035: 40'E → +0,5°", () => {
    expect(dmForYear(2035)).toBe(0.5);
  });

  it("el redondeo a medio grado es simétrico (empates lejos de cero)", () => {
    expect(roundToHalfDegree(0.25)).toBe(0.5);
    expect(roundToHalfDegree(-0.25)).toBe(-0.5);
    expect(roundToHalfDegree(0.24)).toBe(0);
    expect(roundToHalfDegree(-0.24)).toBe(-0);
    expect(roundToHalfDegree(-1.74)).toBe(-1.5);
    expect(roundToHalfDegree(-1.76)).toBe(-2);
  });
});

describe("lib/chart-math · correcciones y rumbos (E+, W−)", () => {
  it("Ct = dm + desvío", () => {
    expect(totalCorrection(-0.5, 2)).toBe(1.5);
    expect(totalCorrection(-2, -1)).toBe(-3);
    expect(totalCorrection(0.5, -0.5)).toBe(0);
  });

  it("Rv = Ra + Ct y su inversa Ra = Rv − Ct", () => {
    expect(rumboVerdadero(125, -3)).toBe(122);
    expect(rumboAguja(122, -3)).toBe(125);
    expect(rumboVerdadero(rumboAguja(200, 1.5), 1.5)).toBe(200);
  });

  it("los rumbos envuelven en 0/360", () => {
    expect(rumboVerdadero(358, 4)).toBe(2);
    expect(rumboVerdadero(2, -5)).toBe(357);
    expect(norm360(-90)).toBe(270);
    expect(norm360(720)).toBe(0);
  });

  it("Dv = Da + Ct y Dv = Rv + marcación (estribor +, babor −)", () => {
    expect(demoraVerdadera(45, 1.5)).toBe(46.5);
    expect(demoraDesdeMarcacion(90, -30)).toBe(60);
    expect(demoraDesdeMarcacion(350, 20)).toBe(10);
  });

  it("Ct por enfilación = Dv(carta) − Da(observada), con signo ±180", () => {
    expect(ctPorEnfilacion(115, 118)).toBe(-3);
    expect(ctPorEnfilacion(10, 355)).toBe(15);
    expect(ctPorEnfilacion(355, 10)).toBe(-15);
  });
});

describe("lib/chart-math · tiempos y distancias", () => {
  it("ETA = salida + distancia/velocidad", () => {
    const salida = new Date(2026, 6, 14, 10, 0);
    const llegada = eta(salida, 15, 6);
    expect(llegada.getHours()).toBe(12);
    expect(llegada.getMinutes()).toBe(30);
  });

  it("travelHours valida la velocidad", () => {
    expect(travelHours(15, 6)).toBe(2.5);
    expect(() => travelHours(10, 0)).toThrow();
  });

  it("1 milla náutica = 1852 m", () => {
    expect(nmToMeters(1)).toBe(1852);
    expect(nmToMeters(2.5)).toBe(4630);
    expect(metersToNm(926)).toBe(0.5);
  });
});

describe("lib/chart-math · grados/minutos y formato", () => {
  it("descompone y recompone grados y minutos", () => {
    expect(toDegreesMinutes(2.8333)).toEqual({ degrees: 2, minutes: 50 });
    expect(toDegreesMinutes(41.3917)).toEqual({ degrees: 41, minutes: 23.5 });
    expect(toDegreesMinutes(1.99999)).toEqual({ degrees: 2, minutes: 0 });
    expect(fromDegreesMinutes(2, 50, true)).toBeCloseTo(-2.8333, 3);
    expect(fromDegreesMinutes(41, 23.5)).toBeCloseTo(41.3917, 3);
  });

  it("formatea correcciones con E/W", () => {
    expect(formatEW(-0.5)).toBe("0°30'W");
    expect(formatEW(1.5)).toBe("1°30'E");
    expect(formatEW(-3)).toBe("3°W");
    expect(formatEW(0)).toBe("0°");
  });

  it("formatea rumbos a tres dígitos", () => {
    expect(formatRumbo(86.7)).toBe("087°");
    expect(formatRumbo(5)).toBe("005°");
    expect(formatRumbo(359.6)).toBe("000°");
  });

  it("formatea coordenadas con minutos y coma decimal", () => {
    expect(formatLat(41.3917)).toBe("41°23,5'N");
    expect(formatLat(-36.5)).toBe("36°30'S");
    expect(formatLon(-2.225)).toBe("2°13,5'W");
    expect(formatLon(3.1)).toBe("3°6'E");
  });

  it("formatea duraciones y horas", () => {
    expect(formatDuration(2.5)).toBe("2 h 30 min");
    expect(formatDuration(0.5)).toBe("30 min");
    expect(formatDuration(2)).toBe("2 h");
    expect(formatHm(new Date(2026, 6, 14, 9, 5))).toBe("09:05");
  });
});
