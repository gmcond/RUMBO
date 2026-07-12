import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

// Convención proxy.ts de Next 16 (sustituye a middleware.ts)
export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Todo excepto estáticos e imágenes
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
