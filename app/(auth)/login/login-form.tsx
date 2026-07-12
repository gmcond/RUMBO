"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, signInWithGoogle, type AuthFormState } from "../actions";

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(login, {});

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">{t("password")}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        {state.error && <p className="text-destructive text-sm">{state.error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {t("loginCta")}
        </Button>
      </form>

      <div className="text-muted-foreground flex items-center gap-3 text-xs uppercase">
        <span className="bg-border h-px flex-1" />
        {t("or")}
        <span className="bg-border h-px flex-1" />
      </div>

      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next ?? ""} />
        <Button type="submit" variant="outline" className="w-full">
          {t("googleCta")}
        </Button>
      </form>
    </div>
  );
}
