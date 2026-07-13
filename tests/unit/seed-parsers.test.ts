import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  parseBateria,
  parseLessons,
  parseSimulacro,
  slugify,
  SIMULACRO_DISTRIBUCION,
} from "@/scripts/seed-parsers";

const manual = readFileSync(path.join(process.cwd(), "content", "seed", "manual-per.md"), "utf8");

describe("slugify", () => {
  it("quita acentos y símbolos", () => {
    expect(slugify("El casco y sus partes")).toBe("el-casco-y-sus-partes");
    expect(slugify("Fondeo, timón y hélice")).toBe("fondeo-timon-y-helice");
    expect(slugify("Atribuciones del PER y cuadro de títulos (RD 875/2014)")).toBe(
      "atribuciones-del-per-y-cuadro-de-titulos-rd-875-2014"
    );
  });
});

describe("parseLessons (manual-per.md)", () => {
  const lessons = parseLessons(manual);

  it("cubre las 11 UT con al menos una lección cada una", () => {
    const unidades = new Set(lessons.map((l) => l.unitNumero));
    expect([...unidades].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("las lecciones tienen título, slug y cuerpo no vacíos", () => {
    for (const l of lessons) {
      expect(l.titulo.length, `UT${l.unitNumero}.${l.orden}`).toBeGreaterThan(2);
      expect(l.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(l.cuerpoMd.length, `UT${l.unitNumero}.${l.orden} cuerpo`).toBeGreaterThan(50);
    }
  });

  it("los slugs son únicos por unidad", () => {
    const keys = lessons.map((l) => `${l.unitNumero}/${l.slug}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("el orden replica la numeración n.m del manual", () => {
    const ut1 = lessons.filter((l) => l.unitNumero === 1).map((l) => l.orden);
    expect(ut1).toEqual([1, 2, 3, 4, 5]);
    expect(lessons.find((l) => l.unitNumero === 1 && l.orden === 1)?.titulo).toBe(
      "El casco y sus partes"
    );
  });

  it("la introducción extra de la UT se conserva en su primera lección", () => {
    // UT5 explica las regiones IALA antes de la primera subsección.
    const ut5first = lessons.find((l) => l.unitNumero === 5 && l.orden === 1);
    expect(ut5first?.cuerpoMd).toContain("Región A");
  });

  it("no arrastra contenido ajeno a las UT (batería, consejos…)", () => {
    for (const l of lessons) {
      expect(l.cuerpoMd).not.toContain("**R:");
      expect(l.cuerpoMd).not.toContain("Hoja de respuestas");
    }
  });
});

describe("parseBateria (manual-per.md)", () => {
  const questions = parseBateria(manual);

  it("extrae exactamente 60 preguntas numeradas 1..60", () => {
    expect(questions).toHaveLength(60);
    expect(questions.map((q) => q.numero)).toEqual(Array.from({ length: 60 }, (_, i) => i + 1));
  });

  it("cada pregunta tiene 4 opciones no vacías y correcta en rango", () => {
    for (const q of questions) {
      expect(q.opciones, `pregunta ${q.numero}`).toHaveLength(4);
      for (const o of q.opciones) expect(o.length).toBeGreaterThan(0);
      expect(q.correcta).toBeGreaterThanOrEqual(0);
      expect(q.correcta).toBeLessThanOrEqual(3);
    }
  });

  it("mapea la UT desde las subsecciones (reparto real del manual)", () => {
    const byUnit = new Map<number, number>();
    for (const q of questions) byUnit.set(q.unitNumero, (byUnit.get(q.unitNumero) ?? 0) + 1);
    expect(byUnit.get(1)).toBe(5);
    expect(byUnit.get(5)).toBe(6);
    expect(byUnit.get(6)).toBe(12);
    expect(byUnit.get(7)).toBe(3);
    expect(byUnit.get(11)).toBe(5);
  });

  it("extrae respuestas y explicaciones verificables contra el manual", () => {
    const q1 = questions[0];
    expect(q1.enunciado).toBe("La parte del casco bajo la flotación se llama:");
    expect(q1.opciones).toEqual(["obra muerta", "obra viva", "francobordo", "regala"]);
    expect(q1.correcta).toBe(1);
    expect(q1.explicacion).toBe("la carena");

    const q20 = questions.find((q) => q.numero === 20);
    expect(q20?.correcta).toBe(0); // velocidad máxima en zona de baño: a) 3 nudos
  });
});

describe("parseSimulacro (manual-per.md)", () => {
  const questions = parseSimulacro(manual);

  it("extrae exactamente 45 preguntas numeradas 1..45", () => {
    expect(questions).toHaveLength(45);
    expect(questions.map((q) => q.numero)).toEqual(Array.from({ length: 45 }, (_, i) => i + 1));
  });

  it("respeta la distribución oficial 4+2+4+2+5+10+2+3+4+5+4", () => {
    const byUnit = new Map<number, number>();
    for (const q of questions) byUnit.set(q.unitNumero, (byUnit.get(q.unitNumero) ?? 0) + 1);
    SIMULACRO_DISTRIBUCION.forEach((count, i) => {
      expect(byUnit.get(i + 1), `UT${i + 1}`).toBe(count);
    });
  });

  it("cruza la hoja de respuestas (no todas son b)", () => {
    const byNumero = new Map(questions.map((q) => [q.numero, q]));
    expect(byNumero.get(1)?.correcta).toBe(1); // 1-b
    expect(byNumero.get(16)?.correcta).toBe(2); // 16-c
    expect(byNumero.get(30)?.correcta).toBe(0); // 30-a
    expect(byNumero.get(43)?.correcta).toBe(0); // 43-a
    expect(byNumero.get(45)?.correcta).toBe(1); // 45-b
  });

  it("cada pregunta tiene 4 opciones y no incluye los avisos en blockquote", () => {
    for (const q of questions) {
      expect(q.opciones, `pregunta ${q.numero}`).toHaveLength(4);
      for (const o of q.opciones) {
        expect(o.length).toBeGreaterThan(0);
        expect(o).not.toContain("⚠️");
      }
    }
  });
});
