import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDegree, getUnitsForDegree } from "@/lib/study/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Tests" };

/**
 * Configurador de tests: formulario GET puro (sin JS) que navega a
 * /estudio/tests/practica con los filtros elegidos.
 */
export default async function TestsPage({
  searchParams,
}: {
  searchParams: Promise<{ ut?: string }>;
}) {
  const { ut: preselected } = await searchParams;
  const supabase = await createClient();
  const t = await getTranslations("study.tests");

  const degree = await getDegree(supabase, "per");
  if (!degree) return null;
  const units = await getUnitsForDegree(supabase, degree.id);

  const { data: published } = await supabase
    .from("questions")
    .select("unit_id")
    .eq("estado", "published")
    .in("unit_id", units.map((u) => u.id));
  const countByUnit = new Map<string, number>();
  for (const q of published ?? []) {
    countByUnit.set(q.unit_id, (countByUnit.get(q.unit_id) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      <form action="/estudio/tests/practica" method="get" className="flex flex-col gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("unitsLegend")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {units.map((unit) => (
                <label
                  key={unit.id}
                  className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2"
                >
                  <input
                    type="checkbox"
                    name="ut"
                    value={unit.numero}
                    defaultChecked={
                      preselected !== undefined && Number(preselected) === unit.numero
                    }
                    className="accent-primary size-4"
                  />
                  <span className="flex-1 text-sm font-medium">
                    UT{unit.numero} · {unit.titulo}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {t("questions", { count: countByUnit.get(unit.id) ?? 0 })}
                  </span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("countLegend")}</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            {[5, 10, 20].map((n) => (
              <label
                key={n}
                className="hover:bg-muted/50 flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium"
              >
                <input
                  type="radio"
                  name="n"
                  value={n}
                  defaultChecked={n === 10}
                  className="accent-primary size-4"
                />
                {n}
              </label>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("filterLegend")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 sm:flex-row">
            {(
              [
                ["todas", t("filterAll")],
                ["falladas", t("filterFailed")],
                ["no-vistas", t("filterUnseen")],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className="hover:bg-muted/50 flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium"
              >
                <input
                  type="radio"
                  name="filtro"
                  value={value}
                  defaultChecked={value === "todas"}
                  className="accent-primary size-4"
                />
                {label}
              </label>
            ))}
          </CardContent>
        </Card>

        <Button type="submit" className="h-12 sm:self-start sm:px-8">
          {t("start")}
        </Button>
      </form>
    </div>
  );
}
