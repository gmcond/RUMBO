import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseUnits } from "@/scripts/seed";

const manual = readFileSync(path.join(process.cwd(), "content", "seed", "manual-per.md"), "utf8");

describe("parseUnits (manual-per.md)", () => {
  const units = parseUnits(manual);

  it("extrae las 11 UT oficiales en orden", () => {
    expect(units.map((u) => u.numero)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("cada UT tiene título y descripción no vacíos", () => {
    for (const u of units) {
      expect(u.titulo.length, `UT${u.numero} titulo`).toBeGreaterThan(3);
      expect(u.descripcion.length, `UT${u.numero} descripcion`).toBeGreaterThan(20);
    }
  });

  it("los títulos coinciden con el temario del RD 875/2014", () => {
    expect(units[0]?.titulo).toBe("Nomenclatura náutica");
    expect(units[4]?.titulo).toContain("Balizamiento");
    expect(units[5]?.titulo).toContain("RIPA");
    expect(units[10]?.titulo).toContain("Carta de navegación");
  });

  it("las descripciones de los bloques eliminatorios lo indican", () => {
    expect(units[4]?.descripcion).toContain("eliminatorio");
    expect(units[5]?.descripcion).toContain("eliminatorio");
    expect(units[10]?.descripcion).toContain("eliminatorio");
  });
});
