"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const questionFormSchema = z.object({
  id: z.string().uuid(),
  unit_id: z.string().uuid(),
  enunciado: z.string().trim().min(10),
  opciones: z.tuple([
    z.string().trim().min(1),
    z.string().trim().min(1),
    z.string().trim().min(1),
    z.string().trim().min(1),
  ]),
  correcta: z.coerce.number().int().min(0).max(3),
  explicacion: z
    .string()
    .trim()
    .transform((s) => (s.length > 0 ? s : null)),
  dificultad: z
    .string()
    .transform((s) => (s === "" ? null : Number(s)))
    .pipe(z.number().int().min(1).max(5).nullable()),
});

function parseForm(formData: FormData) {
  return questionFormSchema.parse({
    id: formData.get("id"),
    unit_id: formData.get("unit_id"),
    enunciado: formData.get("enunciado"),
    opciones: [
      formData.get("opcion0"),
      formData.get("opcion1"),
      formData.get("opcion2"),
      formData.get("opcion3"),
    ],
    correcta: formData.get("correcta"),
    explicacion: formData.get("explicacion") ?? "",
    dificultad: formData.get("dificultad") ?? "",
  });
}

/**
 * Guarda la pregunta y opcionalmente cambia su estado. La RLS solo permite
 * la escritura a is_admin(); el .select() posterior falla en voz alta si la
 * fila no se tocó.
 */
async function updateQuestion(formData: FormData, estado?: "published" | "draft") {
  const parsed = parseForm(formData);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("questions")
    .update({
      unit_id: parsed.unit_id,
      enunciado: parsed.enunciado,
      opciones: parsed.opciones,
      correcta: parsed.correcta,
      explicacion: parsed.explicacion,
      dificultad: parsed.dificultad,
      ...(estado ? { estado } : {}),
    })
    .eq("id", parsed.id)
    .select("id");

  if (error) throw new Error(`questions: ${error.message}`);
  if (!data || data.length === 0) throw new Error("Sin permisos para editar preguntas");

  revalidatePath("/admin/preguntas");
  redirect("/admin/preguntas");
}

export async function saveQuestion(formData: FormData) {
  await updateQuestion(formData);
}

/** PRD §7.4: publicar contenido en review es decisión exclusiva del admin. */
export async function approveQuestion(formData: FormData) {
  await updateQuestion(formData, "published");
}

export async function rejectQuestion(formData: FormData) {
  await updateQuestion(formData, "draft");
}
