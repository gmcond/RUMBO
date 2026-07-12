import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Estudio" };

export default async function StudyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("nombre, onboarding_completado")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile && !profile.onboarding_completado) {
      redirect("/onboarding");
    }
  }

  const t = await getTranslations("study");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Fase 0 · Fundación</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{t("placeholder")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
