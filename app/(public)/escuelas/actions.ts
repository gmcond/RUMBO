"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { schoolSuggestionSchema } from "@/lib/validation/content";

/**
 * Sugerencia pública de escuela (PRD §M4): entra SIEMPRE en moderación.
 * La RLS solo permite a anon/authenticated insertar filas
 * estado='pending' + origen='sugerencia' + verificada=false; publicarla es
 * decisión exclusiva del admin en /admin/escuelas.
 */
export async function suggestSchool(formData: FormData) {
  const parsed = schoolSuggestionSchema.safeParse({
    nombre: formData.get("nombre"),
    ccaa: formData.get("ccaa"),
    ciudad: formData.get("ciudad"),
    web: formData.get("web") ?? "",
    modalidades: formData.getAll("modalidades"),
    empresa: formData.get("empresa") ?? "",
  });

  // El honeypot relleno también acaba aquí: mismo mensaje, sin dar pistas.
  if (!parsed.success) {
    redirect("/escuelas?sugerencia=error");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("schools").insert({
    nombre: parsed.data.nombre,
    ccaa: parsed.data.ccaa,
    ciudad: parsed.data.ciudad,
    web: parsed.data.web,
    modalidades: parsed.data.modalidades,
    estado: "pending",
    origen: "sugerencia",
    verificada: false,
  });

  if (error) {
    redirect("/escuelas?sugerencia=error");
  }

  redirect("/escuelas?sugerencia=ok");
}
