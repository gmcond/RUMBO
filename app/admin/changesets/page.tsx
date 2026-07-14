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

export const metadata: Metadata = { title: "Cola de changesets" };

const ESTADOS = ["pending", "approved", "rejected"] as const;
type Estado = (typeof ESTADOS)[number];

const dateFmt = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function AdminChangesetsPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const params = await searchParams;
  const estado: Estado = ESTADOS.includes(params.estado as Estado)
    ? (params.estado as Estado)
    : "pending";

  const t = await getTranslations("admin.changesets");
  const supabase = await createClient();

  const { data: changesets, error } = await supabase
    .from("content_changesets")
    .select("id, scope, ccaa, target_table, target_id, diff, estado, created_by, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`content_changesets: ${error.message}`);

  const all = changesets ?? [];
  const filtered = all.filter((c) => c.estado === estado);
  const labels: Record<Estado, string> = {
    pending: t("statusPending"),
    approved: t("statusApproved"),
    rejected: t("statusRejected"),
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
            <Link href={`/admin/changesets?estado=${e}`}>
              {labels[e]} ({all.filter((c) => c.estado === e).length})
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
                <TableHead>{t("colDate")}</TableHead>
                <TableHead>{t("colScope")}</TableHead>
                <TableHead>{t("colCcaa")}</TableHead>
                <TableHead>{t("colTarget")}</TableHead>
                <TableHead className="text-right">{t("colFields")}</TableHead>
                <TableHead>{t("colAuthor")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    <Link href={`/admin/changesets/${c.id}`} className="hover:underline">
                      {dateFmt.format(new Date(c.created_at))}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/admin/changesets/${c.id}`} className="hover:underline">
                      <Badge>{c.scope}</Badge>
                    </Link>
                  </TableCell>
                  <TableCell>{c.ccaa ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.target_table}
                    {!c.target_id && <Badge variant="outline" className="ml-2">{t("newRow")}</Badge>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Object.keys((c.diff as object) ?? {}).length}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.created_by === "ai" ? "outline" : "secondary"}>
                      {c.created_by}
                    </Badge>
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
