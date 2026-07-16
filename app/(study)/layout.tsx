import { redirect } from "next/navigation";

import { Navbar } from "@/components/navbar";
import { DegreeSwitcher } from "@/components/study/degree-switcher";
import { getActiveDegree } from "@/lib/study/data";
import { createClient } from "@/lib/supabase/server";

export default async function StudyLayout({ children }: { children: React.ReactNode }) {
  // Defensa en profundidad: el middleware ya protege /estudio
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/estudio");
  }

  // Selector de titulación (F4): visible en toda el área de estudio.
  const [{ data: degrees }, activeDegree] = await Promise.all([
    supabase.from("degrees").select("id, slug, nombre").order("orden"),
    getActiveDegree(supabase),
  ]);

  return (
    <>
      <Navbar />
      {activeDegree && (degrees ?? []).length > 1 && (
        <div className="bg-card/60 border-b">
          <div className="mx-auto flex h-11 w-full max-w-5xl items-center justify-between gap-3 px-4">
            <span className="text-muted-foreground min-w-0 truncate text-sm">
              <span className="border-primary/40 text-primary mr-2 hidden rounded-full border px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase sm:inline-block">
                {activeDegree.slug}
              </span>
              {activeDegree.nombre}
            </span>
            <DegreeSwitcher degrees={degrees ?? []} activeId={activeDegree.id} />
          </div>
        </div>
      )}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
