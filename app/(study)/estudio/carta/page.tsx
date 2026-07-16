import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Calculator, Compass } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CHART_EXERCISE_TYPES } from "@/lib/study/chart-exercises";

export const metadata: Metadata = { title: "Trainer de carta" };

/**
 * Índice del trainer de carta (UT11): los 8 tipos de ejercicio del examen
 * como generadores autocorregibles + calculadoras auxiliares. Sin BD: todo
 * es cálculo puro en cliente.
 */
export default async function CartaPage() {
  const t = await getTranslations("study.carta");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calculator className="text-muted-foreground size-4" aria-hidden />
            {t("calculatorsTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">{t("calculatorsSubtitle")}</p>
          <Button asChild size="sm" variant="outline" className="self-start">
            <Link href="/estudio/carta/calculadoras">{t("calculatorsCta")}</Link>
          </Button>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3" aria-label={t("exercisesTitle")}>
        <h2 className="text-lg font-semibold">{t("exercisesTitle")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {CHART_EXERCISE_TYPES.map((tipo) => (
            <Link key={tipo.slug} href={`/estudio/carta/ejercicios/${tipo.slug}`} className="group">
              <Card className="group-hover:border-primary/50 h-full transition-colors">
                <CardHeader className="pb-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Compass className="text-muted-foreground size-4 shrink-0" aria-hidden />
                    {tipo.titulo}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">{tipo.descripcion}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
