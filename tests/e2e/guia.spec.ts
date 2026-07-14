import { expect, test } from "@playwright/test";

// Guía del título (F3): páginas públicas con datos verificados + plantilla.
// Requiere BD sembrada (npm run seed) como el resto de la suite.

test("/titulos/per muestra la guía con proceso y enlaces por CCAA", async ({ page }) => {
  await page.goto("/titulos/per");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Guía del PER");
  await expect(page.getByRole("heading", { name: "Proceso paso a paso" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Preguntas frecuentes" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cataluña" })).toBeVisible();
});

test("/titulos/per/CAT muestra verificación con fecha y fuente", async ({ page }) => {
  await page.goto("/titulos/per/CAT");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("El PER en Cataluña");
  await expect(page.getByText(/Verificado el \d{2}\/\d{2}\/\d{4}/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Fuente oficial/ })).toBeVisible();
});

test("/titulos/per/MAD muestra la plantilla pendiente de verificación", async ({ page }) => {
  await page.goto("/titulos/per/MAD");
  await expect(page.getByText("Datos pendientes de verificación")).toBeVisible();
});

test("/escuelas lista y mantiene el filtro por CCAA en la URL", async ({ page }) => {
  await page.goto("/escuelas?ccaa=CAT");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Escuelas náuticas");
  await expect(page.locator("select#ccaa")).toHaveValue("CAT");
  await expect(page.getByText("¿Falta una escuela?")).toBeVisible();
});
