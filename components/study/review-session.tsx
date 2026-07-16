"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CheckCircle2, Lightbulb } from "lucide-react";

import { gradeCard } from "@/app/(study)/estudio/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { SessionCard } from "@/lib/study/srs-queue";
import type { SrsGrade } from "@/lib/srs";
import { cn } from "@/lib/utils";

const GRADE_STYLES: Record<SrsGrade, string> = {
  again: "border-danger/60 text-danger hover:bg-danger/10",
  hard: "border-warning/60 text-warning hover:bg-warning/10",
  good: "border-success/60 text-success hover:bg-success/10",
  easy: "border-sky-500/60 text-sky-600 hover:bg-sky-500/10 dark:text-sky-400",
};

/**
 * Sesión de repaso SRS: muestra el anverso, se revela el reverso y se
 * califica con Otra vez/Difícil/Bien/Fácil (SM-2 en el servidor).
 * "Otra vez" reencola la tarjeta al final de la sesión.
 */
export function ReviewSession({ cards }: { cards: SessionCard[] }) {
  const t = useTranslations("study.flashcards");
  const [queue, setQueue] = useState(cards);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();

  const total = queue.length;
  const card = index < total ? queue[index] : null;

  if (!card) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="flex items-center gap-2 font-medium">
          <CheckCircle2 className="text-success size-5" aria-hidden />
          {t("sessionDone", { total: reviewed })}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/estudio/flashcards">{t("backToDecks")}</Link>
        </Button>
      </div>
    );
  }

  const handleGrade = (grade: SrsGrade) => {
    setError(false);
    startTransition(async () => {
      try {
        await gradeCard({ cardId: card.cardId, grade });
        setReviewed((n) => n + 1);
        if (grade === "again") {
          // La verá de nuevo al final de la sesión (vence "ahora" en BD).
          setQueue((q) => [...q, card]);
        }
        setRevealed(false);
        setIndex((i) => i + 1);
      } catch {
        setError(true);
      }
    });
  };

  const grades: SrsGrade[] = ["again", "hard", "good", "easy"];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Progress value={(index / total) * 100} className="flex-1" />
        <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
          {t("progress", { done: index, total })}
        </span>
      </div>

      <Card className="min-h-56">
        <CardContent className="flex flex-col gap-4 pt-6">
          <p className="text-lg font-semibold">{card.front}</p>

          {revealed && (
            <>
              <hr className="border-dashed" />
              <p className="text-base">{card.back}</p>
              {card.hint && (
                <p className="text-muted-foreground flex items-start gap-2 text-sm">
                  <Lightbulb className="text-warning mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    <span className="font-medium">
                      {card.kind === "concept" ? t("mnemonic") : t("explanation")}:
                    </span>{" "}
                    {card.hint}
                  </span>
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-destructive text-sm">{t("error")}</p>}

      {revealed ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {grades.map((grade) => (
            <Button
              key={grade}
              variant="outline"
              disabled={isPending}
              onClick={() => handleGrade(grade)}
              className={cn("h-12", GRADE_STYLES[grade])}
            >
              {t(grade)}
            </Button>
          ))}
        </div>
      ) : (
        <Button onClick={() => setRevealed(true)} className="h-12">
          {t("showAnswer")}
        </Button>
      )}
    </div>
  );
}
