import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CheckCircle2 } from "lucide-react";

import { Markdown } from "@/components/markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CCAA } from "@/lib/ccaa";
import { createPublicClient } from "@/lib/supabase/public";

// Contenido público SEO (PRD §M4): prerenderizado y revalidado cada hora,
// suficiente para reflejar aprobaciones de changesets sin rebuild.
export const revalidate = 3600;
export const dynamicParams = false;

// Una página por titulación sembrada (F4): añadir un título = insertar datos.
export async function generateStaticParams() {
  const supabase = createPublicClient();
  const { data } = await supabase.from("degrees").select("slug");
  return (data ?? []).map((d) => ({ degree: d.slug }));
}

type Params = { params: Promise<{ degree: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { degree } = await params;
  const t = await getTranslations(`guia.${degree}`);
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function DegreeGuidePage({ params }: Params) {
  const { degree: degreeSlug } = await params;
  const supabase = createPublicClient();

  const { data: degree } = await supabase
    .from("degrees")
    .select("descripcion, atribuciones_md")
    .eq("slug", degreeSlug)
    .maybeSingle();
  if (!degree) notFound();

  // Textos comunes de la guía + bloque específico de la titulación.
  const [t, td] = await Promise.all([
    getTranslations("guia"),
    getTranslations(`guia.${degreeSlug}`),
  ]);

  const steps = [1, 2, 3, 4].map((n) => ({
    title: td(`step${n}Title`),
    body: td(`step${n}Body`),
  }));
  const faqs = [1, 2, 3, 4].map((n) => ({ q: td(`faq${n}Q`), a: td(`faq${n}A`) }));

  // FAQPage estructurado para buscadores.
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{td("title")}</h1>
      <p className="text-muted-foreground mt-4 text-lg">{degree.descripcion ?? td("intro")}</p>

      {degree.atribuciones_md && (
        <section className="mt-10">
          <h2 className="text-2xl font-semibold tracking-tight">{t("attributionsTitle")}</h2>
          <Markdown className="mt-3">{degree.atribuciones_md}</Markdown>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight">{t("requirementsTitle")}</h2>
        <ul className="mt-3 space-y-3">
          {[td("req1"), td("req2"), td("req3")].map((req) => (
            <li key={req} className="flex gap-3">
              <CheckCircle2 className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />
              <span>{req}</span>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground mt-3 text-sm">{t("reqNote")}</p>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight">{t("processTitle")}</h2>
        <ol className="mt-4 space-y-4">
          {steps.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span
                className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full font-semibold"
                aria-hidden
              >
                {i + 1}
              </span>
              <div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="text-muted-foreground mt-1 text-sm">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight">{t("ccaaGridTitle")}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("ccaaGridSubtitle")}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CCAA.map((c) => (
            <Link
              key={c.code}
              href={`/titulos/${degreeSlug}/${c.code}`}
              className="hover:bg-accent hover:text-accent-foreground rounded-md border px-3 py-2 text-sm transition-colors"
            >
              {c.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight">{t("faqTitle")}</h2>
        <div className="mt-4 grid gap-4">
          {faqs.map((f) => (
            <Card key={f.q}>
              <CardHeader>
                <CardTitle className="text-base">{f.q}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">{f.a}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <p className="text-muted-foreground mt-10 text-xs">{t("sourceRd")}</p>
    </main>
  );
}
