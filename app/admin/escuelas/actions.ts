"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { schoolAdminSchema } from "@/lib/validation/content";

/**
 * Gestión del directorio de escuelas (PRD §M4): moderación de sugerencias,
 * alta manual y badge de verificada. Corre bajo RLS con la sesión del admin.
 */

const moderationSchema = z.object({
  id: z.string().uuid(),
  estado: z.enum(["published", "rejected", "pending"]),
});

const verifySchema = z.object({
  id: z.string().uuid(),
  verificada: z.enum(["true", "false"]).transform((v) => v === "true"),
});

async function assertUpdated(data: { id: string }[] | null, error: { message: string } | null) {
  if (error) throw new Error(`schools: ${error.message}`);
  if (!data || data.length === 0) throw new Error("Sin permisos para gestionar escuelas");
}

export async function moderateSchool(formData: FormData) {
  const parsed = moderationSchema.parse({
    id: formData.get("id"),
    estado: formData.get("estado"),
  });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("schools")
    .update({ estado: parsed.estado })
    .eq("id", parsed.id)
    .select("id");
  await assertUpdated(data, error);

  revalidatePath("/admin/escuelas");
  revalidatePath("/escuelas");
}

export async function setSchoolVerified(formData: FormData) {
  const parsed = verifySchema.parse({
    id: formData.get("id"),
    verificada: formData.get("verificada"),
  });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("schools")
    .update({ verificada: parsed.verificada })
    .eq("id", parsed.id)
    .select("id");
  await assertUpdated(data, error);

  revalidatePath("/admin/escuelas");
  revalidatePath("/escuelas");
}

export async function createSchool(formData: FormData) {
  const parsed = schoolAdminSchema.parse({
    nombre: formData.get("nombre"),
    ccaa: formData.get("ccaa"),
    ciudad: formData.get("ciudad"),
    web: formData.get("web") ?? "",
    modalidades: formData.getAll("modalidades"),
    verificada: formData.get("verificada") ?? false,
  });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("schools")
    .insert({
      nombre: parsed.nombre,
      ccaa: parsed.ccaa,
      ciudad: parsed.ciudad,
      web: parsed.web,
      modalidades: parsed.modalidades,
      verificada: parsed.verificada,
      estado: "published",
      origen: "admin",
    })
    .select("id");
  await assertUpdated(data, error);

  revalidatePath("/admin/escuelas");
  revalidatePath("/escuelas");
}
