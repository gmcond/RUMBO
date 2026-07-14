import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function Footer() {
  const t = await getTranslations("nav");

  return (
    <footer className="text-muted-foreground border-t py-6 text-center text-sm">
      <nav className="mb-2 flex justify-center gap-4">
        <Link href="/titulos/per" className="hover:text-foreground transition-colors">
          {t("guide")}
        </Link>
        <Link href="/escuelas" className="hover:text-foreground transition-colors">
          {t("schools")}
        </Link>
      </nav>
      <p>RUMBO · Formación y servicios náuticos</p>
    </footer>
  );
}
