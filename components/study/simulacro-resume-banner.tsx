"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Clock, PauseCircle, Play, Trash2 } from "lucide-react";

import { clearStoredSimulacro, readStoredSimulacro } from "@/components/study/simulacro-runner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Summary {
  degreeSlug: string;
  answered: number;
  total: number;
  modo: "examen" | "practica";
  /** Segundos restantes (null en práctica). */
  remaining: number | null;
}

/**
 * Avisos en la portada del simulador sobre sesiones guardadas en el
 * dispositivo (una por titulación, F4):
 * - la de la titulación ACTIVA ofrece reanudar (?resume=1) o descartar;
 * - las de otras titulaciones se conservan y solo se informa de que existen
 *   (se reanudan volviendo a esa titulación), con opción de descartarlas.
 */
export function SimulacroResumeBanner({
  activeDegreeSlug,
  degreeNames,
}: {
  activeDegreeSlug: string;
  degreeNames: Record<string, string>;
}) {
  const t = useTranslations("study.simulacro");
  const [summaries, setSummaries] = useState<Summary[]>([]);

  useEffect(() => {
    const found: Summary[] = [];
    for (const slug of Object.keys(degreeNames)) {
      const stored = readStoredSimulacro(slug);
      if (!stored) continue;
      found.push({
        degreeSlug: slug,
        answered: Object.keys(stored.selected).length,
        total: stored.questions.length,
        modo: stored.modo,
        remaining:
          stored.endsAt !== null
            ? Math.max(0, Math.round((stored.endsAt - Date.now()) / 1000))
            : null,
      });
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación desde localStorage, solo posible en cliente
    setSummaries(found);
  }, [degreeNames]);

  if (summaries.length === 0) return null;

  const discard = (slug: string) => {
    clearStoredSimulacro(slug);
    setSummaries((prev) => prev.filter((s) => s.degreeSlug !== slug));
  };

  return (
    <>
      {summaries.map((summary) =>
        summary.degreeSlug === activeDegreeSlug ? (
          <Card key={summary.degreeSlug} className="border-amber-500/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("inProgressTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-muted-foreground text-sm">
                {t("inProgressBody", {
                  answered: summary.answered,
                  total: summary.total,
                  mode: summary.modo === "examen" ? t("modeExam") : t("modePractice"),
                })}
              </p>
              {summary.remaining !== null &&
                (summary.remaining > 0 ? (
                  <p className="flex items-center gap-1.5 text-sm tabular-nums">
                    <Clock className="size-4" aria-hidden />
                    {t("resumeTimeLeft", { time: formatTime(summary.remaining) })}
                  </p>
                ) : (
                  <p className="text-destructive text-sm">{t("resumeTimeUp")}</p>
                ))}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild size="sm">
                  <Link href="/estudio/simulacro/activo?resume=1">
                    <Play aria-hidden />
                    {t("resume")}
                  </Link>
                </Button>
                <Button size="sm" variant="outline" onClick={() => discard(summary.degreeSlug)}>
                  <Trash2 aria-hidden />
                  {t("discard")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card key={summary.degreeSlug}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <PauseCircle className="text-muted-foreground size-4" aria-hidden />
                {t("inProgressOtherTitle", {
                  degree: degreeNames[summary.degreeSlug] ?? summary.degreeSlug.toUpperCase(),
                })}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-muted-foreground text-sm">
                {t("inProgressOtherBody", {
                  answered: summary.answered,
                  total: summary.total,
                })}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="self-start"
                onClick={() => discard(summary.degreeSlug)}
              >
                <Trash2 aria-hidden />
                {t("discard")}
              </Button>
            </CardContent>
          </Card>
        )
      )}
    </>
  );
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
