import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { HelpCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const t = await getTranslations("admin");
  const supabase = await createClient();

  const { count: reviewCount } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("estado", "review");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <HelpCircle className="text-muted-foreground size-4" aria-hidden />
            {t("questionsCta")}
            {typeof reviewCount === "number" && reviewCount > 0 && (
              <Badge variant="destructive">{reviewCount}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button asChild size="sm">
            <Link href="/admin/preguntas">{t("questionsCta")}</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-sm">{t("placeholder")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
