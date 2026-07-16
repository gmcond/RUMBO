import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";

import { Markdown } from "@/components/markdown";
import { MiniQuiz } from "@/components/study/mini-quiz";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getDegree, getUnit, parseUnidadParam, pickQuizQuestions } from "@/lib/study/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Lección" };

export default async function LessonPage({
  params,
}: {
  params: Promise<{ degree: string; unidad: string; leccion: string }>;
}) {
  const { degree: degreeSlug, unidad, leccion } = await params;
  const numero = parseUnidadParam(unidad);
  if (!numero) notFound();

  const supabase = await createClient();
  const degree = await getDegree(supabase, degreeSlug);
  if (!degree) notFound();
  const unit = await getUnit(supabase, degree.id, numero);
  if (!unit) notFound();

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, slug, titulo, orden, cuerpo_md")
    .eq("unit_id", unit.id)
    .order("orden");
  const lesson = (lessons ?? []).find((l) => l.slug === leccion);
  if (!lesson) notFound();

  const t = await getTranslations("study");

  const index = (lessons ?? []).findIndex((l) => l.id === lesson.id);
  const prev = index > 0 ? lessons![index - 1] : null;
  const next = index < (lessons?.length ?? 0) - 1 ? lessons![index + 1] : null;

  const [{ data: progress }, quizQuestions] = await Promise.all([
    supabase.from("lesson_progress").select("lesson_id").eq("lesson_id", lesson.id),
    pickQuizQuestions(supabase, unit.id, 3),
  ]);
  const completed = (progress ?? []).length > 0;

  const unitPath = `/estudio/${degree.slug}/ut${unit.numero}`;

  return (
    <article className="flex flex-col gap-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href={unitPath}>
            <ArrowLeft aria-hidden />
            UT{unit.numero} · {unit.titulo}
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {unit.numero}.{lesson.orden} {lesson.titulo}
          </h1>
          {completed && (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="text-success size-3.5" aria-hidden />
              {t("completed")}
            </Badge>
          )}
        </div>
      </div>

      <Markdown>{lesson.cuerpo_md}</Markdown>

      <Separator />

      <MiniQuiz lessonId={lesson.id} questions={quizQuestions} />

      <nav className="flex items-center justify-between gap-2">
        {prev ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`${unitPath}/${prev.slug}`}>
              <ArrowLeft aria-hidden />
              <span className="max-w-40 truncate">{prev.titulo}</span>
            </Link>
          </Button>
        ) : (
          <span />
        )}
        {next ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`${unitPath}/${next.slug}`}>
              <span className="max-w-40 truncate">{next.titulo}</span>
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        ) : (
          <span />
        )}
      </nav>
    </article>
  );
}
