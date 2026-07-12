"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CCAA } from "@/lib/ccaa";
import { completeOnboarding, type AuthFormState } from "../actions";

type Degree = { id: string; slug: string; nombre: string };

export function OnboardingForm({
  degrees,
  defaultName,
}: {
  degrees: Degree[];
  defaultName: string;
}) {
  const t = useTranslations("onboarding");
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    completeOnboarding,
    {}
  );

  const defaultDegree = degrees.find((d) => d.slug === "per") ?? degrees[0];

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="nombre">{t("name")}</Label>
        <Input
          id="nombre"
          name="nombre"
          defaultValue={defaultName}
          placeholder={t("namePlaceholder")}
          maxLength={80}
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="ccaa">{t("ccaa")}</Label>
        <Select name="ccaa" defaultValue="CAT" required>
          <SelectTrigger id="ccaa" className="w-full">
            <SelectValue placeholder={t("ccaaPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {CCAA.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="degreeId">{t("degree")}</Label>
        {degrees.length > 0 ? (
          <Select name="degreeId" defaultValue={defaultDegree?.id} required>
            <SelectTrigger id="degreeId" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {degrees.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          // Sin titulaciones sembradas todavía: PER por defecto (se asigna al sembrar)
          <Input value="PER — Patrón de Embarcaciones de Recreo" disabled readOnly />
        )}
      </div>

      {state.error && <p className="text-destructive text-sm">{state.error}</p>}

      <Button type="submit" disabled={pending} className="w-full">
        {t("cta")}
      </Button>
    </form>
  );
}
