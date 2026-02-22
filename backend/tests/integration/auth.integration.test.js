"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = require("../../src/app");
const env_1 = require("../../src/config/env");
const in_memory_user_repository_1 = require("../helpers/in-memory-user-repository");
describe("auth integration", () => {
    const userRepository = new in_memory_user_repository_1.InMemoryUserRepository();
    const app = (0, app_1.createApp)({ userRepository });
    const agent = supertest_1.default.agent(app);
    it("registers user and sets auth cookie", async () => {
        const response = await agent.post("/auth/register").send({
            username: "new_player",
            email: "new@example.com",
            password: "password123",
        });
        expect(response.status).toBe(201);
        expect(response.body.user.username).toBe("new_player");
        const setCookie = response.headers["set-cookie"]?.join(";") ?? "";
        expect(setCookie).toContain((0, env_1.getEnv)().COOKIE_NAME);
    });
    it("logs in with valid credentials", async () => {
        await agent.post("/auth/register").send({
            username: "login_player",
            email: "login@example.com",
            password: "password123",
        });
        const response = await agent.post("/auth/login").send({
            emailOrUsername: "login@example.com",
            password: "password123",
        });
        expect(response.status).toBe(200);
        expect(response.body.user.email).toBe("login@example.com");
    });
    it("returns 401 for invalid credentials", async () => {
        const response = await (0, supertest_1.default)(app).post("/auth/login").send({
            emailOrUsername: "unknown_user",
            password: "password123",
        });
        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
    });
    it("returns authenticated user on /auth/me", async () => {
        const authAgent = supertest_1.default.agent(app);
        await authAgent.post("/auth/register").send({
            username: "me_player",
            email: "me@example.com",
            password: "password123",
        });
        const response = await authAgent.get("/auth/me");
        expect(response.status).toBe(200);
        expect(response.body.user.username).toBe("me_player");
    });
    it("returns 401 on /auth/me without cookie", async () => {
        const response = await (0, supertest_1.default)(app).get("/auth/me");
        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
    it("clears cookie on logout", async () => {
        const authAgent = supertest_1.default.agent(app);
        await authAgent.post("/auth/register").send({
            username: "logout_player",
            email: "logout@example.com",
            password: "password123",
        });
        const response = await authAgent.post("/auth/logout");
        expect(response.status).toBe(204);
        const setCookie = response.headers["set-cookie"]?.join(";") ?? "";
        expect(setCookie).toContain(`${(0, env_1.getEnv)().COOKIE_NAME}=`);
    });
});
