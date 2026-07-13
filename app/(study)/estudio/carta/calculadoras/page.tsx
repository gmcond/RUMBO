import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";

import { ChartCalculators } from "@/components/study/chart-calculators";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Calculadoras de carta" };

export default async function CalculadorasPage() {
  const t = await getTranslations("study.carta");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("calculatorsTitle")}</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">{t("calculatorsSubtitle")}</p>
      </div>
      <ChartCalculators />
      <Button asChild variant="outline" size="sm" className="self-start">
        <Link href="/estudio/carta">
          <ArrowLeft aria-hidden />
          {t("backToCarta")}
        </Link>
      </Button>
    </div>
  );
}
