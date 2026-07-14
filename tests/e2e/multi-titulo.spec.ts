import { expect, test, type Page } from "@playwright/test";

import { createTestUser, deleteTestUser, login, type TestUser } from "./helpers/auth";

/**
 * Criterio de cierre de F4 (PRD §8-F4): un usuario cambia a PNB y puede
 * estudiar y simular sin código específico de PNB (solo datos). Requiere BD
 * sembrada (npm run seed) como el resto de la suite.
 */

async function switchDegree(page: Page, label: "PER" | "PNB", fullName: RegExp) {
  await page.getByRole("combobox", { name: /Titulación|Titulació/ }).click();
  await page.getByRole("option", { name: label }).click();
  // El cambio actualiza el perfil y refresca los Server Components: la franja
  // del layout muestra el nombre completo de la titulación activa.
  await expect(page.getByText(fullName)).toBeVisible({ timeout: 15_000 });
}

test.describe.serial("F4 · multi-titulación", () => {
  let user: TestUser;

  test.beforeAll(async () => {
    user = await createTestUser("f4");
  });

  test.afterAll(async () => {
    if (user) await deleteTestUser(user);
  });

  test("cambiar a PNB permite estudiar y simular solo con datos", async ({ page }) => {
    await login(page, user);

    // Onboarding: nombre + valores por defecto (Cataluña, PER).
    await page.waitForURL(/\/onboarding/);
    await page.locator("#nombre").fill("E2E F4");
    await page.getByRole("button", { name: /Empezar a estudiar|Comença a estudiar/ }).click();
    await page.waitForURL(/\/estudio$/);

    // Con PER activo el panel llega hasta UT11.
    await expect(page.getByRole("link", { name: /UT11/ }).first()).toBeVisible();

    // Cambio a PNB desde el selector del área de estudio.
    await switchDegree(page, "PNB", /Patrón para Navegación Básica/);
    await expect(page.getByRole("link", { name: /UT11/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /UT6/ }).first()).toBeVisible();

    // Unidades del PNB: exactamente UT1-UT6 compartidas con el PER.
    await page.goto("/estudio/pnb");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Navegación Básica");
    await expect(page.getByRole("link", { name: /UT6/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /UT7/ })).toHaveCount(0);

    // Se puede estudiar: la lección de UT1 del PER sirve tal cual al PNB.
    await page.goto("/estudio/pnb/ut1");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("UT1");

    // Flashcards acotadas al temario PNB.
    await page.goto("/estudio/flashcards");
    await expect(page.getByText(/UT6/).first()).toBeVisible();
    await expect(page.getByText(/UT7/)).toHaveCount(0);

    // Simulador: la exam_config PNB/CAT manda (27 preguntas, datos en BD).
    await page.goto("/estudio/simulacro");
    await expect(page.getByText("27 preguntas")).toBeVisible();
    await page.getByRole("radio", { name: /práctica|pràctica/i }).check();
    await page.getByRole("button", { name: /Empezar simulacro|Comença el simulacre/ }).click();
    await page.waitForURL(/\/estudio\/simulacro\/activo/);
    await expect(page.getByText("Pregunta 1 de 27")).toBeVisible({ timeout: 15_000 });

    // De vuelta a PER: el panel recupera UT11 y el simulacro PNB a medias
    // queda guardado y etiquetado, sin descartarse (decisión F4).
    await page.goto("/estudio");
    await switchDegree(page, "PER", /Patrón de Embarcaciones de Recreo/);
    await expect(page.getByRole("link", { name: /UT11/ }).first()).toBeVisible();

    await page.goto("/estudio/simulacro");
    await expect(page.getByText(/Simulacro de .*Navegación Básica.* en pausa/)).toBeVisible();
  });
});
