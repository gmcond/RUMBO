import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

// Verificación por token_hash (plantillas de email recomendadas por
// @supabase/ssr: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email)
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/estudio";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next.startsWith("/") ? next : "/estudio"}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
