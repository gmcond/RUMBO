import { expect, test } from "@playwright/test";

// Smoke F1: las rutas del módulo de estudio existen y quedan protegidas.

const PROTECTED_ROUTES = [
  "/estudio",
  "/estudio/per",
  "/estudio/per/ut1",
  "/estudio/flashcards",
  "/estudio/tests",
];

for (const route of PROTECTED_ROUTES) {
  test(`${route} sin sesión redirige a /login`, async ({ page }) => {
    await page.goto(route);
    await page.waitForURL(/\/login/);
    await expect(page).toHaveURL(/\/login/);
  });
}

test("/admin/preguntas sin sesión redirige a /login", async ({ page }) => {
  await page.goto("/admin/preguntas");
  await page.waitForURL(/\/login/);
  await expect(page).toHaveURL(/\/login/);
});

test("los SVG de los diagramas se sirven como estáticos", async ({ request }) => {
  for (const file of ["casco-lateral.svg", "dimensiones.svg"]) {
    const response = await request.get(`/diagrams/${file}`);
    expect(response.status(), file).toBe(200);
    const body = await response.text();
    expect(body).toContain("<svg");
    expect(body).toContain("hotspot");
  }
});
