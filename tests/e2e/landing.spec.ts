import { expect, test } from "@playwright/test";

test("la landing carga y muestra la marca", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/rumbo/i);
});
