import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "./database.types";

/**
 * Refresca la sesión (patrón @supabase/ssr) y protege rutas:
 *   /estudio → requiere sesión
 *   /admin   → requiere sesión + rol admin (verificado contra profiles;
 *              la página lo re-verifica server-side: defensa en profundidad)
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // No ejecutar código entre createServerClient y getUser(): puede provocar
  // deslogueos aleatorios (documentación de @supabase/ssr).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const needsAuth = pathname.startsWith("/estudio") || pathname.startsWith("/admin");

  if (!user && needsAuth) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname.startsWith("/admin")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("rol")
      .eq("user_id", user.id)
      .single();

    if (profile?.rol !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/estudio";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  if (user && (pathname === "/login" || pathname === "/registro")) {
    const url = request.nextUrl.clone();
    url.pathname = "/estudio";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
