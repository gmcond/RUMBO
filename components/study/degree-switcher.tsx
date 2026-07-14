"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useTranslations } from "next-intl";

import { setActiveDegree } from "@/app/(study)/estudio/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface SwitcherDegree {
  id: string;
  slug: string;
  nombre: string;
}

/**
 * Selector de titulación activa (F4): visible en toda el área de estudio.
 * Cambiarla actualiza el perfil y refresca los Server Components, que
 * derivan todo su contenido de la titulación del perfil.
 */
export function DegreeSwitcher({
  degrees,
  activeId,
}: {
  degrees: SwitcherDegree[];
  activeId: string;
}) {
  const t = useTranslations("study.degreeSwitcher");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="degree-switcher" className="text-muted-foreground text-sm">
        {t("label")}
      </label>
      <Select
        value={activeId}
        disabled={pending}
        onValueChange={(value) => {
          if (value === activeId) return;
          startTransition(async () => {
            await setActiveDegree({ degreeId: value });
            router.refresh();
          });
        }}
      >
        <SelectTrigger id="degree-switcher" size="sm" aria-label={t("label")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {degrees.map((d) => (
            <SelectItem key={d.id} value={d.id} aria-label={d.nombre}>
              {d.slug.toUpperCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
