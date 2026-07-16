import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { logout } from "@/app/(auth)/actions";
import { Wordmark } from "@/components/brand/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/server";

export async function Navbar() {
  const t = await getTranslations("nav");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = user
    ? (await supabase.from("profiles").select("nombre, rol").eq("user_id", user.id).maybeSingle())
        .data
    : null;

  const initial = (profile?.nombre ?? user?.email ?? "?").charAt(0).toUpperCase();

  return (
    <header className="bg-background/80 sticky top-0 z-50 border-b backdrop-blur">
      <nav className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-2 px-4">
        <Link href="/" aria-label="RUMBO — inicio" className="rounded-md">
          <Wordmark className="text-xl" />
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/titulos/per">{t("guide")}</Link>
          </Button>
          {user ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/estudio">{t("study")}</Link>
              </Button>
              {profile?.rol === "admin" && (
                <Button asChild variant="ghost" size="sm">
                  <Link href="/admin">{t("admin")}</Link>
                </Button>
              )}
              <ThemeToggle />
              <DropdownMenu>
                <DropdownMenuTrigger className="rounded-full">
                  <Avatar>
                    <AvatarFallback>{initial}</AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel className="max-w-48 truncate">
                    {profile?.nombre ?? user.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <form action={logout} className="w-full">
                      <button type="submit" className="w-full text-left">
                        {t("logout")}
                      </button>
                    </form>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <ThemeToggle />
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">{t("login")}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/registro">{t("register")}</Link>
              </Button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
