import { describe, expect, it } from "vitest";

import { buildChangesetDiff, diffToUpdatePayload, jsonEquals } from "@/lib/content-diff";
import { extractionResultSchema, schoolSuggestionSchema } from "@/lib/validation/content";

const cite = { source_url: "https://agricultura.gencat.cat/tasas", confidence: 0.9 };

describe("jsonEquals", () => {
  it("ignora el orden de claves en objetos anidados", () => {
    expect(
      jsonEquals(
        { examen: { importe_eur: 65.6, concepto: "Drets d'examen" }, expedicion: null },
        { expedicion: null, examen: { concepto: "Drets d'examen", importe_eur: 65.6 } }
      )
    ).toBe(true);
  });

  it("los arrays sí son sensibles al orden", () => {
    expect(jsonEquals([1, 2], [2, 1])).toBe(false);
  });

  it("distingue null de undefined-ausente y de 0", () => {
    expect(jsonEquals(null, 0)).toBe(false);
    expect(jsonEquals({ a: null }, {})).toBe(false);
  });
});

describe("buildChangesetDiff", () => {
  it("propone un campo nuevo con old=null cuando la fila actual lo tiene vacío", () => {
    const tasas = { examen: { importe_eur: 65.6, concepto: "Drets d'examen" }, expedicion: null };
    const diff = buildChangesetDiff({ tasas: null }, { tasas: { value: tasas, ...cite } });

    expect(diff).toEqual({ tasas: { old: null, new: tasas, ...cite } });
  });

  it("omite campos sin cambio real aunque las claves vengan en otro orden", () => {
    const current = { tasas: { examen: { importe_eur: 65.6, concepto: "x" }, expedicion: null } };
    const extracted = {
      tasas: {
        value: { expedicion: null, examen: { concepto: "x", importe_eur: 65.6 } },
        ...cite,
      },
    };

    expect(buildChangesetDiff(current, extracted)).toEqual({});
  });

  it("conserva el valor actual en old cuando cambia", () => {
    const diff = buildChangesetDiff(
      { organismo: "Organismo antiguo" },
      { organismo: { value: "Organismo nuevo", ...cite } }
    );

    expect(diff.organismo.old).toBe("Organismo antiguo");
    expect(diff.organismo.new).toBe("Organismo nuevo");
  });

  it("acepta fila actual null (changeset de creación) y campos extraídos undefined", () => {
    const diff = buildChangesetDiff(null, {
      nombre: { value: "Escola Nàutica", ...cite },
      web: undefined,
    });

    expect(Object.keys(diff)).toEqual(["nombre"]);
    expect(diff.nombre.old).toBeNull();
  });

  it("cada entrada del diff arrastra su propia cita y confianza", () => {
    const otherCite = { source_url: "https://www.boe.es/rd875", confidence: 0.7 };
    const diff = buildChangesetDiff(
      {},
      {
        organismo: { value: "A", ...cite },
        particularidades_md: { value: "B", ...otherCite },
      }
    );

    expect(diff.organismo.source_url).toBe(cite.source_url);
    expect(diff.particularidades_md.source_url).toBe(otherCite.source_url);
    expect(diff.particularidades_md.confidence).toBe(0.7);
  });
});

describe("diffToUpdatePayload", () => {
  it("mapea cada campo a su valor nuevo", () => {
    const payload = diffToUpdatePayload({
      tasas: { old: null, new: { examen: null, expedicion: null }, ...cite },
      organismo: { old: "x", new: "y", ...cite },
    });

    expect(payload).toEqual({ tasas: { examen: null, expedicion: null }, organismo: "y" });
  });
});

describe("extractionResultSchema", () => {
  const tasasPayload = {
    scope: "tasas",
    ccaa: "CAT",
    fields: {
      tasas: {
        value: { examen: { importe_eur: 65.6, concepto: "Drets d'examen PER" }, expedicion: null },
        source_url: "https://agricultura.gencat.cat/tasas",
        confidence: 0.85,
      },
    },
    fuentes: [{ url: "https://agricultura.gencat.cat/tasas", titulo: "Taxes nàutiques" }],
  };

  it("acepta un payload de tasas válido", () => {
    expect(extractionResultSchema.parse(tasasPayload).scope).toBe("tasas");
  });

  it("rechaza un campo extraído sin source_url", () => {
    const sinFuente = structuredClone(tasasPayload) as Record<string, unknown>;
    delete (sinFuente.fields as { tasas: Record<string, unknown> }).tasas.source_url;

    expect(extractionResultSchema.safeParse(sinFuente).success).toBe(false);
  });

  it("rechaza confidence fuera de [0,1] y ccaa desconocida", () => {
    expect(
      extractionResultSchema.safeParse({
        ...tasasPayload,
        fields: { tasas: { ...tasasPayload.fields.tasas, confidence: 1.5 } },
      }).success
    ).toBe(false);
    expect(extractionResultSchema.safeParse({ ...tasasPayload, ccaa: "XXX" }).success).toBe(false);
  });

  it("exige al menos una convocatoria/escuela en esos scopes", () => {
    expect(
      extractionResultSchema.safeParse({
        scope: "convocatorias",
        ccaa: "CAT",
        convocatorias: [],
        fuentes: [],
      }).success
    ).toBe(false);
  });
});

describe("sedesValueSchema (vía extractionResultSchema)", () => {
  it("acepta sedes sin ciudad y la normaliza a null (evita reintentos caros)", () => {
    const parsed = extractionResultSchema.parse({
      scope: "tasas",
      ccaa: "CAT",
      fields: {
        tasas: {
          value: { examen: null, expedicion: null },
          source_url: "https://nautica.gencat.cat/taxes",
          confidence: 0.5,
        },
        sedes: {
          value: [{ nombre: "Oficina de Girona" }],
          source_url: "https://nautica.gencat.cat/taxes",
          confidence: 0.8,
        },
      },
      fuentes: [],
    });

    if (parsed.scope !== "tasas") throw new Error("scope inesperado");
    expect(parsed.fields.sedes?.value).toEqual([{ nombre: "Oficina de Girona", ciudad: null }]);
  });
});

describe("schoolSuggestionSchema", () => {
  const base = {
    nombre: "Escola Nàutica Exemple",
    ccaa: "CAT",
    ciudad: "Barcelona",
    web: "https://example.com",
    modalidades: ["presencial"],
    empresa: "",
  };

  it("acepta una sugerencia válida y normaliza web vacía a null", () => {
    expect(schoolSuggestionSchema.parse(base).web).toBe("https://example.com");
    expect(schoolSuggestionSchema.parse({ ...base, web: "" }).web).toBeNull();
  });

  it("rechaza el honeypot relleno (bot)", () => {
    expect(schoolSuggestionSchema.safeParse({ ...base, empresa: "spam" }).success).toBe(false);
  });

  it("rechaza web que no es URL", () => {
    expect(schoolSuggestionSchema.safeParse({ ...base, web: "no-es-url" }).success).toBe(false);
  });
});
