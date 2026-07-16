import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";

import { ChartExerciseTrainer } from "@/components/study/chart-exercise-trainer";
import { Button } from "@/components/ui/button";
import { CHART_EXERCISE_TYPES, type ChartExerciseType } from "@/lib/study/chart-exercises";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tipo: string }>;
}): Promise<Metadata> {
  const { tipo } = await params;
  const info = CHART_EXERCISE_TYPES.find((t) => t.slug === tipo);
  return { title: info ? `Carta · ${info.titulo}` : "Trainer de carta" };
}

export default async function CartaEjercicioPage({
  params,
}: {
  params: Promise<{ tipo: string }>;
}) {
  const { tipo } = await params;
  const t = await getTranslations("study.carta");

  const info = CHART_EXERCISE_TYPES.find((item) => item.slug === tipo);
  if (!info) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{info.titulo}</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">{info.descripcion}</p>
        </div>
      </div>
      <ChartExerciseTrainer tipo={info.slug as ChartExerciseType} />
      <Button asChild variant="outline" size="sm" className="self-start">
        <Link href="/estudio/carta">
          <ArrowLeft aria-hidden />
          {t("backToCarta")}
        </Link>
      </Button>
    </div>
  );
}
