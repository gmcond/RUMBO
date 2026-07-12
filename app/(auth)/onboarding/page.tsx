import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Onboarding" };

export default async function OnboardingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/onboarding");
  }

  const [{ data: profile }, { data: degrees }] = await Promise.all([
    supabase
      .from("profiles")
      .select("nombre, onboarding_completado")
      .eq("user_id", user.id)
      .single(),
    supabase.from("degrees").select("id, slug, nombre").order("orden"),
  ]);

  if (profile?.onboarding_completado) {
    redirect("/estudio");
  }

  const t = await getTranslations("onboarding");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <OnboardingForm degrees={degrees ?? []} defaultName={profile?.nombre ?? ""} />
      </CardContent>
    </Card>
  );
}
