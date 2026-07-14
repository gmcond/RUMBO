import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

/**
 * Cliente anónimo SIN cookies para páginas públicas SSG/ISR (guía del título,
 * escuelas). Solo lectura bajo RLS; al no tocar cookies() no fuerza el
 * renderizado dinámico y las páginas pueden prerenderizarse.
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
