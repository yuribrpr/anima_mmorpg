import { loginSchema, registerSchema } from "../../src/modules/auth/auth.schemas";

describe("auth schemas", () => {
  it("accepts valid register payload", () => {
    const parsed = registerSchema.parse({
      username: "anima_player",
      email: "test@example.com",
      password: "password123",
    });

    expect(parsed.email).toBe("test@example.com");
  });

  it("rejects short password in register", () => {
    expect(() =>
      registerSchema.parse({
        username: "player",
        email: "test@example.com",
        password: "123",
      }),
    ).toThrow();
  });

  it("accepts valid login payload", () => {
    const parsed = loginSchema.parse({
      emailOrUsername: "player",
      password: "password123",
    });

    expect(parsed.emailOrUsername).toBe("player");
  });
});
