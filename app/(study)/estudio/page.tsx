import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BookOpen, Compass, Layers, ListChecks, Timer } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { parseTopes, type UnitBreakdown } from "@/lib/exam-grading";
import { getDegree, getUnitsForDegree } from "@/lib/study/data";
import { computeReadiness } from "@/lib/study/readiness";
import { getUserCards, isDue } from "@/lib/study/srs-queue";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Estudio" };

export default async function StudyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profileCcaa: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("nombre, onboarding_completado, ccaa_objetivo")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile && !profile.onboarding_completado) {
      redirect("/onboarding");
    }
    profileCcaa = profile?.ccaa_objetivo ?? null;
  }

  const t = await getTranslations("study");
  const now = new Date();

  const degree = await getDegree(supabase, "per");
  if (!degree) {
    return <p className="text-muted-foreground">{t("panel.empty")}</p>;
  }
  const units = await getUnitsForDegree(supabase, degree.id);
  const unitIds = units.map((u) => u.id);

  const [
    { data: lessons },
    { data: progress },
    cards,
    { data: attempts },
    { data: simulacros },
    { data: examConfigs },
  ] = await Promise.all([
    supabase.from("lessons").select("id, unit_id").in("unit_id", unitIds),
    supabase.from("lesson_progress").select("lesson_id"),
    getUserCards(supabase),
    supabase
      .from("attempts")
      .select("id, aciertos, respuestas, desglose_por_ut, created_at")
      .eq("tipo", "test")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("attempts")
      .select("aciertos, desglose_por_ut")
      .eq("tipo", "simulacro")
      .order("created_at", { ascending: false })
      .limit(3),
    supabase.from("exam_configs").select("ccaa, min_aciertos, topes").eq("degree_id", degree.id),
  ]);

  // Semáforo: config de la comunidad del perfil (o Cataluña) + últimos 3 simulacros.
  const examConfig =
    examConfigs?.find((c) => c.ccaa === profileCcaa) ??
    examConfigs?.find((c) => c.ccaa === "CAT") ??
    examConfigs?.[0] ??
    null;
  const readiness = examConfig
    ? computeReadiness(
        (simulacros ?? []).map((s) => ({
          aciertos: s.aciertos,
          desglosePorUt: (s.desglose_por_ut ?? {}) as Record<string, UnitBreakdown>,
        })),
        { minAciertos: examConfig.min_aciertos, topes: parseTopes(examConfig.topes) }
      )
    : [];

  const completedIds = new Set((progress ?? []).map((p) => p.lesson_id));
  const byUnit = new Map<string, { total: number; completed: number }>();
  for (const lesson of lessons ?? []) {
    const bucket = byUnit.get(lesson.unit_id) ?? { total: 0, completed: 0 };
    bucket.total++;
    if (completedIds.has(lesson.id)) bucket.completed++;
    byUnit.set(lesson.unit_id, bucket);
  }

  const dueCount = cards.filter((c) => isDue(c, now)).length;
  const dateFormat = new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="text-muted-foreground size-4" aria-hidden />
              {t("units")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" className="w-full">
              <Link href={`/estudio/${degree.slug}`}>{t("panel.unitsCta")}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="text-muted-foreground size-4" aria-hidden />
              {t("panel.dueTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-muted-foreground text-sm">
              {t("panel.dueCount", { count: dueCount })}
            </p>
            <Button
              asChild
              size="sm"
              variant={dueCount > 0 ? "default" : "outline"}
              className="w-full"
            >
              <Link href="/estudio/flashcards">{t("panel.flashcardsCta")}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="text-muted-foreground size-4" aria-hidden />
              {t("tests.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="outline" className="w-full">
              <Link href="/estudio/tests">{t("panel.testsCta")}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Timer className="text-muted-foreground size-4" aria-hidden />
              {t("simulacro.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="outline" className="w-full">
              <Link href="/estudio/simulacro">{t("panel.simulacroCta")}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Compass className="text-muted-foreground size-4" aria-hidden />
              {t("carta.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="outline" className="w-full">
              <Link href="/estudio/carta">{t("panel.cartaCta")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("readiness.title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {readiness.length === 0 ? (
            <>
              <p className="text-muted-foreground text-sm">{t("readiness.empty")}</p>
              <Button asChild size="sm" className="self-start">
                <Link href="/estudio/simulacro">{t("readiness.emptyCta")}</Link>
              </Button>
            </>
          ) : (
            <>
              <ul className="flex flex-col gap-2">
                {readiness.map((row) => {
                  const unitInfo =
                    row.unit !== null ? units.find((u) => u.numero === row.unit) : null;
                  return (
                    <li key={row.unit ?? "global"} className="flex items-center gap-3">
                      <span
                        className={cn(
                          "size-2.5 shrink-0 rounded-full",
                          row.level === "green" && "bg-emerald-500",
                          row.level === "amber" && "bg-amber-500",
                          row.level === "red" && "bg-red-500"
                        )}
                        aria-hidden
                      />
                      <span className="sr-only">{t(`readiness.${row.level}`)}</span>
                      <span className="min-w-0 truncate text-sm font-medium">
                        {row.unit === null
                          ? t("readiness.global")
                          : `UT${row.unit}${unitInfo ? ` · ${unitInfo.titulo}` : ""}`}
                      </span>
                      <span className="text-muted-foreground ml-auto shrink-0 text-xs tabular-nums">
                        {row.unit === null
                          ? t("readiness.lastGlobal", { aciertos: row.lastValue, min: row.limit })
                          : t("readiness.lastBlock", { fallos: row.lastValue, tope: row.limit })}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-muted-foreground text-xs">
                {t("readiness.basedOn", { count: Math.min(simulacros?.length ?? 0, 3) })}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("panel.progressTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {units.map((unit) => {
            const stats = byUnit.get(unit.id) ?? { total: 0, completed: 0 };
            const pct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
            return (
              <Link
                key={unit.id}
                href={`/estudio/${degree.slug}/ut${unit.numero}`}
                className="hover:bg-muted/50 -mx-2 flex items-center gap-3 rounded-md px-2 py-1.5"
              >
                <span className="w-12 shrink-0 text-sm font-medium tabular-nums">
                  UT{unit.numero}
                </span>
                <Progress value={pct} className="flex-1" />
                <span className="text-muted-foreground w-20 shrink-0 text-right text-xs tabular-nums">
                  {t("lessonsProgress", { completed: stats.completed, total: stats.total })}
                </span>
              </Link>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("panel.recentTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {(attempts ?? []).length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("panel.noTests")}</p>
          ) : (
            <ul className="divide-y">
              {(attempts ?? []).map((attempt) => {
                const total = Array.isArray(attempt.respuestas) ? attempt.respuestas.length : 0;
                const desglose = (attempt.desglose_por_ut ?? {}) as Record<
                  string,
                  { aciertos: number; fallos: number; total: number }
                >;
                return (
                  <li key={attempt.id} className="flex items-center gap-3 py-2.5">
                    <span className="text-muted-foreground w-28 shrink-0 text-xs">
                      {dateFormat.format(new Date(attempt.created_at))}
                    </span>
                    <span className="font-medium tabular-nums">
                      {t("panel.testScore", { aciertos: attempt.aciertos, total })}
                    </span>
                    <span className="ml-auto flex flex-wrap justify-end gap-1">
                      {Object.entries(desglose)
                        .sort(([a], [b]) => Number(a) - Number(b))
                        .map(([unit, stats]) => (
                          <Badge
                            key={unit}
                            variant={stats.fallos === 0 ? "secondary" : "outline"}
                            className="text-xs"
                          >
                            UT{unit} {stats.aciertos}/{stats.total}
                          </Badge>
                        ))}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
