import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, BadgeCheck, CircleAlert, ExternalLink } from "lucide-react";

import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CCAA } from "@/lib/ccaa";
import { createPublicClient } from "@/lib/supabase/public";
import { enlacesValueSchema, sedesValueSchema, tasasValueSchema } from "@/lib/validation/content";

export const revalidate = 3600;
export const dynamicParams = false;

// El generateStaticParams de la page padre NO alimenta a los segmentos hijos:
// esta page debe devolver la combinación completa titulación × CCAA.
export async function generateStaticParams() {
  const supabase = createPublicClient();
  const { data } = await supabase.from("degrees").select("slug");
  return (data ?? []).flatMap((d) => CCAA.map((c) => ({ degree: d.slug, ccaa: c.code })));
}

type Params = { params: Promise<{ degree: string; ccaa: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { degree, ccaa } = await params;
  const meta = CCAA.find((c) => c.code === ccaa);
  if (!meta) return {};
  const t = await getTranslations("guia.ccaa");
  const degreeLabel = degree.toUpperCase();
  return {
    title: t("metaTitle", { degree: degreeLabel, name: meta.name }),
    description: t("metaDescription", { degree: degreeLabel, name: meta.name }),
  };
}

const dateFmt = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatDate(value: string | null): string {
  return value ? dateFmt.format(new Date(value)) : "—";
}

const eurFmt = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

export default async function DegreeCcaaPage({ params }: Params) {
  const { degree: degreeSlug, ccaa } = await params;
  const ccaaMeta = CCAA.find((c) => c.code === ccaa);
  if (!ccaaMeta) notFound();

  const t = await getTranslations("guia.ccaa");
  const supabase = createPublicClient();

  const { data: degree } = await supabase
    .from("degrees")
    .select("id")
    .eq("slug", degreeSlug)
    .maybeSingle();
  if (!degree) notFound();

  const [{ data: info }, { data: convocatorias }] = await Promise.all([
    supabase
      .from("ccaa_info")
      .select("*")
      .eq("degree_id", degree.id)
      .eq("ccaa", ccaa)
      .maybeSingle(),
    supabase
      .from("convocatorias")
      .select("*")
      .eq("degree_id", degree.id)
      .eq("ccaa", ccaa)
      .order("fecha_examen", { ascending: true, nullsFirst: false }),
  ]);

  // Los jsonb pasan por Zod antes de renderizarse: si el dato en BD no cumple
  // el esquema (p. ej. escrito a mano), se trata como pendiente en vez de romper.
  const tasas = tasasValueSchema.safeParse(info?.tasas);
  const sedes = sedesValueSchema.safeParse(info?.sedes);
  const enlaces = enlacesValueSchema.safeParse(info?.enlaces);
  const verified = Boolean(info?.last_verified_at);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <Link
        href={`/titulos/${degreeSlug}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("backToGuide")}
      </Link>

      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
        {t("title", { degree: degreeSlug.toUpperCase(), name: ccaaMeta.name })}
      </h1>

      {verified ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <BadgeCheck className="size-4" aria-hidden />
            {t("verifiedOn", { date: formatDate(info!.last_verified_at) })}
          </span>
          {info?.source_url && (
            <a
              href={info.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 underline underline-offset-2"
            >
              {t("source")}
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="flex items-center gap-2 font-medium">
            <CircleAlert
              className="size-4 shrink-0 text-amber-600 dark:text-amber-400"
              aria-hidden
            />
            {t("pendingTitle")}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("pendingBody", { name: ccaaMeta.name })}
          </p>
        </div>
      )}

      <div className="mt-8 grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("feesTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {tasas.success && tasas.data ? (
              <dl className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    [t("examFee"), tasas.data.examen],
                    [t("issueFee"), tasas.data.expedicion],
                  ] as const
                ).map(([label, tasa]) => (
                  <div key={label} className="rounded-md border p-3">
                    <dt className="text-muted-foreground text-sm">{label}</dt>
                    <dd className="mt-1 text-xl font-semibold">
                      {tasa ? eurFmt.format(tasa.importe_eur) : t("pendingField")}
                    </dd>
                    {tasa?.concepto && (
                      <dd className="text-muted-foreground mt-0.5 text-xs">{tasa.concepto}</dd>
                    )}
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-muted-foreground text-sm">{t("pendingField")}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("convocatoriasTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {convocatorias && convocatorias.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("convDate")}</TableHead>
                      <TableHead>{t("convPlazo")}</TableHead>
                      <TableHead>{t("convSede")}</TableHead>
                      <TableHead>{t("convEstado")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {convocatorias.map((conv) => (
                      <TableRow key={conv.id}>
                        <TableCell className="font-medium">
                          {conv.enlace ? (
                            <a
                              href={conv.enlace}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline underline-offset-2"
                            >
                              {formatDate(conv.fecha_examen)}
                            </a>
                          ) : (
                            formatDate(conv.fecha_examen)
                          )}
                        </TableCell>
                        <TableCell>
                          {formatDate(conv.plazo_inicio)} – {formatDate(conv.plazo_fin)}
                        </TableCell>
                        <TableCell>{conv.sede ?? "—"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              conv.estado === "inscripcion_abierta" ? "default" : "secondary"
                            }
                          >
                            {t(`estado.${conv.estado}`)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                {t("noConvocatorias", { name: ccaaMeta.name })}
              </p>
            )}
          </CardContent>
        </Card>

        {sedes.success && sedes.data && sedes.data.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t("sedesTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {sedes.data.map((sede) => (
                  <li key={sede.nombre}>
                    {sede.nombre}
                    {sede.ciudad ? ` (${sede.ciudad})` : ""}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {info?.organismo && (
          <Card>
            <CardHeader>
              <CardTitle>{t("organismoTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{info.organismo}</p>
            </CardContent>
          </Card>
        )}

        {info?.particularidades_md && (
          <Card>
            <CardHeader>
              <CardTitle>{t("particularidadesTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Markdown className="prose-sm">{info.particularidades_md}</Markdown>
            </CardContent>
          </Card>
        )}

        {enlaces.success && enlaces.data && enlaces.data.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t("linksTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {enlaces.data.map((enlace) => (
                  <li key={enlace.url}>
                    <a
                      href={enlace.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 underline underline-offset-2"
                    >
                      {enlace.titulo}
                      <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">{t("otherCcaa")}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {CCAA.filter((c) => c.code !== ccaa).map((c) => (
            <Link
              key={c.code}
              href={`/titulos/${degreeSlug}/${c.code}`}
              className="hover:bg-accent hover:text-accent-foreground rounded-md border px-2.5 py-1 text-xs transition-colors"
            >
              {c.name}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
