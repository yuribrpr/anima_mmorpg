import { hashPassword, verifyPassword } from "../../src/lib/password";

describe("password helpers", () => {
  it("hashes and verifies correctly", async () => {
    const password = "password123";
    const hash = await hashPassword(password);

    expect(hash).not.toBe(password);
    await expect(verifyPassword(password, hash)).resolves.toBe(true);
    await expect(verifyPassword("wrongpass", hash)).resolves.toBe(false);
  });
});
