import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";

import { ReviewSession } from "@/components/study/review-session";
import { Button } from "@/components/ui/button";
import { getDegree, getUnitsForDegree, parseUnidadParam } from "@/lib/study/data";
import { buildFailsQueue, buildUnitQueue, type SessionCard } from "@/lib/study/srs-queue";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Repaso" };

export default async function DeckPage({
  params,
}: {
  params: Promise<{ mazo: string }>;
}) {
  const { mazo } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/estudio/flashcards");

  const t = await getTranslations("study.flashcards");
  const now = new Date();

  let cards: SessionCard[];
  let deckTitle: string;

  if (mazo === "fallos") {
    cards = await buildFailsQueue(supabase, now);
    deckTitle = t("failsDeck");
  } else {
    const numero = parseUnidadParam(mazo);
    if (!numero) notFound();
    const degree = await getDegree(supabase, "per");
    if (!degree) notFound();
    const units = await getUnitsForDegree(supabase, degree.id);
    const unit = units.find((u) => u.numero === numero);
    if (!unit) notFound();
    cards = await buildUnitQueue(supabase, user.id, unit.id, now);
    deckTitle = `UT${unit.numero} · ${unit.titulo}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/estudio/flashcards">
            <ArrowLeft aria-hidden />
            {t("backToDecks")}
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{deckTitle}</h1>
      </div>

      {cards.length === 0 ? (
        <p className="text-muted-foreground">
          {mazo === "fallos" ? t("emptyFails") : t("emptyDeck")}
        </p>
      ) : (
        <ReviewSession cards={cards} />
      )}
    </div>
  );
}
