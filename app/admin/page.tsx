import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const t = await getTranslations("admin");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Fase 0 · Fundación</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{t("placeholder")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
