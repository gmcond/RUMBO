import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { GitPullRequest, HelpCircle, School } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const t = await getTranslations("admin");
  const supabase = await createClient();

  const [{ count: reviewCount }, { count: changesetCount }, { count: schoolCount }] =
    await Promise.all([
      supabase.from("questions").select("id", { count: "exact", head: true }).eq("estado", "review"),
      supabase
        .from("content_changesets")
        .select("id", { count: "exact", head: true })
        .eq("estado", "pending"),
      supabase.from("schools").select("id", { count: "exact", head: true }).eq("estado", "pending"),
    ]);

  const sections = [
    { icon: HelpCircle, title: t("questionsCta"), href: "/admin/preguntas", count: reviewCount },
    {
      icon: GitPullRequest,
      title: t("changesetsCta"),
      href: "/admin/changesets",
      count: changesetCount,
    },
    { icon: School, title: t("schoolsCta"), href: "/admin/escuelas", count: schoolCount },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>

      {sections.map((section) => (
        <Card key={section.href}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <section.icon className="text-muted-foreground size-4" aria-hidden />
              {section.title}
              {typeof section.count === "number" && section.count > 0 && (
                <Badge variant="destructive">{section.count}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm">
              <Link href={section.href}>{section.title}</Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
