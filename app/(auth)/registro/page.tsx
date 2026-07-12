import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function RegisterPage() {
  const t = await getTranslations("auth");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("registerTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <RegisterForm />
        <p className="text-muted-foreground text-center text-sm">
          {t("hasAccount")}{" "}
          <Link href="/login" className="text-foreground underline underline-offset-4">
            {t("loginCta")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
