import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "@/App";

const jsonResponse = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

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

  it("redirects authenticated users from /login to /app", async () => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/auth/me")) {
        return Promise.resolve(
          jsonResponse(200, {
            user: { id: "u1", username: "trainer", email: "trainer@example.com" },
          }),
        );
      }

      if (url.endsWith("/adocoes")) {
        return Promise.resolve(jsonResponse(200, { animas: [] }));
      }

      return Promise.resolve(jsonResponse(404, { error: { code: "NOT_FOUND", message: "not found" } }));
    }));

    window.history.pushState({}, "", "/login");
    render(<App />);

    expect(await screen.findByText(/Seus Animas adotados/i)).toBeInTheDocument();
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

  it("shows functional sidebar entries on authenticated area", async () => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/auth/me")) {
        return Promise.resolve(
          jsonResponse(200, {
            user: { id: "u1", username: "trainer", email: "trainer@example.com" },
          }),
        );
      }

      if (url.endsWith("/adocoes")) {
        return Promise.resolve(jsonResponse(200, { animas: [] }));
      }

      return Promise.resolve(jsonResponse(404, { error: { code: "NOT_FOUND", message: "not found" } }));
    }));

    window.history.pushState({}, "", "/app");
    render(<App />);

    expect(await screen.findByText("Adocao")).toBeInTheDocument();
    expect(await screen.findByText("Inventario")).toBeInTheDocument();
    expect(await screen.findByText("Administracao")).toBeInTheDocument();
  });
});
