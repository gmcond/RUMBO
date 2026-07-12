import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

/**
 * Cliente con service_role: salta RLS. SOLO servidor (route handlers,
 * server actions, scripts) — jamás en cliente (CLAUDE.md regla 5).
 * Guard en runtime en vez del paquete `server-only` para que los scripts
 * de node (seed, update-content) también puedan usarlo.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient() no puede usarse en el navegador");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno (.env.local)"
    );
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
