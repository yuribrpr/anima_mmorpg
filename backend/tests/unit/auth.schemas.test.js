"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const auth_schemas_1 = require("../../src/modules/auth/auth.schemas");
describe("auth schemas", () => {
    it("accepts valid register payload", () => {
        const parsed = auth_schemas_1.registerSchema.parse({
            username: "anima_player",
            email: "test@example.com",
            password: "password123",
        });
        expect(parsed.email).toBe("test@example.com");
    });
    it("rejects short password in register", () => {
        expect(() => auth_schemas_1.registerSchema.parse({
            username: "player",
            email: "test@example.com",
            password: "123",
        })).toThrow();
    });
    it("accepts valid login payload", () => {
        const parsed = auth_schemas_1.loginSchema.parse({
            emailOrUsername: "player",
            password: "password123",
        });
        expect(parsed.emailOrUsername).toBe("player");
    });
});
