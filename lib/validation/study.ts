import { z } from "zod";

import { SRS_GRADES } from "@/lib/srs";

/** Respuesta a una pregunta dentro de un quiz o test (null = en blanco). */
export const answerSchema = z.object({
  questionId: z.string().uuid(),
  elegida: z.number().int().min(0).max(3).nullable(),
});

/** Mini-quiz de lección: corrige y crea tarjetas de fallo, sin attempt. */
export const quizSubmissionSchema = z.object({
  respuestas: z.array(answerSchema).min(1).max(10),
  /** Si viene, completar el quiz marca la lección como estudiada. */
  lessonId: z.string().uuid().optional(),
});

/** Test por unidades: corrige, registra attempt y crea tarjetas de fallo. */
export const testSubmissionSchema = z.object({
  respuestas: z.array(answerSchema).min(1).max(45),
  duracionSeg: z.number().int().min(0).max(60 * 60 * 6).nullable(),
});

export const completeLessonSchema = z.object({
  lessonId: z.string().uuid(),
});

export const gradeCardSchema = z.object({
  cardId: z.string().uuid(),
  grade: z.enum(SRS_GRADES as [string, ...string[]]).transform((g) => g as (typeof SRS_GRADES)[number]),
});

/** Filtros del configurador de tests. */
export const testConfigSchema = z.object({
  unidades: z.array(z.number().int().min(1).max(11)).min(1).max(11),
  numero: z.union([z.literal(5), z.literal(10), z.literal(20)]),
  filtro: z.enum(["todas", "falladas", "no-vistas"]),
});

export type Answer = z.infer<typeof answerSchema>;
export type TestConfig = z.infer<typeof testConfigSchema>;
