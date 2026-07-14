"use server";

import { revalidatePath } from "next/cache";

import {
  gradeExam,
  parseDistribucion,
  parseTopes,
  type NoAptoMotivo,
  type Veredicto,
} from "@/lib/exam-grading";
import { review, type SrsState } from "@/lib/srs";
import { createClient } from "@/lib/supabase/server";
import {
  completeLessonSchema,
  gradeCardSchema,
  quizSubmissionSchema,
  setActiveDegreeSchema,
  simulacroSubmissionSchema,
  testSubmissionSchema,
  type Answer,
} from "@/lib/validation/study";

/** Corrección de una pregunta que el cliente solo ve tras enviar. */
export interface QuestionCorrection {
  questionId: string;
  unit: number;
  elegida: number | null;
  correcta: number;
  ok: boolean;
  explicacion: string | null;
}

export interface GradedResult {
  corrections: QuestionCorrection[];
  aciertos: number;
  total: number;
  desglosePorUt: Record<string, { aciertos: number; fallos: number; total: number }>;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  return { supabase, user };
}

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Corrige respuestas contra la BD (el cliente nunca recibe `correcta` antes
 * de enviar) y devuelve el desglose por UT. Blanco cuenta como fallo.
 */
async function gradeAnswers(supabase: ServerSupabase, answers: Answer[]): Promise<GradedResult> {
  const ids = answers.map((a) => a.questionId);
  const { data: questions, error } = await supabase
    .from("questions")
    .select("id, correcta, explicacion, units(numero)")
    .in("id", ids);
  if (error) throw new Error(`No se pudieron corregir las preguntas: ${error.message}`);

  const byId = new Map((questions ?? []).map((q) => [q.id, q]));
  const corrections: QuestionCorrection[] = [];
  const desglosePorUt: GradedResult["desglosePorUt"] = {};

  for (const answer of answers) {
    const q = byId.get(answer.questionId);
    if (!q) throw new Error("Pregunta no disponible");

    const ok = answer.elegida !== null && answer.elegida === q.correcta;
    const unit = q.units.numero;
    corrections.push({
      questionId: q.id,
      unit,
      elegida: answer.elegida,
      correcta: q.correcta,
      ok,
      explicacion: q.explicacion,
    });

    const bucket = (desglosePorUt[String(unit)] ??= { aciertos: 0, fallos: 0, total: 0 });
    bucket.total++;
    if (ok) bucket.aciertos++;
    else bucket.fallos++;
  }

  return {
    corrections,
    aciertos: corrections.filter((c) => c.ok).length,
    total: corrections.length,
    desglosePorUt,
  };
}

/**
 * Mazo "Mis fallos": cada pregunta fallada crea (o reactiva) su tarjeta SRS
 * con lapses ≥ 1 y vencimiento inmediato.
 */
async function registerFailures(supabase: ServerSupabase, userId: string, failedIds: string[]) {
  if (failedIds.length === 0) return;
  const nowIso = new Date().toISOString();

  const { data: existing, error } = await supabase
    .from("srs_cards")
    .select("id, lapses, question_id")
    .in("question_id", failedIds);
  if (error) throw new Error(`srs_cards (lectura): ${error.message}`);

  const existingByQuestion = new Map((existing ?? []).map((c) => [c.question_id, c]));

  for (const card of existing ?? []) {
    const { error: updateError } = await supabase
      .from("srs_cards")
      .update({ lapses: card.lapses + 1, due_at: nowIso })
      .eq("id", card.id);
    if (updateError) throw new Error(`srs_cards (fallo): ${updateError.message}`);
  }

  const inserts = failedIds
    .filter((id) => !existingByQuestion.has(id))
    .map((id) => ({ user_id: userId, question_id: id, lapses: 1, due_at: nowIso }));
  if (inserts.length > 0) {
    const { error: insertError } = await supabase.from("srs_cards").insert(inserts);
    if (insertError) throw new Error(`srs_cards (alta): ${insertError.message}`);
  }
}

/** Mini-quiz de lección: corrige y alimenta "Mis fallos". No registra attempt. */
export async function submitQuiz(input: unknown): Promise<GradedResult> {
  const { supabase, user } = await requireUser();
  const { respuestas, lessonId } = quizSubmissionSchema.parse(input);

  const result = await gradeAnswers(supabase, respuestas);
  await registerFailures(
    supabase,
    user.id,
    result.corrections.filter((c) => !c.ok).map((c) => c.questionId)
  );

  if (lessonId) {
    const { error } = await supabase
      .from("lesson_progress")
      .upsert(
        { user_id: user.id, lesson_id: lessonId },
        { onConflict: "user_id,lesson_id", ignoreDuplicates: true }
      );
    if (error) throw new Error(`lesson_progress: ${error.message}`);
    revalidatePath("/estudio");
  }

  return result;
}

/** Test por unidades: corrige, registra el attempt inmutable y "Mis fallos". */
export async function submitTest(input: unknown): Promise<GradedResult> {
  const { supabase, user } = await requireUser();
  const { respuestas, duracionSeg } = testSubmissionSchema.parse(input);

  const result = await gradeAnswers(supabase, respuestas);

  // Shape fijado en el plan de F1: [{question_id, unit, elegida, correcta, ok}]
  const respuestasJson = result.corrections.map((c) => ({
    question_id: c.questionId,
    unit: c.unit,
    elegida: c.elegida,
    correcta: c.correcta,
    ok: c.ok,
  }));

  const { error } = await supabase.from("attempts").insert({
    user_id: user.id,
    tipo: "test",
    exam_config_id: null,
    respuestas: respuestasJson,
    aciertos: result.aciertos,
    desglose_por_ut: result.desglosePorUt,
    veredicto: null,
    duracion_seg: duracionSeg,
  });
  if (error) throw new Error(`attempts: ${error.message}`);

  await registerFailures(
    supabase,
    user.id,
    result.corrections.filter((c) => !c.ok).map((c) => c.questionId)
  );

  revalidatePath("/estudio");
  return result;
}

