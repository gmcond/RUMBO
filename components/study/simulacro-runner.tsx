"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Flag, RotateCcw, XCircle } from "lucide-react";

import { submitSimulacro, submitTest, type SimulacroResult } from "@/app/(study)/estudio/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { gradeExam } from "@/lib/exam-grading";
import type { DisplayQuestion } from "@/lib/study/data";
import { cn } from "@/lib/utils";

export type SimulacroModo = "examen" | "practica";

export interface SimulacroQuestion extends DisplayQuestion {
  unit: number;
  /** Índice ORIGINAL correcto y explicación: el servidor solo los envía en práctica. */
  correcta?: number;
  explicacion?: string | null;
}

export interface SimulacroConfig {
  configId: string;
  ccaa: string;
  duracionMin: number;
  minAciertos: number;
  topes: Record<string, number>;
}

/**
 * Sesión persistida en localStorage: en móvil el navegador recarga pestañas
 * con frecuencia, así que se guarda el pool completo (ids y opciones ya
 * barajadas), las respuestas y la HORA DE FIN absoluta — nunca un contador,
 * para que recargar no regale tiempo. En modo examen el pool guardado no
 * incluye `correcta`: reanudar no filtra respuestas.
 */
interface StoredSession {
  v: 1;
  modo: SimulacroModo;
  config: SimulacroConfig;
  questions: SimulacroQuestion[];
  selected: Record<string, number>;
  marked: string[];
  revealed: string[];
  index: number;
  startedAt: number;
  /** Epoch ms; null en modo práctica (sin límite de tiempo). */
  endsAt: number | null;
}

/**
 * F4: una clave por titulación, para que empezar un simulacro de PNB no pise
 * uno de PER a medias (y viceversa). La clave legada (pre-F4, sin sufijo) solo
 * pudo crearla un simulacro del PER y se lee/limpia como tal.
 */
const SIMULACRO_STORAGE_PREFIX = "rumbo.simulacro.v1";
const LEGACY_STORAGE_KEY = SIMULACRO_STORAGE_PREFIX;
const LEGACY_DEGREE_SLUG = "per";

export function simulacroStorageKey(degreeSlug: string): string {
  return `${SIMULACRO_STORAGE_PREFIX}.${degreeSlug}`;
}

function parseStoredSession(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      (parsed as StoredSession).v !== 1 ||
      !Array.isArray((parsed as StoredSession).questions) ||
      (parsed as StoredSession).questions.length === 0
    ) {
      return null;
    }
    return parsed as StoredSession;
  } catch {
    return null;
  }
}

export function readStoredSimulacro(degreeSlug: string): StoredSession | null {
  try {
    const keyed = parseStoredSession(window.localStorage.getItem(simulacroStorageKey(degreeSlug)));
    if (keyed) return keyed;
    if (degreeSlug === LEGACY_DEGREE_SLUG) {
      return parseStoredSession(window.localStorage.getItem(LEGACY_STORAGE_KEY));
    }
    return null;
  } catch {
    return null;
  }
}

