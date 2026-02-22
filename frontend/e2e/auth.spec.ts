import { expect, test } from "@playwright/test";

const activeMapPayload = {
  map: {
    id: "map_1",
    name: "Mapa Inicial",
    worldWidth: 1920,
    worldHeight: 1088,
    cellSize: 32,
    cols: 60,
    rows: 34,
    backgroundImageData: null,
    backgroundScale: 1,
    tilePalette: [],
    tileLayer: Array.from({ length: 34 }, () => Array.from({ length: 60 }, () => null)),
    collisionLayer: Array.from({ length: 34 }, () => Array.from({ length: 60 }, () => false)),
    enemySpawns: [],
    portals: [],
    spawnX: 30,
    spawnY: 17,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  state: {
    userId: "u1",
    mapId: "map_1",
    tileX: 30,
    tileY: 17,
    scaleX: 3,
    scaleY: 3,
    updatedAt: new Date().toISOString(),
  },
};

test("register -> explore authenticated", async ({ page }) => {
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
      body: JSON.stringify({ user: { id: "u1", username: "trainer", email: "trainer@example.com", role: "ADMIN" } }),
    });
  });

  await page.route("**/auth/register", async (route) => {
    authenticated = true;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ user: { id: "u1", username: "trainer", email: "trainer@example.com", role: "ADMIN" } }),
    });
  });

  await page.route("**/mapas/ativo", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(activeMapPayload),
    });
  });

  await page.route("**/adocoes", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ animas: [] }) });
  });

  await page.goto("/register");
  await page.getByLabel("Usuario").fill("trainer");
  await page.getByLabel("Email").fill("trainer@example.com");
  await page.getByLabel("Senha", { exact: true }).fill("password123");
  await page.getByLabel("Confirmar senha").fill("password123");
  await page.getByRole("button", { name: "Criar conta" }).click();

  await expect(page.getByText(/Exploracao em grid/i)).toBeVisible();
});

test("logout redirects to login", async ({ page }) => {
  await page.route("**/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: { id: "u1", username: "trainer", email: "trainer@example.com", role: "ADMIN" } }),
    });
  });

  await page.route("**/mapas/ativo", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(activeMapPayload),
    });
  });

  await page.route("**/adocoes", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ animas: [] }) });
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
      body: JSON.stringify({ user: { id: "u1", username: "trainer", email: "trainer@example.com", role: "ADMIN" } }),
    });
  });

  await page.route("**/mapas/ativo", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(activeMapPayload),
    });
  });

  await page.route("**/adocoes", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ animas: [] }) });
  });

  await page.goto("/app");
  await expect(page.getByText(/Exploracao em grid/i)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Exploracao em grid/i)).toBeVisible();
});
