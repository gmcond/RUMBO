"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, XCircle } from "lucide-react";

import { submitTest, type GradedResult } from "@/app/(study)/estudio/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { DisplayQuestion } from "@/lib/study/data";
import { cn } from "@/lib/utils";

export interface TestQuestion extends DisplayQuestion {
  unit: number;
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Runner de tests por unidad: navegación pregunta a pregunta, cronómetro
 * simple y corrección server-side con explicación (registra el attempt).
 */
export function TestRunner({ questions }: { questions: TestQuestion[] }) {
  const t = useTranslations("study.tests");
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [result, setResult] = useState<GradedResult | null>(null);
  const [error, setError] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [isPending, startTransition] = useTransition();
  const finishedRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!finishedRef.current) setElapsed((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const unanswered = questions.length - Object.keys(selected).length;

  const handleFinish = () => {
    if (unanswered > 0 && !window.confirm(t("confirmFinish"))) return;
    setError(false);
    startTransition(async () => {
      try {
        const graded = await submitTest({
          respuestas: questions.map((q) => ({
            questionId: q.questionId,
            elegida: selected[q.questionId] !== undefined ? q.map[selected[q.questionId]] : null,
          })),
          duracionSeg: elapsed,
        });
        finishedRef.current = true;
        setResult(graded);
      } catch {
        setError(true);
      }
    });
  };

  if (result) {
    const byId = new Map(result.corrections.map((c) => [c.questionId, c]));
    return (
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>{t("resultTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-2xl font-bold">
              {t("score", { aciertos: result.aciertos, total: result.total })}
            </p>
            <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <Clock className="size-4" aria-hidden />
              {t("time", { time: formatTime(elapsed) })}
            </p>
            <div>
              <p className="mb-1.5 text-sm font-medium">{t("byUnit")}</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(result.desglosePorUt)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([unit, stats]) => (
                    <Badge
                      key={unit}
                      variant={stats.fallos === 0 ? "secondary" : "destructive"}
                    >
                      {t("utShort", { numero: unit })} {stats.aciertos}/{stats.total}
                    </Badge>
                  ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild size="sm">
                <Link href="/estudio/tests">{t("newTest")}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <section className="flex flex-col gap-3" aria-label={t("review")}>
          <h2 className="text-lg font-semibold">{t("review")}</h2>
          {questions.map((q, qIndex) => {
            const c = byId.get(q.questionId);
            if (!c) return null;
            const chosenText = c.elegida !== null ? q.opciones[q.map.indexOf(c.elegida)] : null;
            const correctText = q.opciones[q.map.indexOf(c.correcta)];
            return (
              <Card key={q.questionId} className={cn(!c.ok && "border-red-500/50")}>
                <CardContent className="flex flex-col gap-2 pt-4">
                  <p className="font-medium">
                    {qIndex + 1}. {q.enunciado}
                  </p>
                  <p className="flex items-start gap-2 text-sm">
                    {c.ok ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                    ) : (
                      <XCircle className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
                    )}
                    <span>
                      <span className="text-muted-foreground">{t("yourAnswer")}</span>{" "}
                      {chosenText ?? t("blank")}
                    </span>
                  </p>
                  {!c.ok && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">{t("correctAnswer")}</span>{" "}
                      <span className="font-medium">{correctText}</span>
                    </p>
                  )}
                  {c.explicacion && (
                    <p className="text-muted-foreground text-sm">
                      <span className="font-medium">{t("explanation")}</span> {c.explicacion}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </section>
      </div>
    );
  }

  const q = questions[index];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">
          {t("question", { current: index + 1, total: questions.length })}
        </p>
        <p className="text-muted-foreground flex items-center gap-1.5 text-sm tabular-nums">
          <Clock className="size-4" aria-hidden />
          {formatTime(elapsed)}
        </p>
      </div>
      <Progress value={(index / questions.length) * 100} />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">{q.enunciado}</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup
            key={q.questionId}
            value={selected[q.questionId]?.toString() ?? ""}
            onValueChange={(value) =>
              setSelected((s) => ({ ...s, [q.questionId]: Number(value) }))
            }
          >
            {q.opciones.map((opcion, displayIndex) => (
              <div
                key={displayIndex}
                className="hover:bg-muted/50 flex items-center gap-2 rounded-md border px-3 py-2.5"
              >
                <RadioGroupItem
                  value={displayIndex.toString()}
                  id={`${q.questionId}-${displayIndex}`}
                />
                <Label
                  htmlFor={`${q.questionId}-${displayIndex}`}
                  className="flex-1 cursor-pointer font-normal"
                >
                  {opcion}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {error && <p className="text-destructive text-sm">{t("error")}</p>}

      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={index === 0}
          onClick={() => setIndex((i) => i - 1)}
        >
          <ArrowLeft aria-hidden />
          {t("prev")}
        </Button>

        <span className="text-muted-foreground text-xs">
          {t("unanswered", { count: unanswered })}
        </span>

        {index < questions.length - 1 ? (
          <Button variant="outline" size="sm" onClick={() => setIndex((i) => i + 1)}>
            {t("next")}
            <ArrowRight aria-hidden />
          </Button>
        ) : (
          <Button size="sm" disabled={isPending} onClick={handleFinish}>
            {isPending ? t("finishing") : t("finish")}
          </Button>
        )}
      </div>
    </div>
  );
}
