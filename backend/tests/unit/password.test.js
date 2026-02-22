"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const password_1 = require("../../src/lib/password");
describe("password helpers", () => {
    it("hashes and verifies correctly", async () => {
        const password = "password123";
        const hash = await (0, password_1.hashPassword)(password);
        expect(hash).not.toBe(password);
        await expect((0, password_1.verifyPassword)(password, hash)).resolves.toBe(true);
        await expect((0, password_1.verifyPassword)("wrongpass", hash)).resolves.toBe(false);
    });
});
