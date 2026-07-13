import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getDegree, getUnitsForDegree } from "@/lib/study/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Unidades" };

export default async function DegreePage({
  params,
}: {
  params: Promise<{ degree: string }>;
}) {
  const { degree: degreeSlug } = await params;
  const supabase = await createClient();

  const degree = await getDegree(supabase, degreeSlug);
  if (!degree) notFound();

  const t = await getTranslations("study");
  const units = await getUnitsForDegree(supabase, degree.id);

  const unitIds = units.map((u) => u.id);
  const [{ data: lessons }, { data: progress }, { data: examConfig }] = await Promise.all([
    supabase.from("lessons").select("id, unit_id").in("unit_id", unitIds),
    supabase.from("lesson_progress").select("lesson_id"),
    supabase
      .from("exam_configs")
      .select("topes")
      .eq("degree_id", degree.id)
      .eq("ccaa", "CAT")
      .maybeSingle(),
  ]);

  const completedIds = new Set((progress ?? []).map((p) => p.lesson_id));
  const topes = (examConfig?.topes ?? {}) as Record<string, number>;

  const byUnit = new Map<string, { total: number; completed: number }>();
  for (const lesson of lessons ?? []) {
    const bucket = byUnit.get(lesson.unit_id) ?? { total: 0, completed: 0 };
    bucket.total++;
    if (completedIds.has(lesson.id)) bucket.completed++;
    byUnit.set(lesson.unit_id, bucket);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{degree.nombre}</h1>
        <p className="text-muted-foreground mt-1">{t("units")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {units.map((unit) => {
          const stats = byUnit.get(unit.id) ?? { total: 0, completed: 0 };
          const pct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
          const tope = topes[String(unit.numero)];

          return (
            <Link key={unit.id} href={`/estudio/${degree.slug}/ut${unit.numero}`}>
              <Card className="hover:border-primary/50 h-full transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-start justify-between gap-2 text-base">
                    <span>
                      UT{unit.numero} · {unit.titulo}
                    </span>
                    {tope !== undefined && (
                      <Badge variant="destructive" className="shrink-0">
                        {t("eliminatory")}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <Progress value={pct} aria-label={`${pct}%`} />
                  <p className="text-muted-foreground text-sm">
                    {t("lessonsProgress", { completed: stats.completed, total: stats.total })}
                    {tope !== undefined && <> · {t("maxErrors", { count: tope })}</>}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
