import { expect, test } from "@playwright/test";

test("la landing carga y muestra la marca", async ({ page }) => {
  await page.goto("/");
  // F4.5: el h1 pasa a ser la propuesta de valor; la marca vive en el wordmark del navbar
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: /rumbo/i }).first()).toBeVisible();
});
