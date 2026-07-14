import { readFileSync } from "node:fs";
import path from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

/**
 * Utilidades de sesión para e2e autenticados (F4). El proceso de Playwright
 * no carga .env.local (eso lo hace Next en el webServer), así que se lee
 * aquí para poder crear/borrar el usuario de prueba con la service role.
 */
function loadEnvLocal(): void {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const raw = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!match) continue;
    const [, key, value] = match;
    process.env[key] ??= value.replace(/^["']|["']$/g, "");
  }
}

function adminClient(): SupabaseClient {
  loadEnvLocal();
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

/** Alta directa con email confirmado: el flujo de registro no es el objetivo. */
export async function createTestUser(prefix: string): Promise<TestUser> {
  const supabase = adminClient();
  const email = `${prefix}-${Date.now()}@e2e.rumbo.test`;
  const password = `e2e-${crypto.randomUUID()}`;

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`No se pudo crear el usuario e2e: ${error?.message}`);
  return { id: data.user.id, email, password };
}

/** Borra el usuario (cascade limpia perfil, tarjetas y attempts). */
export async function deleteTestUser(user: TestUser): Promise<void> {
  const supabase = adminClient();
  const { error } = await supabase.auth.admin.deleteUser(user.id);
  if (error) throw new Error(`No se pudo borrar el usuario e2e: ${error.message}`);
}

export async function login(page: Page, user: TestUser): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(user.email);
  await page.locator("#password").fill(user.password);
  await page.getByRole("button", { name: /Entrar|Entra/ }).click();
  await page.waitForURL(/\/(estudio|onboarding)/);
}
