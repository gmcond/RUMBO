"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { loginSchema, onboardingSchema, registerSchema } from "@/lib/validation/auth";

export type AuthFormState = {
  error?: string;
  success?: string;
};

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function safeNext(value: FormDataEntryValue | null, fallback = "/estudio") {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : fallback;
}

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const t = await getTranslations("auth");

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t("authError") };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (error.code === "invalid_credentials") return { error: t("invalidCredentials") };
    if (error.code === "email_not_confirmed") return { error: t("emailNotConfirmed") };
    return { error: t("authError") };
  }

  redirect(safeNext(formData.get("next")));
}

export async function register(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const t = await getTranslations("auth");

  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t("authError") };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback?next=/onboarding` },
  });

  if (error) {
    if (error.code === "user_already_exists") return { error: t("emailInUse") };
    if (error.code === "weak_password") return { error: t("weakPassword") };
    return { error: t("authError") };
  }

  // Con confirmación de email activada, signUp de un correo ya registrado
  // devuelve un usuario "fantasma" sin identidades (anti-enumeración).
  if (data.user && data.user.identities?.length === 0) {
    return { error: t("emailInUse") };
  }

  if (data.session) {
    redirect("/onboarding");
  }

  return { success: t("checkEmail") };
}

export async function signInWithGoogle(formData: FormData) {
  const supabase = await createClient();
  const next = safeNext(formData.get("next"));

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}` },
  });

  if (error || !data.url) {
    redirect("/login?error=oauth");
  }

  redirect(data.url);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function completeOnboarding(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const t = await getTranslations("auth");

  const degreeIdRaw = formData.get("degreeId");
  const parsed = onboardingSchema.safeParse({
    nombre: formData.get("nombre"),
    ccaa: formData.get("ccaa"),
    degreeId: typeof degreeIdRaw === "string" && degreeIdRaw !== "" ? degreeIdRaw : null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t("authError") };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/onboarding");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      nombre: parsed.data.nombre,
      ccaa_objetivo: parsed.data.ccaa,
      degree_objetivo: parsed.data.degreeId,
      onboarding_completado: true,
    })
    .eq("user_id", user.id);

  if (error) {
    return { error: t("authError") };
  }

  redirect("/estudio");
}
