import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";

import { TestRunner, type TestQuestion } from "@/components/study/test-runner";
import { Button } from "@/components/ui/button";
import {
  getDegree,
  getLastAnswerMap,
  getUnitsForDegree,
  parseOpciones,
  shuffleOptions,
} from "@/lib/study/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Test" };

function toArray(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

export default async function PracticaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const t = await getTranslations("study.tests");
  const supabase = await createClient();

  const unidades = [
    ...new Set(
      toArray(params.ut)
        .map(Number)
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 11)
    ),
  ];
  const n = [5, 10, 20].includes(Number(params.n)) ? Number(params.n) : 10;
  const filtro = ["todas", "falladas", "no-vistas"].includes(String(params.filtro))
    ? String(params.filtro)
    : "todas";

  const backButton = (
    <Button asChild variant="outline" size="sm" className="self-start">
      <Link href="/estudio/tests">
        <ArrowLeft aria-hidden />
        {t("backToConfig")}
      </Link>
    </Button>
  );

  if (unidades.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground">{t("emptyPool")}</p>
        {backButton}
      </div>
    );
  }

  const degree = await getDegree(supabase, "per");
  if (!degree) return null;
  const units = await getUnitsForDegree(supabase, degree.id);
  const selectedUnits = units.filter((u) => unidades.includes(u.numero));

  const [{ data: pool, error }, lastAnswers] = await Promise.all([
    supabase
      .from("questions")
      .select("id, enunciado, opciones, units(numero)")
      .eq("estado", "published")
      .in("unit_id", selectedUnits.map((u) => u.id)),
    getLastAnswerMap(supabase),
  ]);
  if (error) throw new Error(`questions: ${error.message}`);

  let candidates = pool ?? [];
  if (filtro === "falladas") {
    candidates = candidates.filter((q) => lastAnswers.get(q.id) === false);
  } else if (filtro === "no-vistas") {
    candidates = candidates.filter((q) => !lastAnswers.has(q.id));
  }

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  const questions: TestQuestion[] = candidates.slice(0, n).map((q) => {
    const { opciones, map } = shuffleOptions(parseOpciones(q.opciones));
    return {
      questionId: q.id,
      enunciado: q.enunciado,
      opciones,
      map,
      unit: q.units.numero,
    };
  });

  if (questions.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground">{t("emptyPool")}</p>
        {backButton}
      </div>
    );
  }

  return <TestRunner questions={questions} />;
}
