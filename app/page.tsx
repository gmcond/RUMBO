import { getTranslations } from "next-intl/server";

// Placeholder: la landing real llega en el bloque 4 de la Fase 0.
export default async function Home() {
  const t = await getTranslations("landing");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight">RUMBO</h1>
      <p className="text-muted-foreground max-w-md text-lg">{t("tagline")}</p>
    </main>
  );
}