export interface SimulacroResult extends GradedResult {
  veredicto: Veredicto;
  motivos: NoAptoMotivo[];
}

/**
 * Simulacro en modo examen: corrige contra la BD, aplica la exam_config
 * (mínimo global + topes eliminatorios, blanco=fallo), registra el attempt
 * inmutable con veredicto y alimenta "Mis fallos".
 */
export async function submitSimulacro(input: unknown): Promise<SimulacroResult> {
  const { supabase, user } = await requireUser();
  const { configId, respuestas, duracionSeg } = simulacroSubmissionSchema.parse(input);

  const { data: config, error: configError } = await supabase
    .from("exam_configs")
    .select("id, num_preguntas, min_aciertos, distribucion, topes")
    .eq("id", configId)
    .single();
  if (configError || !config) throw new Error("Configuración de examen no encontrada");

  if (respuestas.length !== config.num_preguntas) {
    throw new Error("El simulacro no coincide con la configuración del examen");
  }

  const result = await gradeAnswers(supabase, respuestas);

  // El attempt alimenta el semáforo de preparación: exige que el pool
  // enviado respete la distribución por UT de la config.
  const distribucion = parseDistribucion(config.distribucion);
  const porUnidad = new Map<string, number>();
  for (const c of result.corrections) {
    porUnidad.set(String(c.unit), (porUnidad.get(String(c.unit)) ?? 0) + 1);
  }
  for (const [unit, needed] of Object.entries(distribucion)) {
    if ((porUnidad.get(unit) ?? 0) !== needed) {
      throw new Error("El simulacro no respeta la distribución por unidades");
    }
  }

  const grade = gradeExam(
    result.corrections.map((c) => ({ unit: c.unit, elegida: c.elegida, correcta: c.correcta })),
    { minAciertos: config.min_aciertos, topes: parseTopes(config.topes) }
  );

  const respuestasJson = result.corrections.map((c) => ({
    question_id: c.questionId,
    unit: c.unit,
    elegida: c.elegida,
    correcta: c.correcta,
    ok: c.ok,
  }));

  const { error } = await supabase.from("attempts").insert({
    user_id: user.id,
    tipo: "simulacro",
    exam_config_id: config.id,
    respuestas: respuestasJson,
    aciertos: grade.aciertos,
    desglose_por_ut: grade.desglosePorUt,
    veredicto: grade.veredicto,
    duracion_seg: duracionSeg,
  });
  if (error) throw new Error(`attempts: ${error.message}`);

  await registerFailures(
    supabase,
    user.id,
    result.corrections.filter((c) => !c.ok).map((c) => c.questionId)
  );

  revalidatePath("/estudio");
  return { ...result, veredicto: grade.veredicto, motivos: grade.motivos };
}

/**
 * Cambia la titulación activa del perfil (F4). Todo el área de estudio se
 * deriva de `profiles.degree_objetivo`, así que basta revalidar el layout.
 */
export async function setActiveDegree(input: unknown): Promise<void> {
  const { supabase, user } = await requireUser();
  const { degreeId } = setActiveDegreeSchema.parse(input);

  const { data: degree } = await supabase
    .from("degrees")
    .select("id")
    .eq("id", degreeId)
    .maybeSingle();
  if (!degree) throw new Error("Titulación no encontrada");

  const { error } = await supabase
    .from("profiles")
    .update({ degree_objetivo: degreeId })
    .eq("user_id", user.id);
  if (error) throw new Error(`profiles: ${error.message}`);

  revalidatePath("/estudio", "layout");
}

/** Marca una lección como completada (progreso binario del PRD). */
export async function completeLesson(input: unknown): Promise<void> {
  const { supabase, user } = await requireUser();
  const { lessonId } = completeLessonSchema.parse(input);

  const { error } = await supabase
    .from("lesson_progress")
    .upsert(
      { user_id: user.id, lesson_id: lessonId },
      { onConflict: "user_id,lesson_id", ignoreDuplicates: true }
    );
  if (error) throw new Error(`lesson_progress: ${error.message}`);

  revalidatePath("/estudio");
}

/** Aplica una calificación SM-2 a una tarjeta del usuario. */
export async function gradeCard(input: unknown): Promise<{ nextDueAt: string }> {
  const { supabase } = await requireUser();
  const { cardId, grade } = gradeCardSchema.parse(input);

  const { data: card, error } = await supabase
    .from("srs_cards")
    .select("id, ease, interval_days, reps, lapses")
    .eq("id", cardId)
    .single();
  if (error || !card) throw new Error("Tarjeta no encontrada");

  const state: SrsState = {
    ease: Number(card.ease),
    intervalDays: Number(card.interval_days),
    reps: card.reps,
    lapses: card.lapses,
  };
  const next = review(state, grade, new Date());

  const { error: updateError } = await supabase
    .from("srs_cards")
    .update({
      ease: next.ease,
      interval_days: next.intervalDays,
      reps: next.reps,
      lapses: next.lapses,
      due_at: next.dueAt.toISOString(),
    })
    .eq("id", cardId);
  if (updateError) throw new Error(`srs_cards: ${updateError.message}`);

  return { nextDueAt: next.dueAt.toISOString() };
}
