"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Clock, Play, Trash2 } from "lucide-react";

import { clearStoredSimulacro, readStoredSimulacro } from "@/components/study/simulacro-runner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Summary {
  answered: number;
  total: number;
  modo: "examen" | "practica";
  /** Segundos restantes (null en práctica). */
  remaining: number | null;
}

/**
 * Aviso en la portada del simulador cuando hay una sesión guardada en el
 * dispositivo: reanudar salta al runner con ?resume=1 (restaura pool,
 * respuestas y hora de fin desde localStorage).
 */
export function SimulacroResumeBanner() {
  const t = useTranslations("study.simulacro");
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    const stored = readStoredSimulacro();
    if (!stored) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación desde localStorage, solo posible en cliente
    setSummary({
      answered: Object.keys(stored.selected).length,
      total: stored.questions.length,
      modo: stored.modo,
      remaining:
        stored.endsAt !== null
          ? Math.max(0, Math.round((stored.endsAt - Date.now()) / 1000))
          : null,
    });
  }, []);

  if (!summary) return null;

  return (
    <Card className="border-amber-500/50">
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
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              clearStoredSimulacro();
              setSummary(null);
            }}
          >
            <Trash2 aria-hidden />
            {t("discard")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
