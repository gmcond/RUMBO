"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, RefreshCw, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  checkFieldAnswer,
  generateExercise,
  type ChartExercise,
  type ChartExerciseType,
  type ExerciseField,
} from "@/lib/study/chart-exercises";
import { cn } from "@/lib/utils";

/** "12,5" → 12.5 · "" → NaN. Acepta coma o punto decimal. */
function parseNumberInput(raw: string): number {
  if (raw.trim() === "") return NaN;
  return Number(raw.trim().replace(",", "."));
}

/** "12:30" → minutos desde medianoche. */
function parseTimeInput(raw: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
  if (!match) return NaN;
  return Number(match[1]) * 60 + Number(match[2]);
}

function parseInput(field: ExerciseField, raw: string): number {
  return field.kind === "time" ? parseTimeInput(raw) : parseNumberInput(raw);
}

/**
 * Ejercicio autocorregible de carta: genera datos aleatorios en cliente
 * (cálculo puro, sin BD), corrige con la tolerancia de cada campo y muestra
 * la resolución paso a paso con un esquema estático cuando el trazado ayuda.
 */
export function ChartExerciseTrainer({ tipo }: { tipo: ChartExerciseType }) {
  const t = useTranslations("study.carta");
  const [exercise, setExercise] = useState<ChartExercise | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);

  // La aleatoriedad no puede ejecutarse durante el render (reglas de React);
  // el ejercicio se genera al montar y al pedir otro.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- generación aleatoria diferida al cliente
    setExercise(generateExercise(tipo, new Date().getFullYear()));
  }, [tipo]);

  if (!exercise) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const regenerate = () => {
    setExercise(generateExercise(tipo, new Date().getFullYear()));
    setAnswers({});
    setChecked(false);
  };

  const results = checked
    ? Object.fromEntries(
        exercise.fields.map((f) => [f.id, checkFieldAnswer(f, parseInput(f, answers[f.id] ?? ""))])
      )
    : {};

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">{exercise.statement}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-1.5 text-sm font-medium">{t("data")}</p>
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {exercise.data.map((d) => (
              <div key={d.label} className="flex justify-between gap-3 sm:justify-start">
                <dt className="text-muted-foreground">{d.label}:</dt>
                <dd className="font-medium tabular-nums">{d.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("answers")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {exercise.fields.map((field) => {
            const ok = results[field.id];
            return (
              <div key={field.id} className="flex flex-col gap-1.5">
                <Label htmlFor={`field-${field.id}`}>{field.label}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id={`field-${field.id}`}
                    type={field.kind === "time" ? "time" : "text"}
                    inputMode={field.kind === "time" ? undefined : "decimal"}
                    autoComplete="off"
                    className={cn(
                      "max-w-48",
                      checked &&
                        (ok
                          ? "border-emerald-500/70 focus-visible:ring-emerald-500/40"
                          : "border-red-500/70 focus-visible:ring-red-500/40")
                    )}
                    value={answers[field.id] ?? ""}
                    disabled={checked}
                    onChange={(e) => setAnswers((a) => ({ ...a, [field.id]: e.target.value }))}
                  />
                  {checked &&
                    (ok ? (
                      <CheckCircle2
                        className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400"
                        aria-label={t("correct")}
                      />
                    ) : (
                      <XCircle
                        className="size-5 shrink-0 text-red-600 dark:text-red-400"
                        aria-label={t("incorrect")}
                      />
                    ))}
                </div>
                {checked && !ok && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">{t("expected")}</span>{" "}
                    <span className="font-medium">{field.display}</span>
                  </p>
                )}
              </div>
            );
          })}
          <p className="text-muted-foreground text-xs">{t("signHint")}</p>

          <div className="flex flex-wrap gap-2">
            {!checked ? (
              <Button onClick={() => setChecked(true)}>{t("check")}</Button>
            ) : (
              <Button onClick={regenerate}>
                <RefreshCw aria-hidden />
                {t("newExercise")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {checked && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("solution")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm">
              {exercise.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            {exercise.diagram && (
              <figure className="flex flex-col items-center gap-1.5">
                {exercise.diagram === "dos-demoras" ? <DosDemoraSvg /> : <RumboTangenteSvg />}
                <figcaption className="text-muted-foreground text-xs">
                  {t("diagramNote")}
                </figcaption>
              </figure>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** Esquema estático: dos demoras inversas que se cortan en el barco. */
function DosDemoraSvg() {
  return (
    <svg viewBox="0 0 320 180" className="max-w-xs" role="img" aria-hidden>
      <g stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.75">
        <line x1="60" y1="30" x2="170" y2="120" strokeDasharray="6 4" />
        <line x1="280" y1="50" x2="170" y2="120" strokeDasharray="6 4" />
      </g>
      <circle cx="60" cy="30" r="5" fill="currentColor" />
      <circle cx="280" cy="50" r="5" fill="currentColor" />
      <path d="M162 126 l8 -14 l8 14 z" fill="currentColor" opacity="0.9" />
      <text x="46" y="20" fontSize="11" fill="currentColor">
        Faro A
      </text>
      <text x="258" y="40" fontSize="11" fill="currentColor">
        Faro B
      </text>
      <text x="184" y="132" fontSize="11" fill="currentColor">
        Situación
      </text>
      <text x="86" y="86" fontSize="10" fill="currentColor" opacity="0.7">
        Dv A ± 180°
      </text>
      <text x="216" y="98" fontSize="10" fill="currentColor" opacity="0.7">
        Dv B ± 180°
      </text>
    </svg>
  );
}

/** Esquema estático: rumbo tangente que pasa a un resguardo del peligro. */
function RumboTangenteSvg() {
  return (
    <svg viewBox="0 0 320 180" className="max-w-xs" role="img" aria-hidden>
      <circle
        cx="220"
        cy="70"
        r="34"
        fill="none"
        stroke="currentColor"
        strokeDasharray="4 4"
        opacity="0.6"
      />
      <circle cx="220" cy="70" r="4" fill="currentColor" />
      <line
        x1="40"
        y1="160"
        x2="220"
        y2="70"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="6 4"
        opacity="0.6"
      />
      <line x1="40" y1="160" x2="256" y2="42" stroke="currentColor" strokeWidth="1.8" />
      <path d="M34 166 l10 -16 l8 14 z" fill="currentColor" opacity="0.9" />
      <text x="228" y="66" fontSize="11" fill="currentColor">
        Peligro
      </text>
      <text x="196" y="116" fontSize="10" fill="currentColor" opacity="0.7">
        resguardo
      </text>
      <text x="120" y="128" fontSize="10" fill="currentColor" opacity="0.7">
        demora
      </text>
      <text x="130" y="84" fontSize="10" fill="currentColor">
        rumbo tangente (α)
      </text>
    </svg>
  );
}
