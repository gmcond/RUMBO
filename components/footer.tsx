import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Wordmark } from "@/components/brand/wordmark";

export async function Footer() {
  const t = await getTranslations("nav");

  return (
    <footer className="text-muted-foreground border-t py-8 text-center text-sm">
      <Wordmark className="text-foreground mb-3 text-lg" />
      <nav className="mb-2 flex justify-center gap-4">
        <Link href="/titulos/per" className="hover:text-foreground rounded-sm transition-colors">
          {t("guide")}
        </Link>
        <Link href="/escuelas" className="hover:text-foreground rounded-sm transition-colors">
          {t("schools")}
        </Link>
      </nav>
      <p>Formación y servicios náuticos</p>
    </footer>
  );
}
