import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/server";
import { changesetDiffSchema } from "@/lib/validation/content";

import { approveChangeset, rejectChangeset } from "../actions";

export const metadata: Metadata = { title: "Revisar changeset" };

const dateFmt = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** El valor actual se muestra tal cual está en BD; los objetos, como JSON. */
function renderValue(value: unknown, emptyLabel: string): string {
  if (value === null || value === undefined || value === "") return emptyLabel;
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

/** Valor editable: los strings se editan en crudo, el resto como JSON. */
function editableValue(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

export default async function ChangesetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("admin.changesets");
  const supabase = await createClient();

  const { data: changeset } = await supabase
    .from("content_changesets")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!changeset) notFound();

  const diff = changesetDiffSchema.parse(changeset.diff);
  const fuentes = (changeset.fuentes ?? []) as Array<{ url: string; titulo: string }>;
  const pending = changeset.estado === "pending";

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/changesets"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("backToList")}
      </Link>

      <div>
        <h1 className="flex flex-wrap items-center gap-3 text-3xl font-bold tracking-tight">
          {t("detailTitle", { scope: changeset.scope })}
          <Badge variant={pending ? "default" : "secondary"}>{changeset.estado}</Badge>
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {t("target")}: <code>{changeset.target_table}</code>
          {changeset.ccaa ? ` · ${changeset.ccaa}` : ""}
          {!changeset.target_id && (
            <Badge variant="outline" className="ml-2">
              {t("newRow")}
            </Badge>
          )}
          {" · "}
          {dateFmt.format(new Date(changeset.created_at))} · {changeset.created_by}
          {changeset.reviewed_at && (
            <> · {t("reviewedBy", { date: dateFmt.format(new Date(changeset.reviewed_at)) })}</>
          )}
        </p>
      </div>

      {fuentes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("sources")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {fuentes.map((f) => (
                <li key={f.url}>
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline underline-offset-2"
                  >
                    {f.titulo || f.url}
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <form action={approveChangeset} className="flex flex-col gap-4" id="approve-form">
        <input type="hidden" name="id" value={changeset.id} />

        {Object.entries(diff).map(([field, entry]) => (
          <Card key={field}>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">
                <code>{field}</code>
              </CardTitle>
              <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
                <span>
                  {t("confidence")}: {(entry.confidence * 100).toFixed(0)}%
                </span>
                <a
                  href={entry.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 underline underline-offset-2"
                >
                  {t("fieldSource")}
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="text-muted-foreground mb-1.5 text-xs font-medium uppercase">
                  {t("fieldOld")}
                </p>
                <pre className="bg-muted/50 max-h-64 overflow-auto rounded-md border p-3 text-xs whitespace-pre-wrap">
                  {renderValue(entry.old, t("emptyValue"))}
                </pre>
              </div>
              <div>
                <p className="text-muted-foreground mb-1.5 text-xs font-medium uppercase">
                  {t("fieldNew")}
                </p>
                {pending ? (
                  <Textarea
                    name={`value:${field}`}
                    defaultValue={editableValue(entry.new)}
                    rows={Math.min(12, Math.max(3, editableValue(entry.new).split("\n").length))}
                    className="font-mono text-xs"
                  />
                ) : (
                  <pre className="max-h-64 overflow-auto rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-xs whitespace-pre-wrap">
                    {renderValue(entry.new, t("emptyValue"))}
                  </pre>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {pending && <Button type="submit">{t("approve")}</Button>}
      </form>

      {pending && (
        <form action={rejectChangeset}>
          <input type="hidden" name="id" value={changeset.id} />
          <Button type="submit" variant="destructive">
            {t("reject")}
          </Button>
        </form>
      )}
    </div>
  );
}
