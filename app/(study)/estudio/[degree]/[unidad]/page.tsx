import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, CheckCircle2, Circle, Layers, ListChecks, Shapes } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDegree, getUnit, parseUnidadParam } from "@/lib/study/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Unidad" };

export default async function UnitPage({
  params,
}: {
  params: Promise<{ degree: string; unidad: string }>;
}) {
  const { degree: degreeSlug, unidad } = await params;
  const numero = parseUnidadParam(unidad);
  if (!numero) notFound();

  const supabase = await createClient();
  const degree = await getDegree(supabase, degreeSlug);
  if (!degree) notFound();
  const unit = await getUnit(supabase, degree.id, numero);
  if (!unit) notFound();

  const t = await getTranslations("study");

  const [{ data: lessons }, { data: progress }, { data: diagrams }, { count: conceptCount }] =
    await Promise.all([
      supabase
        .from("lessons")
        .select("id, slug, titulo, orden")
        .eq("unit_id", unit.id)
        .order("orden"),
      supabase.from("lesson_progress").select("lesson_id"),
      supabase.from("diagrams").select("id, titulo").eq("unit_id", unit.id),
      supabase.from("concepts").select("id", { count: "exact", head: true }).eq("unit_id", unit.id),
    ]);

  const completedIds = new Set((progress ?? []).map((p) => p.lesson_id));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href={`/estudio/${degree.slug}`}>
            <ArrowLeft aria-hidden />
            {degree.nombre}
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          UT{unit.numero} · {unit.titulo}
        </h1>
        {unit.descripcion && <p className="text-muted-foreground mt-2">{unit.descripcion}</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link href={`/estudio/flashcards/ut${unit.numero}`}>
            <Layers aria-hidden />
            {t("flashcardsCta")}
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={`/estudio/tests?ut=${unit.numero}`}>
            <ListChecks aria-hidden />
            {t("testCta")}
          </Link>
        </Button>
        {typeof conceptCount === "number" && conceptCount > 0 && (
          <Badge variant="secondary" className="self-center">
            {t("concepts", { count: conceptCount })}
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("lessons")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {(lessons ?? []).map((lesson) => {
              const done = completedIds.has(lesson.id);
              return (
                <li key={lesson.id}>
                  <Link
                    href={`/estudio/${degree.slug}/ut${unit.numero}/${lesson.slug}`}
                    className="hover:bg-muted/50 -mx-2 flex items-center gap-3 rounded-md px-2 py-3"
                  >
                    {done ? (
                      <CheckCircle2
                        className="text-success size-5 shrink-0"
                        aria-label={t("completed")}
                      />
                    ) : (
                      <Circle className="text-muted-foreground/40 size-5 shrink-0" aria-hidden />
                    )}
                    <span className="text-muted-foreground text-sm tabular-nums">
                      {unit.numero}.{lesson.orden}
                    </span>
                    <span className="font-medium">{lesson.titulo}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {(diagrams ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("diagrams")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {(diagrams ?? []).map((diagram) => (
              <Button key={diagram.id} asChild variant="outline" className="justify-start">
                <Link href={`/estudio/${degree.slug}/ut${unit.numero}/diagramas/${diagram.id}`}>
                  <Shapes aria-hidden />
                  {diagram.titulo}
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
