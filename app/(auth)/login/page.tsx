import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const t = await getTranslations("auth");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("loginTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && <p className="text-destructive text-sm">{t("authError")}</p>}
        <LoginForm next={next} />
        <p className="text-muted-foreground text-center text-sm">
          {t("noAccount")}{" "}
          <Link href="/registro" className="text-foreground underline underline-offset-4">
            {t("registerCta")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