export function clearStoredSimulacro(degreeSlug: string) {
  try {
    window.localStorage.removeItem(simulacroStorageKey(degreeSlug));
    if (degreeSlug === LEGACY_DEGREE_SLUG) {
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
  } catch {
    // Sin storage (modo privado antiguo): el simulacro funciona, sin reanudación.
  }
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

type Phase = "boot" | "deciding" | "running" | "finished";

export function SimulacroRunner({
  questions: freshQuestions,
  config: freshConfig,
  modo: freshModo,
  degreeSlug,
  autoResume,
}: {
  questions: SimulacroQuestion[];
  config: SimulacroConfig;
  modo: SimulacroModo;
  /** Titulación activa: acota la sesión persistida a su propia clave. */
  degreeSlug: string;
  autoResume?: boolean;
}) {
  const t = useTranslations("study.simulacro");

  const [phase, setPhase] = useState<Phase>("boot");
  const [saved, setSaved] = useState<StoredSession | null>(null);
  /** Instantánea de segundos restantes al detectar la sesión guardada. */
  const [savedRemaining, setSavedRemaining] = useState<number | null>(null);

  // Estado de la sesión activa (props o sesión restaurada).
  const [modo, setModo] = useState<SimulacroModo>(freshModo);
  const [config, setConfig] = useState<SimulacroConfig>(freshConfig);
  const [questions, setQuestions] = useState<SimulacroQuestion[]>(freshQuestions);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [marked, setMarked] = useState<string[]>([]);
  const [revealed, setRevealed] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [endsAt, setEndsAt] = useState<number | null>(null);

  const [nowTick, setNowTick] = useState(0);
  const [result, setResult] = useState<SimulacroResult | null>(null);
  const [finalSeconds, setFinalSeconds] = useState(0);
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();
  const submittingRef = useRef(false);

  const startFresh = useCallback(() => {
    const now = Date.now();
    clearStoredSimulacro(degreeSlug);
    setModo(freshModo);
    setConfig(freshConfig);
    setQuestions(freshQuestions);
    setSelected({});
    setMarked([]);
    setRevealed([]);
    setIndex(0);
    setStartedAt(now);
    setEndsAt(freshModo === "examen" ? now + freshConfig.duracionMin * 60_000 : null);
    setNowTick(now);
    setPhase("running");
  }, [freshConfig, freshModo, freshQuestions, degreeSlug]);

  const restore = useCallback((session: StoredSession) => {
    setModo(session.modo);
    setConfig(session.config);
    setQuestions(session.questions);
    setSelected(session.selected);
    setMarked(session.marked);
    setRevealed(session.revealed);
    setIndex(Math.min(session.index, session.questions.length - 1));
    setStartedAt(session.startedAt);
    setEndsAt(session.endsAt);
    setNowTick(Date.now());
    setPhase("running");
  }, []);

  // Arranque: si hay una sesión guardada se ofrece reanudar (o se reanuda
  // directamente si venimos del aviso de la portada con ?resume=1).
  useEffect(() => {
    if (phase !== "boot") return;
    /* eslint-disable react-hooks/set-state-in-effect -- hidratación desde
       localStorage: solo puede decidirse en cliente, tras el primer render */
    const stored = readStoredSimulacro(degreeSlug);
    if (!stored) {
      startFresh();
    } else if (autoResume) {
      restore(stored);
    } else {
      setSaved(stored);
      setSavedRemaining(
        stored.endsAt !== null ? Math.max(0, Math.round((stored.endsAt - Date.now()) / 1000)) : null
      );
      setPhase("deciding");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [phase, autoResume, restore, startFresh, degreeSlug]);

  // Persistencia continua de la sesión en curso.
  useEffect(() => {
    if (phase !== "running") return;
    const session: StoredSession = {
      v: 1,
      modo,
      config,
      questions,
      selected,
      marked,
      revealed,
      index,
      startedAt,
      endsAt,
    };
    try {
      window.localStorage.setItem(simulacroStorageKey(degreeSlug), JSON.stringify(session));
    } catch {
      // Storage lleno o bloqueado: seguimos sin persistencia.
    }
  }, [
    phase,
    modo,
    config,
    questions,
    selected,
    marked,
    revealed,
    index,
    startedAt,
    endsAt,
    degreeSlug,
  ]);

  // Reloj: recalcula siempre desde Date.now(), nunca decrementa un contador.
  useEffect(() => {
    if (phase !== "running") return;
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // Aviso al salir con un simulacro en curso (la sesión queda guardada igualmente).
  useEffect(() => {
    if (phase !== "running") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [phase]);

  const remaining = endsAt !== null ? Math.max(0, Math.round((endsAt - nowTick) / 1000)) : null;
  const elapsed = Math.max(0, Math.round((nowTick - startedAt) / 1000));
  const timeUp = modo === "examen" && phase === "running" && remaining === 0;
  const unanswered = questions.length - Object.keys(selected).length;

  const finish = useCallback(
    (auto: boolean) => {
      if (submittingRef.current || phase !== "running") return;
      if (!auto && unanswered > 0 && !window.confirm(t("confirmFinish", { count: unanswered }))) {
        return;
      }
      submittingRef.current = true;
      setError(false);

      const respuestas = questions.map((q) => ({
        questionId: q.questionId,
        elegida: selected[q.questionId] !== undefined ? q.map[selected[q.questionId]] : null,
      }));
      const duracionSeg =
        modo === "examen"
          ? Math.min(config.duracionMin * 60, config.duracionMin * 60 - (remaining ?? 0))
          : elapsed;

      startTransition(async () => {
        try {
          let simResult: SimulacroResult;
          if (modo === "examen") {
            simResult = await submitSimulacro({
              configId: config.configId,
              respuestas,
              duracionSeg,
            });
          } else {
            // Práctica: attempt tipo 'test' (sin veredicto en BD, no computa
            // en el semáforo) + veredicto ORIENTATIVO calculado en cliente.
            const graded = await submitTest({ respuestas, duracionSeg });
            const grade = gradeExam(
              questions.map((q) => ({
                unit: q.unit,
                elegida:
                  selected[q.questionId] !== undefined ? q.map[selected[q.questionId]] : null,
                correcta: q.correcta ?? -1,
              })),
              { minAciertos: config.minAciertos, topes: config.topes }
            );
            simResult = { ...graded, veredicto: grade.veredicto, motivos: grade.motivos };
          }
          clearStoredSimulacro(degreeSlug);
          setFinalSeconds(duracionSeg);
          setResult(simResult);
          setPhase("finished");
        } catch {
          setError(true);
        } finally {
          submittingRef.current = false;
        }
      });
    },
    [phase, unanswered, questions, selected, modo, config, remaining, elapsed, t, degreeSlug]
  );

  // Tiempo agotado en modo examen → corrección automática (blanco = fallo).
  useEffect(() => {
    if (timeUp && !submittingRef.current && !error) finish(true);
  }, [timeUp, error, finish]);

  if (phase === "boot") {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (phase === "deciding" && saved) {
    const savedAnswered = Object.keys(saved.selected).length;
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>{t("inProgressTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">
            {t("inProgressBody", {
              answered: savedAnswered,
              total: saved.questions.length,
              mode: saved.modo === "examen" ? t("modeExam") : t("modePractice"),
            })}
          </p>
          {savedRemaining !== null && (
            <p className="text-sm">
              {savedRemaining > 0 ? (
                <span className="flex items-center gap-1.5 tabular-nums">
                  <Clock className="size-4" aria-hidden />
                  {t("resumeTimeLeft", { time: formatTime(savedRemaining) })}
                </span>
              ) : (
                <span className="text-destructive">{t("resumeTimeUp")}</span>
              )}
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={() => restore(saved)}>{t("resume")}</Button>
            <Button variant="outline" onClick={startFresh}>
              <RotateCcw aria-hidden />
              {t("discard")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (phase === "finished" && result) {
    return (
      <SimulacroResultView
        result={result}
        questions={questions}
        config={config}
        modo={modo}
        seconds={finalSeconds}
      />
    );
  }

  const q = questions[index];
  const isRevealed = modo === "practica" && revealed.includes(q.questionId);
  const correctDisplay =
    modo === "practica" && q.correcta !== undefined ? q.map.indexOf(q.correcta) : null;
  const isMarked = marked.includes(q.questionId);

  const handleSelect = (value: string) => {
    if (timeUp || (modo === "practica" && isRevealed)) return;
    setSelected((s) => ({ ...s, [q.questionId]: Number(value) }));
    if (modo === "practica") setRevealed((r) => [...r, q.questionId]);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">
          {t("question", { current: index + 1, total: questions.length })}
        </p>
        <p
          className={cn(
            "flex items-center gap-1.5 text-sm font-medium tabular-nums",
            remaining !== null && remaining <= 300
              ? "text-red-600 dark:text-red-400"
              : "text-muted-foreground"
          )}
        >
          <Clock className="size-4" aria-hidden />
          {remaining !== null ? formatTime(remaining) : formatTime(elapsed)}
        </p>
      </div>

      {/* Rejilla de navegación: respondida (relleno), marcada (punto ámbar). */}
      <div className="flex flex-wrap gap-1.5" role="navigation" aria-label={t("gridLabel")}>
        {questions.map((question, i) => {
          const answered = selected[question.questionId] !== undefined;
          const flagged = marked.includes(question.questionId);
          return (
            <button
              key={question.questionId}
              type="button"
              onClick={() => setIndex(i)}
              aria-current={i === index ? "true" : undefined}
              className={cn(
                "relative size-8 rounded-md border text-xs font-medium tabular-nums transition-colors",
                answered ? "bg-primary/15 border-primary/40" : "bg-background hover:bg-muted/50",
                i === index && "ring-primary ring-2"
              )}
            >
              {i + 1}
              {flagged && (
                <span
                  className="absolute -top-1 -right-1 size-2 rounded-full bg-amber-500"
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>

      {timeUp && (
        <p className="text-destructive text-sm font-medium" role="alert">
          {t("timeUpBanner")}
        </p>
      )}

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-2 pb-2">
          <CardTitle className="text-base font-medium">{q.enunciado}</CardTitle>
          <Button
            variant={isMarked ? "secondary" : "ghost"}
            size="sm"
            className="shrink-0"
            onClick={() =>
              setMarked((m) =>
                isMarked ? m.filter((id) => id !== q.questionId) : [...m, q.questionId]
              )
            }
          >
            <Flag
              className={cn("size-4", isMarked && "fill-amber-500 text-amber-500")}
              aria-hidden
            />
            <span className="sr-only sm:not-sr-only">
              {isMarked ? t("unmark") : t("markForReview")}
            </span>
          </Button>
        </CardHeader>
        <CardContent>
          <RadioGroup
            key={q.questionId}
            value={selected[q.questionId]?.toString() ?? ""}
            onValueChange={handleSelect}
          >
            {q.opciones.map((opcion, displayIndex) => {
              const chosen = selected[q.questionId] === displayIndex;
              return (
                <div
                  key={displayIndex}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-3 py-2.5",
                    !isRevealed && !timeUp && "hover:bg-muted/50",
                    isRevealed &&
                      displayIndex === correctDisplay &&
                      "border-emerald-500/60 bg-emerald-500/10",
                    isRevealed &&
                      chosen &&
                      displayIndex !== correctDisplay &&
                      "border-red-500/60 bg-red-500/10"
                  )}
                >
                  <RadioGroupItem
                    value={displayIndex.toString()}
                    id={`${q.questionId}-${displayIndex}`}
                    disabled={timeUp || isRevealed}
                  />
                  <Label
                    htmlFor={`${q.questionId}-${displayIndex}`}
                    className="flex-1 cursor-pointer font-normal"
                  >
                    {opcion}
                  </Label>
                </div>
              );
            })}
          </RadioGroup>

          {isRevealed && (
            <div className="mt-3 flex flex-col gap-1.5 border-t pt-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium">
                {selected[q.questionId] === correctDisplay ? (
                  <>
                    <CheckCircle2
                      className="size-4 text-emerald-600 dark:text-emerald-400"
                      aria-hidden
                    />
                    {t("correct")}
                  </>
                ) : (
                  <>
                    <XCircle className="size-4 text-red-600 dark:text-red-400" aria-hidden />
                    {t("incorrect")}
                  </>
                )}
              </p>
              {q.explicacion && <p className="text-muted-foreground">{q.explicacion}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-3">
          <p className="text-destructive text-sm">{t("error")}</p>
          <Button size="sm" variant="outline" onClick={() => finish(true)} disabled={isPending}>
            {t("retry")}
          </Button>
        </div>
      )}

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
          <Button size="sm" disabled={isPending || timeUp} onClick={() => finish(false)}>
            {isPending ? t("finishing") : t("finish")}
          </Button>
        )}
      </div>
    </div>
  );
}

function SimulacroResultView({
  result,
  questions,
  config,
  modo,
  seconds,
}: {
  result: SimulacroResult;
  questions: SimulacroQuestion[];
  config: SimulacroConfig;
  modo: SimulacroModo;
  seconds: number;
}) {
  const t = useTranslations("study.simulacro");
  const byId = new Map(result.corrections.map((c) => [c.questionId, c]));
  const apto = result.veredicto === "APTO";

  return (
    <div className="flex flex-col gap-6">
      <Card className={cn(apto ? "border-emerald-500/50" : "border-red-500/50")}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            {t("resultTitle")}
            <Badge
              className={cn(
                "text-sm",
                apto
                  ? "bg-emerald-600 text-white dark:bg-emerald-500"
                  : "bg-red-600 text-white dark:bg-red-500"
              )}
            >
              {apto ? t("apto") : t("noApto")}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-2xl font-bold">
            {t("score", { aciertos: result.aciertos, total: result.total })}
          </p>
          <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <Clock className="size-4" aria-hidden />
            {t("time", { time: formatTime(seconds) })}
          </p>

          {modo === "practica" && (
            <p className="text-muted-foreground text-sm italic">{t("practiceVerdictNote")}</p>
          )}

          {apto ? (
            <p className="text-sm">{t("aptoBody")}</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm" aria-label={t("motivosLabel")}>
              {result.motivos.map((motivo, i) => (
                <li key={i} className="flex items-start gap-2">
                  <XCircle
                    className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400"
                    aria-hidden
                  />
                  {motivo.kind === "global"
                    ? t("motivoGlobal", { aciertos: motivo.aciertos, min: motivo.minAciertos })
                    : t("motivoTope", {
                        unit: motivo.unit,
                        fallos: motivo.fallos,
                        tope: motivo.tope,
                      })}
                </li>
              ))}
            </ul>
          )}

          <div>
            <p className="mb-1.5 text-sm font-medium">{t("byUnit")}</p>
            <div className="flex flex-col gap-1">
              {Object.entries(result.desglosePorUt)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([unit, stats]) => {
                  const tope = config.topes[unit];
                  const overTope = tope !== undefined && stats.fallos > tope;
                  const atTope = tope !== undefined && stats.fallos === tope;
                  return (
                    <div key={unit} className="flex items-center gap-2 text-sm">
                      <span className="w-12 shrink-0 font-medium tabular-nums">UT{unit}</span>
                      <span className="tabular-nums">
                        {stats.aciertos}/{stats.total}
                      </span>
                      {tope !== undefined && (
                        <Badge
                          variant={overTope ? "destructive" : "outline"}
                          className={cn(
                            "text-xs",
                            atTope &&
                              !overTope &&
                              "border-amber-500/60 text-amber-700 dark:text-amber-400"
                          )}
                        >
                          {t("topeBadge", { fallos: stats.fallos, tope })}
                        </Badge>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button asChild size="sm">
              <Link href="/estudio/simulacro">{t("newSimulacro")}</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/estudio">{t("backToPanel")}</Link>
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
                    <CheckCircle2
                      className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                      aria-hidden
                    />
                  ) : (
                    <XCircle
                      className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400"
                      aria-hidden
                    />
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
