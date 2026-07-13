"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface DiagramHotspot {
  id: string;
  termino: string;
  definicion: string;
}

interface GameState {
  order: string[];
  index: number;
  attempts: number;
  okFirstTry: number;
  finished: boolean;
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Visor de diagramas SVG con hotspots (PRD §M1). El SVG (propio, servido
 * desde /public) se inyecta inline para poder escuchar los taps por id.
 * Modo explorar: tap → pieza resaltada + nombre y definición.
 * Modo juego: pide una pieza; a los 2 fallos revela la correcta.
 */
export function DiagramViewer({
  svgUrl,
  hotspots,
}: {
  svgUrl: string;
  hotspots: DiagramHotspot[];
}) {
  const t = useTranslations("study.diagram");
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [mode, setMode] = useState<"explore" | "game">("explore");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [game, setGame] = useState<GameState | null>(null);

  const byId = new Map(hotspots.map((h) => [h.id, h]));

  useEffect(() => {
    if (!svgUrl.startsWith("/diagrams/")) return;
    let cancelled = false;
    fetch(svgUrl)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(res.statusText))))
      .then((text) => {
        if (!cancelled) setSvg(text);
      })
      .catch(() => {
        if (!cancelled) setSvg(null);
      });
    return () => {
      cancelled = true;
    };
  }, [svgUrl]);

  const clearStates = () => {
    containerRef.current
      ?.querySelectorAll(".hotspot.is-active, .hotspot.is-hit, .hotspot.is-error")
      .forEach((el) => el.classList.remove("is-active", "is-hit", "is-error"));
  };

  const mark = (id: string, cls: string) => {
    const el = containerRef.current?.querySelector(`#${CSS.escape(id)}`);
    el?.classList.add(cls);
  };

  // El handler vive en un ref para que el listener delegado (montado una
  // sola vez por SVG) siempre vea el estado actual.
  const handleTapRef = useRef<(id: string) => void>(() => {});
  handleTapRef.current = (id: string) => {
    if (!byId.has(id)) return;

    if (mode === "explore") {
      clearStates();
      mark(id, "is-active");
      setSelectedId(id);
      return;
    }

    if (!game || game.finished || timerRef.current) return;
    const current = game.order[game.index];

    const advance = (okFirstTry: number) => {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        clearStates();
        setGame((g) =>
          g
            ? {
                ...g,
                index: g.index + 1,
                attempts: 0,
                okFirstTry,
                finished: g.index + 1 >= g.order.length,
              }
            : g
        );
      }, 900);
    };

    if (id === current) {
      clearStates();
      mark(id, "is-hit");
      advance(game.attempts === 0 ? game.okFirstTry + 1 : game.okFirstTry);
    } else {
      mark(id, "is-error");
      const attempts = game.attempts + 1;
      if (attempts >= 2) {
        mark(current, "is-active");
        advance(game.okFirstTry);
      } else {
        setGame({ ...game, attempts });
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          const el = containerRef.current?.querySelector(`#${CSS.escape(id)}`);
          el?.classList.remove("is-error");
        }, 500);
      }
    }
  };

  // Wiring del SVG inyectado: accesibilidad + listeners delegados.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !svg) return;

    for (const h of hotspots) {
      const el = container.querySelector(`#${CSS.escape(h.id)}`);
      if (el) {
        el.setAttribute("role", "button");
        el.setAttribute("tabindex", "0");
        el.setAttribute("aria-label", h.termino);
      }
    }

    const resolveHotspot = (target: EventTarget | null) =>
      target instanceof Element ? target.closest<Element>(".hotspot")?.id : undefined;

    const onClick = (event: MouseEvent) => {
      const id = resolveHotspot(event.target);
      if (id) handleTapRef.current(id);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const id = resolveHotspot(event.target);
      if (id) {
        event.preventDefault();
        handleTapRef.current(id);
      }
    };

    container.addEventListener("click", onClick);
    container.addEventListener("keydown", onKeyDown);
    return () => {
      container.removeEventListener("click", onClick);
      container.removeEventListener("keydown", onKeyDown);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svg]);

  const startGame = () => {
    clearStates();
    setSelectedId(null);
    setGame({ order: shuffle(hotspots.map((h) => h.id)), index: 0, attempts: 0, okFirstTry: 0, finished: false });
  };

  const handleModeChange = (value: string) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    clearStates();
    setSelectedId(null);
    setMode(value as "explore" | "game");
    if (value === "game") startGame();
    else setGame(null);
  };

  const selected = selectedId ? byId.get(selectedId) : null;
  const current = game && !game.finished ? byId.get(game.order[game.index]) : null;

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={mode} onValueChange={handleModeChange}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="explore" className="flex-1 sm:flex-none">
            {t("explore")}
          </TabsTrigger>
          <TabsTrigger value="game" className="flex-1 sm:flex-none">
            {t("game")}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === "game" && game && (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-4">
            {game.finished ? (
              <div className="flex flex-col items-start gap-3">
                <p className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  {t("finished", { ok: game.okFirstTry, total: game.order.length })}
                </p>
                <Button size="sm" variant="outline" onClick={startGame}>
                  <RotateCcw aria-hidden />
                  {t("playAgain")}
                </Button>
              </div>
            ) : (
              <>
                <p className="text-lg font-medium" aria-live="polite">
                  {t("prompt")} <span className="text-primary font-bold">{current?.termino}</span>
                </p>
                <Progress value={(game.index / game.order.length) * 100} />
                <p className="text-muted-foreground text-sm">
                  {t("score", { done: game.index, total: game.order.length })}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {svg ? (
        <div
          ref={containerRef}
          className="bg-card overflow-hidden rounded-xl border [&_svg]:h-auto [&_svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <Skeleton className="aspect-video w-full rounded-xl" />
      )}

      {mode === "explore" && (
        <Card>
          <CardContent className="pt-4">
            {selected ? (
              <div aria-live="polite">
                <p className="text-lg font-semibold">{selected.termino}</p>
                <p className="text-muted-foreground mt-1">{selected.definicion}</p>
              </div>
            ) : (
              <p className="text-muted-foreground">{t("exploreHint")}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
