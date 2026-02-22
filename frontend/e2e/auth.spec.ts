import { expect, test } from "@playwright/test";

test("register -> home authenticated", async ({ page }) => {
  let authenticated = false;

  await page.route("**/auth/me", async (route) => {
    if (!authenticated) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: { id: "u1", username: "trainer", email: "trainer@example.com" } }),
    });
  });

  await page.route("**/auth/register", async (route) => {
    authenticated = true;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ user: { id: "u1", username: "trainer", email: "trainer@example.com" } }),
    });
  });

  await page.goto("/register");
  await page.getByLabel("Usuario").fill("trainer");
  await page.getByLabel("Email").fill("trainer@example.com");
  await page.getByLabel("Senha", { exact: true }).fill("password123");
  await page.getByLabel("Confirmar senha").fill("password123");
  await page.getByRole("button", { name: "Criar conta" }).click();

  await expect(page.getByText(/Bem-vindo de volta, trainer/i)).toBeVisible();
});

test("logout redirects to login", async ({ page }) => {
  await page.route("**/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: { id: "u1", username: "trainer", email: "trainer@example.com" } }),
    });
  });

  await page.route("**/auth/logout", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });

  await page.goto("/app");
  await page.getByRole("button", { name: "Sair" }).first().click();
  await expect(page.getByRole("heading", { name: "Entrar no Anima MMO" })).toBeVisible();
});

test("session persists after reload", async ({ page }) => {
  await page.route("**/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: { id: "u1", username: "trainer", email: "trainer@example.com" } }),
    });
  });

  await page.goto("/app");
  await expect(page.getByText(/Bem-vindo de volta, trainer/i)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Bem-vindo de volta, trainer/i)).toBeVisible();
});
