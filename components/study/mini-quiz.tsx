"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, XCircle } from "lucide-react";

import { completeLesson, submitQuiz, type GradedResult } from "@/app/(study)/estudio/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { DisplayQuestion } from "@/lib/study/data";
import { cn } from "@/lib/utils";

/**
 * Mini-quiz de 3 preguntas al final de cada lección. La corrección viene del
 * servidor (el cliente nunca conoce la respuesta antes de enviar) y al
 * corregir se marca la lección como completada.
 */
export function MiniQuiz({
  lessonId,
  questions,
}: {
  lessonId: string;
  questions: DisplayQuestion[];
}) {
  const t = useTranslations("study.quiz");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [result, setResult] = useState<GradedResult | null>(null);
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-muted-foreground text-sm">{t("noQuestions")}</p>
        <Button size="sm" onClick={() => startTransition(() => completeLesson({ lessonId }))}>
          {t("markDone")}
        </Button>
      </div>
    );
  }

  const correctionFor = (questionId: string) =>
    result?.corrections.find((c) => c.questionId === questionId) ?? null;

  const handleSubmit = () => {
    setError(false);
    startTransition(async () => {
      try {
        const graded = await submitQuiz({
          lessonId,
          respuestas: questions.map((q) => ({
            questionId: q.questionId,
            elegida: selected[q.questionId] !== undefined ? q.map[selected[q.questionId]] : null,
          })),
        });
        setResult(graded);
      } catch {
        setError(true);
      }
    });
  };

  return (
    <section aria-label={t("title")} className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold">{t("title")}</h2>
        <p className="text-muted-foreground text-sm">{t("help")}</p>
      </div>

      {questions.map((q, qIndex) => {
        const correction = correctionFor(q.questionId);
        return (
          <Card key={q.questionId}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">
                {qIndex + 1}. {q.enunciado}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <RadioGroup
                value={selected[q.questionId]?.toString() ?? ""}
                onValueChange={(value) =>
                  setSelected((s) => ({ ...s, [q.questionId]: Number(value) }))
                }
                disabled={result !== null || isPending}
              >
                {q.opciones.map((opcion, displayIndex) => {
                  const original = q.map[displayIndex];
                  const isCorrect = correction !== null && original === correction.correcta;
                  const isChosenWrong =
                    correction !== null && !correction.ok && original === correction.elegida;
                  return (
                    <div
                      key={displayIndex}
                      className={cn(
                        "flex items-center gap-2 rounded-md border px-3 py-2",
                        isCorrect && "border-success bg-success/10",
                        isChosenWrong && "border-danger bg-danger/10"
                      )}
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
                      {isCorrect && (
                        <CheckCircle2 className="text-success size-4 shrink-0" aria-hidden />
                      )}
                      {isChosenWrong && (
                        <XCircle className="text-danger size-4 shrink-0" aria-hidden />
                      )}
                    </div>
                  );
                })}
              </RadioGroup>

              {correction && !correction.ok && correction.elegida === null && (
                <p className="text-muted-foreground text-sm">{t("blank")}</p>
              )}
              {correction?.explicacion && (
                <p className="text-muted-foreground text-sm">
                  <span className="font-medium">{t("explanation")}</span> {correction.explicacion}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}

      {error && <p className="text-destructive text-sm">{t("error")}</p>}

      {result === null ? (
        <Button onClick={handleSubmit} disabled={isPending} className="self-start">
          {isPending ? t("submitting") : t("submit")}
        </Button>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-medium">
            {t("score", { aciertos: result.aciertos, total: result.total })}
          </p>
          <p className="text-success flex items-center gap-1 text-sm">
            <CheckCircle2 className="size-4" aria-hidden />
            {t("lessonDone")}
          </p>
        </div>
      )}
    </section>
  );
}
