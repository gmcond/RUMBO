import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Check, X } from "lucide-react";

import { approveQuestion, rejectQuestion, saveQuestion } from "@/app/admin/preguntas/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { parseOpciones } from "@/lib/study/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Editar pregunta" };

const LETTERS = ["a", "b", "c", "d"] as const;

export default async function EditQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("admin.questions");
  const supabase = await createClient();

  const [{ data: question }, { data: units }] = await Promise.all([
    supabase
      .from("questions")
      .select("id, unit_id, enunciado, opciones, correcta, explicacion, dificultad, origen, estado")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("units").select("id, numero, titulo").order("numero"),
  ]);
  if (!question) notFound();

  const opciones = parseOpciones(question.opciones);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/admin/preguntas">
            <ArrowLeft aria-hidden />
            {t("backToList")}
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{t("edit")}</h1>
          <Badge variant="outline">{question.origen}</Badge>
          <Badge variant={question.estado === "published" ? "secondary" : "destructive"}>
            {question.estado}
          </Badge>
        </div>
      </div>

      <form className="flex flex-col gap-4">
        <input type="hidden" name="id" value={question.id} />

        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <Field>
              <FieldLabel htmlFor="unit_id">{t("unit")}</FieldLabel>
              <select
                id="unit_id"
                name="unit_id"
                defaultValue={question.unit_id}
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              >
                {(units ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    UT{u.numero} · {u.titulo}
                  </option>
                ))}
              </select>
            </Field>

            <Field>
              <FieldLabel htmlFor="enunciado">{t("statement")}</FieldLabel>
              <Textarea id="enunciado" name="enunciado" defaultValue={question.enunciado} required />
            </Field>

            <div className="flex flex-col gap-3">
              {LETTERS.map((letter, i) => (
                <div key={letter} className="flex items-center gap-3">
                  <label className="flex shrink-0 items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      name="correcta"
                      value={i}
                      defaultChecked={question.correcta === i}
                      className="accent-primary size-4"
                      aria-label={`${t("correct")} ${letter}`}
                    />
                    <span className="w-4 font-mono font-semibold">{letter})</span>
                  </label>
                  <Input
                    name={`opcion${i}`}
                    defaultValue={opciones[i]}
                    aria-label={t("option", { letter })}
                    required
                  />
                </div>
              ))}
              <p className="text-muted-foreground text-xs">{t("correct")}: ◉</p>
            </div>

            <Field>
              <FieldLabel htmlFor="explicacion">{t("explanation")}</FieldLabel>
              <Textarea
                id="explicacion"
                name="explicacion"
                defaultValue={question.explicacion ?? ""}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="dificultad">{t("difficulty")}</FieldLabel>
              <select
                id="dificultad"
                name="dificultad"
                defaultValue={question.dificultad?.toString() ?? ""}
                className="border-input bg-background h-9 w-40 rounded-md border px-3 text-sm"
              >
                <option value="">{t("noDifficulty")}</option>
                {[1, 2, 3, 4, 5].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button formAction={saveQuestion} variant="outline">
            {t("save")}
          </Button>
          {question.estado !== "published" && (
            <Button formAction={approveQuestion}>
              <Check aria-hidden />
              {t("approve")}
            </Button>
          )}
          {question.estado !== "draft" && (
            <Button formAction={rejectQuestion} variant="destructive">
              <X aria-hidden />
              {t("reject")}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
