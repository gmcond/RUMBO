"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { diffToUpdatePayload, type ChangesetDiff } from "@/lib/content-diff";
import { createClient } from "@/lib/supabase/server";
import {
  changesetDiffSchema,
  isApprovableTable,
  validateApprovedFields,
} from "@/lib/validation/content";

/**
 * Aprobación/rechazo de changesets (PRD §M5, paso 5): corre con la sesión del
 * admin bajo RLS — si el usuario no es admin, ninguna escritura llega a la BD.
 * Aprobar aplica el cambio a la tabla destino, sella last_verified_at,
 * registra en content_audit_log y revalida las páginas públicas afectadas.
 */

const idSchema = z.string().uuid();

async function loadPendingChangeset(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string
) {
  const { data: changeset, error } = await supabase
    .from("content_changesets")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw new Error(`content_changesets: ${error.message}`);
  if (changeset.estado !== "pending") {
    throw new Error("El changeset ya fue revisado");
  }
  return changeset;
}

async function markReviewed(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  estado: "approved" | "rejected"
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("content_changesets")
    .update({ estado, reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("estado", "pending")
    .select("id");
  if (error) throw new Error(`content_changesets: ${error.message}`);
  if (!data || data.length === 0) throw new Error("Sin permisos o changeset ya revisado");
}

/** Reconstruye el diff con los valores editados en el formulario. */
function mergeEditedDiff(diff: ChangesetDiff, formData: FormData): ChangesetDiff {
  const merged: ChangesetDiff = {};

  for (const [field, entry] of Object.entries(diff)) {
    const raw = formData.get(`value:${field}`);
    if (typeof raw !== "string") {
      merged[field] = entry;
      continue;
    }

    let value: unknown;
    if (typeof entry.new === "string") {
      value = raw;
    } else {
      try {
        value = raw.trim() === "" ? null : JSON.parse(raw);
      } catch {
        throw new Error(`JSON inválido en el campo ${field}`);
      }
    }
    merged[field] = { ...entry, new: value };
  }

  return merged;
}

function revalidatePublicPages(targetTable: string, ccaa: string | null, degreeSlug: string) {
  if (targetTable === "schools") {
    revalidatePath("/escuelas");
    return;
  }
  revalidatePath(`/titulos/${degreeSlug}`);
  if (ccaa) revalidatePath(`/titulos/${degreeSlug}/${ccaa}`);
}

type PendingChangeset = Awaited<ReturnType<typeof loadPendingChangeset>>;

/**
 * Titulación del changeset (F4): la fija el pipeline en degree_id; en filas
 * antiguas se resuelve vía la fila destino y, en último término, PER (toda
 * fila pre-F4 lo era).
 */
async function resolveDegree(
  supabase: Awaited<ReturnType<typeof createClient>>,
  changeset: PendingChangeset
): Promise<{ id: string; slug: string }> {
  if (changeset.degree_id) {
    const { data } = await supabase
      .from("degrees")
      .select("id, slug")
      .eq("id", changeset.degree_id)
      .maybeSingle();
    if (data) return data;
  }

  if (changeset.target_id && changeset.target_table !== "schools") {
    const { data: row } = await supabase
      .from(changeset.target_table as "ccaa_info" | "convocatorias")
      .select("degree_id")
      .eq("id", changeset.target_id)
      .maybeSingle();
    if (row?.degree_id) {
      const { data } = await supabase
        .from("degrees")
        .select("id, slug")
        .eq("id", row.degree_id)
        .maybeSingle();
      if (data) return data;
    }
  }

  const { data, error } = await supabase
    .from("degrees")
    .select("id, slug")
    .eq("slug", "per")
    .single();
  if (error) throw new Error(`degrees: ${error.message}`);
  return data;
}

export async function approveChangeset(formData: FormData) {
  const id = idSchema.parse(formData.get("id"));
  const supabase = await createClient();
  const changeset = await loadPendingChangeset(supabase, id);

  if (!isApprovableTable(changeset.target_table)) {
    throw new Error(`Tabla destino no soportada: ${changeset.target_table}`);
  }

  // z.unknown() marca old/new como opcionales en el tipo inferido aunque el
  // esquema los exige presentes; el cast repone el tipo real ya validado.
  const storedDiff = changesetDiffSchema.parse(changeset.diff) as ChangesetDiff;
  const diff = mergeEditedDiff(storedDiff, formData);
  const payload = validateApprovedFields(changeset.target_table, diffToUpdatePayload(diff));
  const now = new Date().toISOString();
  const primarySource = Object.values(diff)[0]?.source_url ?? null;
  const degree = await resolveDegree(supabase, changeset);

  let registroId = changeset.target_id;

  if (changeset.target_table === "ccaa_info") {
    if (!changeset.target_id) throw new Error("Changeset de ccaa_info sin fila destino");
    const { data, error } = await supabase
      .from("ccaa_info")
      .update({
        ...payload,
        last_verified_at: now,
        ...(primarySource ? { source_url: primarySource } : {}),
      })
      .eq("id", changeset.target_id)
      .select("id");
    if (error) throw new Error(`ccaa_info: ${error.message}`);
    if (!data || data.length === 0) throw new Error("Sin permisos para editar ccaa_info");
  } else if (changeset.target_table === "convocatorias") {
    const values = { ...payload, last_verified_at: now, source_url: primarySource };
    if (changeset.target_id) {
      const { error } = await supabase
        .from("convocatorias")
        .update(values)
        .eq("id", changeset.target_id);
      if (error) throw new Error(`convocatorias: ${error.message}`);
    } else {
      if (!changeset.ccaa) throw new Error("Changeset de convocatoria sin CCAA");
      const { data, error } = await supabase
        .from("convocatorias")
        .insert({ ...values, degree_id: degree.id, ccaa: changeset.ccaa })
        .select("id")
        .single();
      if (error) throw new Error(`convocatorias: ${error.message}`);
      registroId = data.id;
    }
  } else {
    // schools: las propuestas aprobadas se publican directamente
    if (changeset.target_id) {
      const schoolPayload = payload as {
        nombre?: string;
        ciudad?: string;
        web?: string | null;
        modalidades?: string[];
      };
      const { error } = await supabase
        .from("schools")
        .update(schoolPayload)
        .eq("id", changeset.target_id);
      if (error) throw new Error(`schools: ${error.message}`);
    } else {
      if (!changeset.ccaa) throw new Error("Changeset de escuela sin CCAA");
      const { data, error } = await supabase
        .from("schools")
        .insert({
          nombre: String(payload.nombre),
          ciudad: String(payload.ciudad),
          web: (payload.web as string | null) ?? null,
          modalidades: (payload.modalidades as string[]) ?? [],
          ccaa: changeset.ccaa,
          estado: "published",
          origen: "admin",
          verificada: false,
        })
        .select("id")
        .single();
      if (error) throw new Error(`schools: ${error.message}`);
      registroId = data.id;
    }
  }

  const { error: auditError } = await supabase.from("content_audit_log").insert({
    tabla: changeset.target_table,
    registro_id: registroId,
    cambio: JSON.parse(JSON.stringify({ diff, aplicado: payload })),
    changeset_id: changeset.id,
  });
  if (auditError) throw new Error(`content_audit_log: ${auditError.message}`);

  await markReviewed(supabase, id, "approved");
  revalidatePublicPages(changeset.target_table, changeset.ccaa, degree.slug);
  revalidatePath("/admin/changesets");
  redirect("/admin/changesets");
}

export async function rejectChangeset(formData: FormData) {
  const id = idSchema.parse(formData.get("id"));
  const supabase = await createClient();
  await loadPendingChangeset(supabase, id);
  await markReviewed(supabase, id, "rejected");
  revalidatePath("/admin/changesets");
  redirect("/admin/changesets");
}
