import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AlertTriangle, Clock, ListChecks, Target } from "lucide-react";

import { SimulacroResumeBanner } from "@/components/study/simulacro-resume-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CCAA } from "@/lib/ccaa";
import { parseTopes } from "@/lib/exam-grading";
import { getDegree } from "@/lib/study/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Simulador de examen" };

const ccaaName = (code: string) => CCAA.find((c) => c.code === code)?.name ?? code;

/**
 * Portada del simulador: selector de comunidad (solo las que tienen
 * exam_config), modo examen/práctica y arranque. Formulario GET puro, como
 * el configurador de tests.
 */
export default async function SimulacroPage() {
  const t = await getTranslations("study.simulacro");
  const supabase = await createClient();

  const degree = await getDegree(supabase, "per");
  if (!degree) return null;

  const [{ data: configs, error }, profileCcaa] = await Promise.all([
    supabase
      .from("exam_configs")
      .select("id, ccaa, num_preguntas, duracion_min, min_aciertos, topes")
      .eq("degree_id", degree.id)
      .order("ccaa"),
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("ccaa_objetivo")
        .eq("user_id", user.id)
        .maybeSingle();
      return profile?.ccaa_objetivo ?? null;
    })(),
  ]);
  if (error) throw new Error(`exam_configs: ${error.message}`);

  if (!configs || configs.length === 0) {
    return <p className="text-muted-foreground">{t("noConfig")}</p>;
  }

  // Por defecto: la comunidad del perfil si tiene config; si no, Cataluña.
  const defaultCcaa =
    configs.find((c) => c.ccaa === profileCcaa)?.ccaa ??
    configs.find((c) => c.ccaa === "CAT")?.ccaa ??
    configs[0].ccaa;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      <SimulacroResumeBanner />

      <form action="/estudio/simulacro/activo" method="get" className="flex flex-col gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("ccaaLegend")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {configs.map((config) => {
              const topes = parseTopes(config.topes);
              return (
                <label
                  key={config.id}
                  className="hover:bg-muted/50 flex cursor-pointer flex-col gap-2 rounded-md border px-3 py-2.5"
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="ccaa"
                      value={config.ccaa}
                      defaultChecked={config.ccaa === defaultCcaa}
                      className="accent-primary size-4"
                    />
                    <span className="text-sm font-medium">{ccaaName(config.ccaa)}</span>
                  </span>
                  <span className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 pl-7 text-xs">
                    <span className="flex items-center gap-1">
                      <ListChecks className="size-3.5" aria-hidden />
                      {t("rulesQuestions", { count: config.num_preguntas })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5" aria-hidden />
                      {t("rulesDuration", { min: config.duracion_min })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Target className="size-3.5" aria-hidden />
                      {t("rulesMin", { count: config.min_aciertos })}
                    </span>
                  </span>
                  {Object.keys(topes).length > 0 && (
                    <span className="flex flex-wrap items-center gap-1.5 pl-7">
                      <AlertTriangle
                        className="size-3.5 text-amber-600 dark:text-amber-400"
                        aria-hidden
                      />
                      {Object.entries(topes)
                        .sort(([a], [b]) => Number(a) - Number(b))
                        .map(([unit, tope]) => (
                          <Badge key={unit} variant="outline" className="text-xs">
                            {t("rulesTope", { unit, count: tope })}
                          </Badge>
                        ))}
                    </span>
                  )}
                </label>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("modeLegend")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 sm:flex-row">
            {(
              [
                ["examen", t("modeExam"), t("modeExamHint")],
                ["practica", t("modePractice"), t("modePracticeHint")],
              ] as const
            ).map(([value, label, hint]) => (
              <label
                key={value}
                className="hover:bg-muted/50 flex flex-1 cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5"
              >
                <input
                  type="radio"
                  name="modo"
                  value={value}
                  defaultChecked={value === "examen"}
                  className="accent-primary mt-0.5 size-4"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-muted-foreground text-xs">{hint}</span>
                </span>
              </label>
            ))}
          </CardContent>
        </Card>

        <Button type="submit" className="h-12 sm:self-start sm:px-8">
          {t("start")}
        </Button>
      </form>
    </div>
  );
}
