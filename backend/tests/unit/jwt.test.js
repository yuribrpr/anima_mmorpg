"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jwt_1 = require("../../src/lib/jwt");
describe("jwt helpers", () => {
    it("signs and verifies auth token", () => {
        const token = (0, jwt_1.signAuthToken)("user_1", "ADMIN");
        const payload = (0, jwt_1.verifyAuthToken)(token);
        expect(payload.sub).toBe("user_1");
        expect(payload.role).toBe("ADMIN");
    });
});
