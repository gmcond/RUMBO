import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Banco de preguntas" };

const ESTADOS = ["review", "published", "draft"] as const;
type Estado = (typeof ESTADOS)[number];

export default async function AdminQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const params = await searchParams;
  const estado: Estado = ESTADOS.includes(params.estado as Estado)
    ? (params.estado as Estado)
    : "review";

  const t = await getTranslations("admin.questions");
  const supabase = await createClient();

  // El admin ve todos los estados (política RLS is_admin en questions).
  const { data: questions, error } = await supabase
    .from("questions")
    .select("id, enunciado, origen, estado, dificultad, units(numero)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`questions: ${error.message}`);

  const all = questions ?? [];
  const counts = new Map<Estado, number>();
  for (const e of ESTADOS) counts.set(e, all.filter((q) => q.estado === e).length);
  const filtered = all
    .filter((q) => q.estado === estado)
    .sort((a, b) => a.units.numero - b.units.numero);

  const labels: Record<Estado, string> = {
    review: t("statusReview"),
    published: t("statusPublished"),
    draft: t("statusDraft"),
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {ESTADOS.map((e) => (
          <Button key={e} asChild size="sm" variant={e === estado ? "default" : "outline"}>
            <Link href={`/admin/preguntas?estado=${e}`}>
              {labels[e]} ({counts.get(e) ?? 0})
            </Link>
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">{t("colUnit")}</TableHead>
                <TableHead>{t("colQuestion")}</TableHead>
                <TableHead className="w-28">{t("colOrigin")}</TableHead>
                <TableHead className="w-14">{t("colDifficulty")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-medium tabular-nums">UT{q.units.numero}</TableCell>
                  <TableCell>
                    <Link href={`/admin/preguntas/${q.id}`} className="hover:underline">
                      <span className="line-clamp-2">{q.enunciado}</span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={q.origen === "ai_generated" ? "outline" : "secondary"}>
                      {q.origen}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {q.dificultad ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
