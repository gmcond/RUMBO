import { redirect } from "next/navigation";

import { Navbar } from "@/components/navbar";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Defensa en profundidad: el middleware ya protege /admin, pero el rol se
  // re-verifica aquí contra la BD.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("rol")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile?.rol !== "admin") {
    redirect("/estudio");
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
