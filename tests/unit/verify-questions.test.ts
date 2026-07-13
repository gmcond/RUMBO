import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { unitSections, validateVerification } from "@/scripts/verify-questions";

const seedDir = path.join(process.cwd(), "content", "seed");
const manual = readFileSync(path.join(seedDir, "manual-per.md"), "utf8");
const extras = JSON.parse(readFileSync(path.join(seedDir, "questions-extra.json"), "utf8"));
const verifications = JSON.parse(
  readFileSync(path.join(seedDir, "questions-extra-verification.json"), "utf8")
);

describe("verificación de preguntas ai_generated contra el manual", () => {
  it("el manual tiene las 11 secciones de UT", () => {
    const sections = unitSections(manual);
    expect([...sections.keys()].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("cada pregunta tiene veredicto y cada cita existe en la sección de su UT", () => {
    const problems = validateVerification(manual, extras, verifications);
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("los hold llevan motivo y los publish llevan citas", () => {
    for (const v of verifications) {
      if (v.verdict === "hold") {
        expect(v.motivo, v.enunciado).toBeTruthy();
      } else {
        expect(v.citas.length, v.enunciado).toBeGreaterThan(0);
      }
    }
  });
});
