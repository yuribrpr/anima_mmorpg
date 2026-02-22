import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "@/App";

const jsonResponse = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

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

describe("auth routing", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects unauthenticated users from /app to /login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(401, { error: { code: "UNAUTHORIZED", message: "Authentication required" } })),
    );

    window.history.pushState({}, "", "/app");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Entrar no Anima MMO" })).toBeInTheDocument();
  });

  it("redirects authenticated users from /login to /app/explorar", async () => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/auth/me")) {
        return Promise.resolve(
          jsonResponse(200, {
            user: { id: "u1", username: "trainer", email: "trainer@example.com", role: "ADMIN" },
          }),
        );
      }

      if (url.endsWith("/mapas/ativo")) {
        return Promise.resolve(jsonResponse(200, activeMapPayload));
      }

      if (url.endsWith("/adocoes")) {
        return Promise.resolve(jsonResponse(200, { animas: [] }));
      }

      return Promise.resolve(jsonResponse(404, { error: { code: "NOT_FOUND", message: "not found" } }));
    }));

    window.history.pushState({}, "", "/login");
    render(<App />);

    expect(await screen.findByText(/Exploracao em grid/i)).toBeInTheDocument();
  });

  it("shows validation errors on login form", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(401, { error: { code: "UNAUTHORIZED", message: "Authentication required" } })),
    );

    window.history.pushState({}, "", "/login");
    render(<App />);

    await screen.findByRole("heading", { name: "Entrar no Anima MMO" });
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText(/Informe email ou usuario/i)).toBeInTheDocument();
    expect(await screen.findByText(/A senha precisa ter ao menos 8 caracteres/i)).toBeInTheDocument();
  });

  it("shows sidebar entries for admin", async () => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/auth/me")) {
        return Promise.resolve(
          jsonResponse(200, {
            user: { id: "u1", username: "trainer", email: "trainer@example.com", role: "ADMIN" },
          }),
        );
      }

      if (url.endsWith("/mapas/ativo")) {
        return Promise.resolve(jsonResponse(200, activeMapPayload));
      }

      if (url.endsWith("/adocoes")) {
        return Promise.resolve(jsonResponse(200, { animas: [] }));
      }

      return Promise.resolve(jsonResponse(404, { error: { code: "NOT_FOUND", message: "not found" } }));
    }));

    window.history.pushState({}, "", "/app");
    render(<App />);

    expect(await screen.findByText("Explorar")).toBeInTheDocument();
    const adminButton = await screen.findByRole("button", { name: /Administracao/i });
    await userEvent.click(adminButton);
    expect(await screen.findByText("Mapas")).toBeInTheDocument();
  });

  it("redirects non-admin away from admin routes", async () => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/auth/me")) {
        return Promise.resolve(
          jsonResponse(200, {
            user: { id: "u1", username: "trainer", email: "trainer@example.com", role: "PLAYER" },
          }),
        );
      }

      if (url.endsWith("/mapas/ativo")) {
        return Promise.resolve(jsonResponse(200, activeMapPayload));
      }

      if (url.endsWith("/adocoes")) {
        return Promise.resolve(jsonResponse(200, { animas: [] }));
      }

      return Promise.resolve(jsonResponse(404, { error: { code: "NOT_FOUND", message: "not found" } }));
    }));

    window.history.pushState({}, "", "/app/admin/mapas");
    render(<App />);

    expect(await screen.findByText(/Exploracao em grid/i)).toBeInTheDocument();
  });
});
