import { describe, expect, it } from "vitest";

import {
  newCardState,
  review,
  SRS_EASE_INITIAL,
  SRS_EASE_MIN,
  SRS_MAX_INTERVAL_DAYS,
  type SrsState,
} from "@/lib/srs";

const NOW = new Date("2026-07-13T10:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function state(partial: Partial<SrsState>): SrsState {
  return { ...newCardState(), ...partial };
}

describe("lib/srs · tarjeta nueva (reps=0)", () => {
  it("Otra vez → 1d, lapse y ease −0,20", () => {
    const r = review(newCardState(), "again", NOW);
    expect(r.intervalDays).toBe(1);
    expect(r.reps).toBe(0);
    expect(r.lapses).toBe(1);
    expect(r.ease).toBe(2.3);
  });

  it("Difícil → 1d y ease −0,15", () => {
    const r = review(newCardState(), "hard", NOW);
    expect(r.intervalDays).toBe(1);
    expect(r.reps).toBe(1);
    expect(r.ease).toBe(2.35);
  });

  it("Bien → 1d sin tocar ease (progresión 1d del PRD)", () => {
    const r = review(newCardState(), "good", NOW);
    expect(r.intervalDays).toBe(1);
    expect(r.reps).toBe(1);
    expect(r.ease).toBe(SRS_EASE_INITIAL);
  });

  it("Fácil → 3d y ease +0,15", () => {
    const r = review(newCardState(), "easy", NOW);
    expect(r.intervalDays).toBe(3);
    expect(r.reps).toBe(1);
    expect(r.ease).toBe(2.65);
  });
});

describe("lib/srs · progresión del PRD: 1d → 3d → interval×ease", () => {
  it("segundo Bien pasa de 1d a 3d", () => {
    const r = review(state({ reps: 1, intervalDays: 1 }), "good", NOW);
    expect(r.intervalDays).toBe(3);
    expect(r.reps).toBe(2);
  });

  it("tercer Bien multiplica por ease (3 × 2,5 = 7,5 → 8)", () => {
    const r = review(state({ reps: 2, intervalDays: 3 }), "good", NOW);
    expect(r.intervalDays).toBe(8);
  });

  it("el vencimiento es now + intervalo en días exactos", () => {
    const r = review(state({ reps: 2, intervalDays: 3 }), "good", NOW);
    expect(r.dueAt.getTime()).toBe(NOW.getTime() + 8 * DAY_MS);
  });
});

describe("lib/srs · Otra vez (fallo)", () => {
  it("resetea el intervalo a 1d, reps a 0 y suma un lapse (PRD)", () => {
    const r = review(state({ reps: 4, intervalDays: 40, lapses: 2 }), "again", NOW);
    expect(r.intervalDays).toBe(1);
    expect(r.reps).toBe(0);
    expect(r.lapses).toBe(3);
  });

  it("tras el fallo, la progresión reempieza en 1d → 3d", () => {
    const failed = review(state({ reps: 4, intervalDays: 40 }), "again", NOW);
    const relearn = review(failed, "good", NOW);
    expect(relearn.intervalDays).toBe(1);
    const second = review(relearn, "good", NOW);
    expect(second.intervalDays).toBe(3);
  });
});

describe("lib/srs · Difícil y Fácil", () => {
  it("Difícil nunca reduce el intervalo (mín interval+1)", () => {
    const r = review(state({ reps: 3, intervalDays: 2 }), "hard", NOW);
    expect(r.intervalDays).toBe(3); // max(2×1,2=2,4 → , 2+1=3)
    const r2 = review(state({ reps: 3, intervalDays: 10 }), "hard", NOW);
    expect(r2.intervalDays).toBe(12); // 10×1,2
  });

  it("Fácil aplica el bonus ×1,3 sobre interval×ease", () => {
    const r = review(state({ reps: 3, intervalDays: 10 }), "easy", NOW);
    expect(r.intervalDays).toBe(33); // 10 × 2,5 × 1,3 = 32,5 → 33
    expect(r.ease).toBe(2.65);
  });
});

describe("lib/srs · límites", () => {
  it("el ease nunca baja de 1,3", () => {
    let s: SrsState = state({ ease: 1.35 });
    s = review(s, "again", NOW);
    expect(s.ease).toBe(SRS_EASE_MIN);
    for (let i = 0; i < 10; i++) s = review(s, "again", NOW);
    expect(s.ease).toBe(SRS_EASE_MIN);
  });

  it("el intervalo no supera los 365 días", () => {
    const r = review(state({ reps: 5, intervalDays: 300 }), "good", NOW);
    expect(r.intervalDays).toBe(SRS_MAX_INTERVAL_DAYS);
  });

  it("un ease corrupto por debajo del mínimo se normaliza", () => {
    const r = review(state({ reps: 2, intervalDays: 4, ease: 1.0 }), "good", NOW);
    expect(r.ease).toBe(SRS_EASE_MIN);
    expect(r.intervalDays).toBe(5); // 4 × 1,3 = 5,2 → 5
  });
});
