import { BookOpen, Layers, Timer } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { CompassWake } from "@/components/brand/compass-wake";
import { SectionLabel } from "@/components/section-label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function LandingPage() {
  const t = await getTranslations("landing");

  const features = [
    { icon: BookOpen, title: t("feat1Title"), body: t("feat1Body") },
    { icon: Layers, title: t("feat2Title"), body: t("feat2Body") },
    { icon: Timer, title: t("feat3Title"), body: t("feat3Body") },
  ];

  const steps = [
    { title: t("step1Title"), body: t("step1Body") },
    { title: t("step2Title"), body: t("step2Body") },
    { title: t("step3Title"), body: t("step3Body") },
  ];

  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <CompassWake className="text-foreground/[0.08] dark:text-foreground/[0.12] pointer-events-none absolute -top-10 -right-14 w-56 sm:w-72" />
        <div className="mx-auto w-full max-w-5xl px-4 pt-14 pb-12 sm:pt-24 sm:pb-16">
          <p className="text-signal text-[11px] font-bold tracking-[0.16em] uppercase">
            {t("eyebrow")}
          </p>
          <h1 className="mt-3 max-w-2xl text-4xl leading-[1.08] font-semibold text-balance sm:text-6xl">
            {t("heroTitle")}
          </h1>
          <p className="text-muted-foreground mt-4 max-w-xl text-base leading-relaxed sm:text-lg">
            {t("heroSubtitle")}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 px-7 text-base font-bold">
              <Link href="/registro">{t("ctaPrimary")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-7 text-base">
              <Link href="/titulos/per">{t("ctaSecondary")}</Link>
            </Button>
          </div>
          <p className="text-muted-foreground mt-6 text-xs sm:text-sm">{t("proof")}</p>
        </div>
      </section>

      {/* Por qué funciona */}
      <section className="mx-auto w-full max-w-5xl px-4 pb-4">
        <SectionLabel>{t("whyTitle")}</SectionLabel>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="shadow-primary/5 shadow-md">
              <CardHeader>
                <f.icon className="text-primary size-6" aria-hidden />
                <CardTitle className="text-lg">{f.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="mx-auto w-full max-w-5xl px-4 pt-12 pb-4">
        <SectionLabel>{t("howTitle")}</SectionLabel>
        <ol className="mt-6 grid gap-6 sm:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-4">
              <span aria-hidden className="text-primary font-sans text-sm font-bold tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="font-sans text-[15px] font-bold">{s.title}</h3>
                <p className="text-muted-foreground mt-1 text-sm">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Banda CTA */}
      <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:py-16">
        <div className="bg-primary text-primary-foreground relative overflow-hidden rounded-xl px-6 py-10 sm:px-12">
          <CompassWake className="pointer-events-none absolute -right-10 -bottom-24 w-52 text-current opacity-10" />
          <h2 className="text-3xl font-semibold sm:text-4xl">{t("bandTitle")}</h2>
          <p className="mt-2 max-w-md text-sm opacity-85 sm:text-base">{t("bandBody")}</p>
          <Button
            asChild
            size="lg"
            className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 mt-6 h-12 px-7 text-base font-bold"
          >
            <Link href="/registro">{t("bandCta")}</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
