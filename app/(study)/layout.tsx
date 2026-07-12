import { redirect } from "next/navigation";

import { Navbar } from "@/components/navbar";
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

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
