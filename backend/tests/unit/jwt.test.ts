import { signAuthToken, verifyAuthToken } from "../../src/lib/jwt";

describe("jwt helpers", () => {
  it("signs and verifies auth token", () => {
    const token = signAuthToken("user_1", "ADMIN");
    const payload = verifyAuthToken(token);

    expect(payload.sub).toBe("user_1");
    expect(payload.role).toBe("ADMIN");
  });
});
