import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BadgeCheck, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CCAA, type CcaaCode } from "@/lib/ccaa";
import { createPublicClient } from "@/lib/supabase/public";
import { SCHOOL_MODALIDADES } from "@/lib/validation/content";

import { suggestSchool } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("escuelas");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

type SearchParams = {
  searchParams: Promise<{ ccaa?: string; ciudad?: string; sugerencia?: string }>;
};

const selectClass =
  "border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs";

export default async function EscuelasPage({ searchParams }: SearchParams) {
  const params = await searchParams;
  const t = await getTranslations("escuelas");
  const supabase = createPublicClient();

  const ccaaFilter = CCAA.find((c) => c.code === params.ccaa)?.code;
  const ciudadFilter = params.ciudad?.trim().slice(0, 80) ?? "";

  // La RLS ya limita a estado='published' para anon; el .eq es solo explícito.
  let query = supabase
    .from("schools")
    .select("*")
    .eq("estado", "published")
    .order("verificada", { ascending: false })
    .order("nombre");
  if (ccaaFilter) query = query.eq("ccaa", ccaaFilter);
  if (ciudadFilter) query = query.ilike("ciudad", `%${ciudadFilter.replaceAll("%", "")}%`);

  const { data: schools } = await query;
  const ccaaName = (code: string) => CCAA.find((c) => c.code === code)?.name ?? code;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h1>
      <p className="text-muted-foreground mt-3">{t("intro")}</p>

      {/* Filtros vía GET: sin JS de cliente, URLs compartibles e indexables */}
      <form method="get" className="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="ccaa">{t("filterCcaa")}</Label>
          <select id="ccaa" name="ccaa" defaultValue={ccaaFilter ?? ""} className={selectClass}>
            <option value="">{t("filterAll")}</option>
            {CCAA.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ciudad">{t("filterCiudad")}</Label>
          <Input
            id="ciudad"
            name="ciudad"
            defaultValue={ciudadFilter}
            placeholder={t("filterCiudadPlaceholder")}
          />
        </div>
        <Button type="submit" variant="secondary">
          {t("filterSubmit")}
        </Button>
      </form>

      <p className="text-muted-foreground mt-6 text-sm">
        {t("count", { count: schools?.length ?? 0 })}
      </p>

      {schools && schools.length > 0 ? (
        <ul className="mt-3 grid gap-3">
          {schools.map((school) => (
            <li key={school.id}>
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-1.5 font-semibold">
                      {school.nombre}
                      {school.verificada && (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <BadgeCheck className="size-4" aria-hidden />
                          <span className="sr-only sm:not-sr-only sm:text-xs sm:font-normal">
                            {t("verifiedBadge")}
                          </span>
                        </span>
                      )}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-sm">
                      {school.ciudad} · {ccaaName(school.ccaa)}
                    </p>
                    {school.modalidades.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {school.modalidades.map((m) => (
                          <Badge key={m} variant="secondary">
                            {SCHOOL_MODALIDADES.includes(m as never) ? t(`modalidad.${m}`) : m}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  {school.web && (
                    <a
                      href={school.web}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm underline underline-offset-2"
                    >
                      {t("webLink")}
                      <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground mt-3 rounded-md border border-dashed p-6 text-center text-sm">
          {t("empty")}
        </p>
      )}

      <Card className="mt-10">
        <CardHeader>
          <CardTitle>{t("suggestTitle")}</CardTitle>
          <p className="text-muted-foreground text-sm">{t("suggestIntro")}</p>
        </CardHeader>
        <CardContent>
          {params.sugerencia === "ok" && (
            <p
              role="status"
              className="mb-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm"
            >
              {t("suggestOk")}
            </p>
          )}
          {params.sugerencia === "error" && (
            <p role="alert" className="border-destructive/40 bg-destructive/10 mb-4 rounded-md border p-3 text-sm">
              {t("suggestError")}
            </p>
          )}

          <form action={suggestSchool} className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="sug-nombre">{t("suggestNombre")}</Label>
              <Input id="sug-nombre" name="nombre" required minLength={3} maxLength={120} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sug-ccaa">{t("filterCcaa")}</Label>
              <select
                id="sug-ccaa"
                name="ccaa"
                required
                defaultValue={(ccaaFilter ?? "CAT") satisfies CcaaCode}
                className={selectClass}
              >
                {CCAA.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sug-ciudad">{t("suggestCiudad")}</Label>
              <Input id="sug-ciudad" name="ciudad" required minLength={2} maxLength={80} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sug-web">{t("suggestWeb")}</Label>
              <Input id="sug-web" name="web" type="url" placeholder="https://" maxLength={200} />
            </div>
            <fieldset className="sm:col-span-2">
              <legend className="text-sm font-medium">{t("suggestModalidades")}</legend>
              <div className="mt-2 flex flex-wrap gap-4">
                {SCHOOL_MODALIDADES.map((m) => (
                  <label key={m} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="modalidades" value={m} className="size-4" />
                    {t(`modalidad.${m}`)}
                  </label>
                ))}
              </div>
            </fieldset>
            {/* Honeypot anti-spam: oculto para humanos, los bots lo rellenan */}
            <input
              type="text"
              name="empresa"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="hidden"
            />
            <Button type="submit" className="sm:col-span-2 sm:justify-self-start">
              {t("suggestSubmit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
