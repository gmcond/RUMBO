import { z } from "zod";

import { CCAA_CODES } from "@/lib/ccaa";

/**
 * Esquemas de la información viva (PRD §M4/§M5): lo que extrae el pipeline
 * update-content, el diff de los changesets y el formulario público de
 * sugerencia de escuela. Toda entrada externa pasa por aquí (CLAUDE.md).
 */

export const SCHOOL_MODALIDADES = ["presencial", "online", "semipresencial"] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "fecha ISO (YYYY-MM-DD)");

/** Un valor extraído por la IA siempre viene con cita y confianza por campo. */
function extracted<T extends z.ZodTypeAny>(value: T) {
  return z.object({
    value,
    source_url: z.string().url(),
    confidence: z.number().min(0).max(1),
  });
}

const tasaSchema = z.object({
  importe_eur: z.number().nonnegative(),
  concepto: z.string().min(3),
});

export const tasasValueSchema = z.object({
  examen: tasaSchema.nullable(),
  expedicion: tasaSchema.nullable(),
});

export const sedesValueSchema = z.array(
  z.object({ nombre: z.string().min(2), ciudad: z.string().min(2).nullable() })
);

export const enlacesValueSchema = z.array(
  z.object({ titulo: z.string().min(3), url: z.string().url() })
);

const fuentesSchema = z.array(z.object({ url: z.string().url(), titulo: z.string().min(1) }));

const convocatoriaExtractionSchema = z.object({
  fecha_examen: isoDate.nullable(),
  plazo_inicio: isoDate.nullable(),
  plazo_fin: isoDate.nullable(),
  sede: z.string().min(2).nullable(),
  enlace: z.string().url().nullable(),
  estado: z.enum(["prevista", "inscripcion_abierta", "cerrada", "celebrada"]),
  source_url: z.string().url(),
  confidence: z.number().min(0).max(1),
});

const escuelaExtractionSchema = z.object({
  nombre: z.string().min(3),
  ciudad: z.string().min(2),
  web: z.string().url().nullable(),
  modalidades: z.array(z.enum(SCHOOL_MODALIDADES)).default([]),
  source_url: z.string().url(),
  confidence: z.number().min(0).max(1),
});

/**
 * Payload completo que debe devolver el modelo, discriminado por scope.
 * tasas/normativa actualizan campos de ccaa_info; convocatorias/escuelas
 * proponen filas (el diff por fila lo arma el pipeline).
 */
export const extractionResultSchema = z.discriminatedUnion("scope", [
  z.object({
    scope: z.literal("tasas"),
    ccaa: z.enum(CCAA_CODES),
    fields: z.object({
      tasas: extracted(tasasValueSchema),
      sedes: extracted(sedesValueSchema).optional(),
    }),
    fuentes: fuentesSchema,
  }),
  z.object({
    scope: z.literal("normativa"),
    ccaa: z.enum(CCAA_CODES),
    fields: z
      .object({
        organismo: extracted(z.string().min(3)).optional(),
        particularidades_md: extracted(z.string().min(10)).optional(),
        enlaces: extracted(enlacesValueSchema).optional(),
      })
      .refine((f) => Object.values(f).some(Boolean), "al menos un campo extraído"),
    fuentes: fuentesSchema,
  }),
  z.object({
    scope: z.literal("convocatorias"),
    ccaa: z.enum(CCAA_CODES),
    convocatorias: z.array(convocatoriaExtractionSchema).min(1),
    fuentes: fuentesSchema,
  }),
  z.object({
    scope: z.literal("escuelas"),
    ccaa: z.enum(CCAA_CODES),
    escuelas: z.array(escuelaExtractionSchema).min(1),
    fuentes: fuentesSchema,
  }),
]);

export type ExtractionResult = z.infer<typeof extractionResultSchema>;

/** Entrada del diff campo a campo tal y como se guarda en content_changesets.diff. */
export const diffEntrySchema = z.object({
  old: z.unknown().nullable(),
  new: z.unknown(),
  source_url: z.string().url(),
  confidence: z.number().min(0).max(1),
});

export const changesetDiffSchema = z.record(z.string(), diffEntrySchema);

/**
 * Formulario público de sugerencia de escuela. `empresa` es un honeypot:
 * campo oculto que un humano deja vacío; si llega relleno, se rechaza.
 */
export const schoolSuggestionSchema = z.object({
  nombre: z.string().trim().min(3).max(120),
  ccaa: z.enum(CCAA_CODES),
  ciudad: z.string().trim().min(2).max(80),
  web: z
    .string()
    .trim()
    .max(200)
    .transform((s) => (s.length > 0 ? s : null))
    .pipe(z.string().url().nullable()),
  modalidades: z.array(z.enum(SCHOOL_MODALIDADES)).max(3).default([]),
  empresa: z.literal(""),
});
