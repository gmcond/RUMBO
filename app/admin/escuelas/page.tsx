import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BadgeCheck, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CCAA } from "@/lib/ccaa";
import { createClient } from "@/lib/supabase/server";
import { SCHOOL_MODALIDADES } from "@/lib/validation/content";

import { createSchool, moderateSchool, setSchoolVerified } from "./actions";

export const metadata: Metadata = { title: "Escuelas náuticas" };

const selectClass =
  "border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs";

type School = {
  id: string;
  nombre: string;
  ccaa: string;
  ciudad: string;
  web: string | null;
  modalidades: string[];
  verificada: boolean;
  origen: string;
};

function SchoolMeta({ school }: { school: School }) {
  const ccaaName = CCAA.find((c) => c.code === school.ccaa)?.name ?? school.ccaa;
  return (
    <div className="min-w-0">
      <p className="flex flex-wrap items-center gap-1.5 font-medium">
        {school.nombre}
        {school.verificada && (
          <BadgeCheck className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
        )}
        <Badge variant="outline">{school.origen}</Badge>
      </p>
      <p className="text-muted-foreground mt-0.5 text-sm">
        {school.ciudad} · {ccaaName}
        {school.modalidades.length > 0 && <> · {school.modalidades.join(", ")}</>}
        {school.web && (
          <>
            {" · "}
            <a
              href={school.web}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 underline underline-offset-2"
            >
              web
              <ExternalLink className="size-3" aria-hidden />
            </a>
          </>
        )}
      </p>
    </div>
  );
}

export default async function AdminSchoolsPage() {
  const t = await getTranslations("admin.schools");
  const supabase = await createClient();

  const { data: schools, error } = await supabase
    .from("schools")
    .select("id, nombre, ccaa, ciudad, web, modalidades, verificada, estado, origen")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`schools: ${error.message}`);

  const all = schools ?? [];
  const pending = all.filter((s) => s.estado === "pending");
  const published = all.filter((s) => s.estado === "published");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {t("pendingTitle")}
            {pending.length > 0 && <Badge variant="destructive">{pending.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("emptyPending")}</p>
          ) : (
            <ul className="divide-y">
              {pending.map((school) => (
                <li
                  key={school.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <SchoolMeta school={school} />
                  <div className="flex gap-2">
                    <form action={moderateSchool}>
                      <input type="hidden" name="id" value={school.id} />
                      <input type="hidden" name="estado" value="published" />
                      <Button type="submit" size="sm">
                        {t("publish")}
                      </Button>
                    </form>
                    <form action={moderateSchool}>
                      <input type="hidden" name="id" value={school.id} />
                      <input type="hidden" name="estado" value="rejected" />
                      <Button type="submit" size="sm" variant="destructive">
                        {t("reject")}
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("publishedTitle")} ({published.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {published.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("emptyPublished")}</p>
          ) : (
            <ul className="divide-y">
              {published.map((school) => (
                <li
                  key={school.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <SchoolMeta school={school} />
                  <div className="flex gap-2">
                    <form action={setSchoolVerified}>
                      <input type="hidden" name="id" value={school.id} />
                      <input
                        type="hidden"
                        name="verificada"
                        value={school.verificada ? "false" : "true"}
                      />
                      <Button type="submit" size="sm" variant="outline">
                        {school.verificada ? t("unverify") : t("verify")}
                      </Button>
                    </form>
                    <form action={moderateSchool}>
                      <input type="hidden" name="id" value={school.id} />
                      <input type="hidden" name="estado" value="pending" />
                      <Button type="submit" size="sm" variant="ghost">
                        {t("unpublish")}
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("newTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createSchool} className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="new-nombre">{t("nombre")}</Label>
              <Input id="new-nombre" name="nombre" required minLength={3} maxLength={120} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-ccaa">{t("ccaa")}</Label>
              <select id="new-ccaa" name="ccaa" required defaultValue="CAT" className={selectClass}>
                {CCAA.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-ciudad">{t("ciudad")}</Label>
              <Input id="new-ciudad" name="ciudad" required minLength={2} maxLength={80} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-web">{t("web")}</Label>
              <Input id="new-web" name="web" type="url" placeholder="https://" maxLength={200} />
            </div>
            <fieldset>
              <legend className="text-sm font-medium">{t("modalidades")}</legend>
              <div className="mt-2 flex flex-wrap gap-4">
                {SCHOOL_MODALIDADES.map((m) => (
                  <label key={m} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="modalidades" value={m} className="size-4" />
                    {m}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex items-center gap-2 self-end text-sm">
              <input type="checkbox" name="verificada" value="true" className="size-4" />
              {t("verificada")}
            </label>
            <Button type="submit" className="sm:col-span-2 sm:justify-self-start">
              {t("create")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
