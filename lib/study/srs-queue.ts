import { SRS_NEW_CARDS_PER_DAY } from "@/lib/srs";
import type { ServerSupabase } from "@/lib/study/data";
import { parseOpciones } from "@/lib/study/data";

/** Tarjeta lista para la sesión de repaso (cliente). */
export interface SessionCard {
  cardId: string;
  kind: "concept" | "question";
  front: string;
  back: string;
  /** Mnemotecnia (conceptos) o explicación (preguntas), si existe. */
  hint: string | null;
}

interface CardRow {
  id: string;
  due_at: string;
  lapses: number;
  created_at: string;
  concept_id: string | null;
  question_id: string | null;
  concepts: {
    unit_id: string;
    termino: string;
    definicion: string;
    mnemonic: string | null;
  } | null;
  questions: {
    unit_id: string;
    enunciado: string;
    opciones: unknown;
    correcta: number;
    explicacion: string | null;
  } | null;
}

const CARD_SELECT =
  "id, due_at, lapses, created_at, concept_id, question_id, concepts(unit_id, termino, definicion, mnemonic), questions(unit_id, enunciado, opciones, correcta, explicacion)";

/** Todas las tarjetas del usuario con su contenido (RLS: solo las propias). */
export async function getUserCards(supabase: ServerSupabase): Promise<CardRow[]> {
  const { data, error } = await supabase.from("srs_cards").select(CARD_SELECT);
  if (error) throw new Error(`srs_cards: ${error.message}`);
  return (data ?? []) as CardRow[];
}

export function cardUnitId(card: CardRow): string | null {
  return card.concepts?.unit_id ?? card.questions?.unit_id ?? null;
}

export function isDue(card: CardRow, now: Date): boolean {
  return new Date(card.due_at).getTime() <= now.getTime();
}

/** Tarjetas nuevas introducidas hoy (día UTC), para el tope diario del PRD. */
export function createdToday(cards: CardRow[], now: Date): number {
  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);
  return cards.filter((c) => new Date(c.created_at).getTime() >= startOfDay.getTime()).length;
}

export function remainingNewAllowance(cards: CardRow[], now: Date): number {
  return Math.max(0, SRS_NEW_CARDS_PER_DAY - createdToday(cards, now));
}

export function toSessionCard(card: CardRow): SessionCard {
  if (card.concepts) {
    return {
      cardId: card.id,
      kind: "concept",
      front: card.concepts.termino,
      back: card.concepts.definicion,
      hint: card.concepts.mnemonic,
    };
  }
  if (card.questions) {
    const opciones = parseOpciones(card.questions.opciones as never);
    return {
      cardId: card.id,
      kind: "question",
      front: card.questions.enunciado,
      back: opciones[card.questions.correcta],
      hint: card.questions.explicacion,
    };
  }
  throw new Error("Tarjeta sin contenido");
}

const SESSION_MAX_DUE = 50;

/**
 * Cola de sesión de un mazo de UT: vencidas (por antigüedad) + hasta
 * `allowance` conceptos nuevos de la unidad, que se materializan como
 * tarjetas (due ahora) para poder calificarlos.
 */
export async function buildUnitQueue(
  supabase: ServerSupabase,
  userId: string,
  unitId: string,
  now: Date
): Promise<SessionCard[]> {
  const cards = await getUserCards(supabase);

  const due = cards
    .filter((c) => cardUnitId(c) === unitId && isDue(c, now))
    .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())
    .slice(0, SESSION_MAX_DUE);

  const allowance = remainingNewAllowance(cards, now);
  let introduced: CardRow[] = [];

  if (allowance > 0) {
    const withCard = new Set(cards.map((c) => c.concept_id).filter(Boolean));
    const { data: concepts, error } = await supabase
      .from("concepts")
      .select("id")
      .eq("unit_id", unitId);
    if (error) throw new Error(`concepts: ${error.message}`);

    const fresh = (concepts ?? []).filter((c) => !withCard.has(c.id)).slice(0, allowance);

    if (fresh.length > 0) {
      const { data: created, error: insertError } = await supabase
        .from("srs_cards")
        .insert(
          fresh.map((c) => ({
            user_id: userId,
            concept_id: c.id,
            due_at: now.toISOString(),
          }))
        )
        .select(CARD_SELECT);
      if (insertError) throw new Error(`srs_cards (nuevas): ${insertError.message}`);
      introduced = (created ?? []) as CardRow[];
    }
  }

  return [...due, ...introduced].map(toSessionCard);
}

/**
 * Cola del mazo "Mis fallos": tarjetas de pregunta falladas y vencidas,
 * acotadas a las unidades de la titulación activa (F4).
 */
export async function buildFailsQueue(
  supabase: ServerSupabase,
  now: Date,
  allowedUnitIds: ReadonlySet<string | null>
): Promise<SessionCard[]> {
  const cards = await getUserCards(supabase);
  return cards
    .filter(
      (c) =>
        c.question_id !== null &&
        c.lapses >= 1 &&
        isDue(c, now) &&
        allowedUnitIds.has(cardUnitId(c))
    )
    .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())
    .slice(0, SESSION_MAX_DUE)
    .map(toSessionCard);
}
