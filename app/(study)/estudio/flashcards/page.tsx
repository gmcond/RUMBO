import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AlertTriangle, Layers } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getActiveDegree, getUnitsForDegree } from "@/lib/study/data";
import { cardUnitId, getUserCards, isDue, remainingNewAllowance } from "@/lib/study/srs-queue";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Flashcards" };

export default async function FlashcardsPage() {
  const supabase = await createClient();
  const t = await getTranslations("study.flashcards");
  const now = new Date();

  const degree = await getActiveDegree(supabase);
  if (!degree) return null;
  const units = await getUnitsForDegree(supabase, degree.id);
  const unitIdSet = new Set<string | null>(units.map((u) => u.id));

  const [cards, { data: concepts }] = await Promise.all([
    getUserCards(supabase),
    supabase
      .from("concepts")
      .select("id, unit_id")
      .in(
        "unit_id",
        units.map((u) => u.id)
      ),
  ]);

  const allowance = remainingNewAllowance(cards, now);
  const conceptsWithCard = new Set(cards.map((c) => c.concept_id).filter(Boolean));

  // "Mis fallos" también se acota a la titulación activa (unidades compartidas:
  // un fallo de UT3 aparece en PER y PNB; uno de UT11 solo en PER).
  const failCards = cards.filter(
    (c) => c.question_id !== null && c.lapses >= 1 && unitIdSet.has(cardUnitId(c))
  );
  const failsDue = failCards.filter((c) => isDue(c, now)).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      <Card className="border-amber-500/40">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="size-4 text-amber-500" aria-hidden />
            {t("failsDeck")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3">
          <div className="text-muted-foreground text-sm">
            <p>{t("failsDeckHint")}</p>
            <p className="mt-1">
              {t("cards", { count: failCards.length })} · {t("due", { count: failsDue })}
            </p>
          </div>
          <Button asChild size="sm" disabled={failsDue === 0}>
            <Link href="/estudio/flashcards/fallos">{t("study")}</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {units.map((unit) => {
          const unitConcepts = (concepts ?? []).filter((c) => c.unit_id === unit.id);
          const fresh = unitConcepts.filter((c) => !conceptsWithCard.has(c.id)).length;
          const newAvailable = Math.min(fresh, allowance);
          const due = cards.filter((c) => cardUnitId(c) === unit.id && isDue(c, now)).length;

          return (
            <Card key={unit.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Layers className="text-muted-foreground size-4" aria-hidden />
                  UT{unit.numero} · {unit.titulo}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant={due > 0 ? "default" : "secondary"}>
                    {t("due", { count: due })}
                  </Badge>
                  {newAvailable > 0 && (
                    <Badge variant="outline">{t("newAvailable", { count: newAvailable })}</Badge>
                  )}
                </div>
                <Button asChild size="sm" variant={due + newAvailable > 0 ? "default" : "outline"}>
                  <Link href={`/estudio/flashcards/ut${unit.numero}`}>{t("study")}</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
