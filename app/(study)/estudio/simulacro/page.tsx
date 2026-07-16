import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AlertTriangle, Clock, ListChecks, Target } from "lucide-react";

import {
  SimulacroHistoryChart,
  type SimulacroHistoryPoint,
} from "@/components/study/simulacro-history-chart";
import { SimulacroResumeBanner } from "@/components/study/simulacro-resume-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CCAA } from "@/lib/ccaa";
import { parseTopes } from "@/lib/exam-grading";
import { getActiveDegree } from "@/lib/study/data";
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

  const degree = await getActiveDegree(supabase);
  if (!degree) return null;

  // El historial se acota a los simulacros de la titulación activa vía sus
  // exam_configs, así que estas se resuelven primero.
  const { data: configs, error } = await supabase
    .from("exam_configs")
    .select("id, ccaa, num_preguntas, duracion_min, min_aciertos, topes")
    .eq("degree_id", degree.id)
    .order("ccaa");
  if (error) throw new Error(`exam_configs: ${error.message}`);

  const [{ data: degrees }, { data: simulacros }, profileCcaa] = await Promise.all([
    supabase.from("degrees").select("slug, nombre"),
    (configs ?? []).length > 0
      ? supabase
          .from("attempts")
          .select("id, aciertos, veredicto, respuestas, duracion_seg, created_at")
          .eq("tipo", "simulacro")
          .in(
            "exam_config_id",
            (configs ?? []).map((c) => c.id)
          )
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
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

  if (!configs || configs.length === 0) {
    return <p className="text-muted-foreground">{t("noConfig")}</p>;
  }

  const degreeNames = Object.fromEntries((degrees ?? []).map((d) => [d.slug, d.nombre]));

  // Por defecto: la comunidad del perfil si tiene config; si no, Cataluña.
  const defaultConfig =
    configs.find((c) => c.ccaa === profileCcaa) ??
    configs.find((c) => c.ccaa === "CAT") ??
    configs[0];
  const defaultCcaa = defaultConfig.ccaa;

  const points: SimulacroHistoryPoint[] = (simulacros ?? []).map((s) => ({
    date: s.created_at,
    aciertos: s.aciertos,
    total: Array.isArray(s.respuestas) ? s.respuestas.length : 0,
    veredicto: s.veredicto,
  }));
  const recent = [...(simulacros ?? [])].reverse().slice(0, 10);
  const listFormat = new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      <SimulacroResumeBanner activeDegreeSlug={degree.slug} degreeNames={degreeNames} />

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
                      <AlertTriangle className="text-warning size-3.5" aria-hidden />
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("historyTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {points.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("historyEmpty")}</p>
          ) : (
            <>
              {points.length >= 2 && (
                <SimulacroHistoryChart points={points} minAciertos={defaultConfig.min_aciertos} />
              )}
              <ul className="divide-y">
                {recent.map((s) => {
                  const total = Array.isArray(s.respuestas) ? s.respuestas.length : 0;
                  const apto = s.veredicto === "APTO";
                  return (
                    <li key={s.id} className="flex items-center gap-3 py-2.5 text-sm">
                      <span className="text-muted-foreground w-28 shrink-0 text-xs">
                        {listFormat.format(new Date(s.created_at))}
                      </span>
                      <span className="font-medium tabular-nums">
                        {s.aciertos}/{total}
                      </span>
                      {s.duracion_seg !== null && (
                        <span className="text-muted-foreground flex items-center gap-1 text-xs">
                          <Clock className="size-3.5" aria-hidden />
                          {Math.round(s.duracion_seg / 60)} min
                        </span>
                      )}
                      <Badge
                        variant="outline"
                        className={
                          apto
                            ? "border-success/60 text-success ml-auto"
                            : "border-danger/60 text-danger ml-auto"
                        }
                      >
                        {apto ? t("apto") : t("noApto")}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
