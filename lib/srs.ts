/**
 * SRS: SM-2 simplificado (PRD §7.2).
 *
 * Reglas fijadas por el PRD: ease inicial 2,5 (mín. 1,3); progresión de
 * intervalos 1d → 3d → interval×ease; el fallo resetea a 1d y suma un lapse;
 * tope de tarjetas nuevas/día configurable (20 por defecto).
 *
 * Tabla exacta por botón (decisión de F1, documentada también en el PRD):
 *
 * | Botón    | nueva (reps=0) | repaso                        | ease            | reps  | lapses |
 * |----------|----------------|-------------------------------|-----------------|-------|--------|
 * | Otra vez | 1d             | 1d (reset)                    | −0,20 (mín 1,3) | 0     | +1     |
 * | Difícil  | 1d             | max(interval×1,2, interval+1) | −0,15 (mín 1,3) | +1    | —      |
 * | Bien     | 1d             | reps=1 → 3d; luego i×ease     | sin cambio      | +1    | —      |
 * | Fácil    | 3d             | interval×ease×1,3             | +0,15           | +1    | —      |
 *
 * Intervalo redondeado a día entero, mínimo 1, tope 365. due = now + intervalo.
 * Funciones puras: la persistencia en srs_cards vive en las server actions.
 */

export type SrsGrade = "again" | "hard" | "good" | "easy";

export interface SrsState {
  /** Factor de facilidad (columna srs_cards.ease). */
  ease: number;
  /** Intervalo vigente en días (columna srs_cards.interval_days). */
  intervalDays: number;
  /** Repasos superados desde el último fallo (columna srs_cards.reps). */
  reps: number;
  /** Fallos acumulados (columna srs_cards.lapses). */
  lapses: number;
}

export interface SrsReview extends SrsState {
  dueAt: Date;
}

export const SRS_EASE_INITIAL = 2.5;
export const SRS_EASE_MIN = 1.3;
export const SRS_MAX_INTERVAL_DAYS = 365;
export const SRS_NEW_CARDS_PER_DAY = 20;

export const SRS_GRADES: SrsGrade[] = ["again", "hard", "good", "easy"];

const DAY_MS = 24 * 60 * 60 * 1000;

function clampEase(ease: number): number {
  return Math.max(SRS_EASE_MIN, Math.round(ease * 100) / 100);
}

function clampInterval(days: number): number {
  return Math.min(SRS_MAX_INTERVAL_DAYS, Math.max(1, Math.round(days)));
}

/** Estado con el que nace una tarjeta (coincide con los defaults de srs_cards). */
export function newCardState(): SrsState {
  return { ease: SRS_EASE_INITIAL, intervalDays: 0, reps: 0, lapses: 0 };
}

/** Aplica una calificación y devuelve el estado siguiente con su vencimiento. */
export function review(state: SrsState, grade: SrsGrade, now: Date): SrsReview {
  const ease = clampEase(state.ease);
  const isNew = state.reps === 0;

  let next: SrsState;
  switch (grade) {
    case "again":
      next = {
        ease: clampEase(ease - 0.2),
        intervalDays: 1,
        reps: 0,
        lapses: state.lapses + 1,
      };
      break;
    case "hard":
      next = {
        ease: clampEase(ease - 0.15),
        intervalDays: isNew
          ? 1
          : clampInterval(Math.max(state.intervalDays * 1.2, state.intervalDays + 1)),
        reps: state.reps + 1,
        lapses: state.lapses,
      };
      break;
    case "good":
      next = {
        ease,
        intervalDays: isNew
          ? 1
          : state.reps === 1
            ? 3
            : clampInterval(state.intervalDays * ease),
        reps: state.reps + 1,
        lapses: state.lapses,
      };
      break;
    case "easy":
      next = {
        ease: clampEase(ease + 0.15),
        intervalDays: isNew ? 3 : clampInterval(state.intervalDays * ease * 1.3),
        reps: state.reps + 1,
        lapses: state.lapses,
      };
      break;
  }

  return { ...next, dueAt: new Date(now.getTime() + next.intervalDays * DAY_MS) };
}
