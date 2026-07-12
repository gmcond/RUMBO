import { Anchor, GraduationCap, MapPinned } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function LandingPage() {
  const t = await getTranslations("landing");

  const features = [
    { icon: GraduationCap, title: t("learnTitle"), body: t("learnBody") },
    { icon: MapPinned, title: t("infoTitle"), body: t("infoBody") },
    { icon: Anchor, title: t("sailTitle"), body: t("sailBody") },
  ];

  return (
    <main className="flex-1">
      <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-4 py-16 text-center sm:py-24">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">RUMBO</h1>
        <p className="text-2xl font-semibold sm:text-3xl">{t("tagline")}</p>
        <p className="text-muted-foreground max-w-2xl text-lg">{t("subtitle")}</p>
        <div className="flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
          <Button asChild size="lg">
            <Link href="/registro">{t("ctaPrimary")}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">{t("ctaSecondary")}</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-5xl gap-4 px-4 pb-16 sm:grid-cols-3 sm:pb-24">
        {features.map((f) => (
          <Card key={f.title}>
            <CardHeader>
              <f.icon className="text-primary size-8" aria-hidden />
              <CardTitle className="text-xl">{f.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{f.body}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
