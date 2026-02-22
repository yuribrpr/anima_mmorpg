import request from "supertest";
import { hashPassword } from "../../src/lib/password";
import { createApp } from "../../src/app";
import { InMemoryAnimaRepository } from "../helpers/in-memory-anima-repository.ts";
import { InMemoryBestiaryAnimaRepository } from "../helpers/in-memory-bestiary-anima-repository.ts";
import { InMemoryMapRepository } from "../helpers/in-memory-map-repository.ts";
import { InMemoryUserRepository } from "../helpers/in-memory-user-repository.ts";

describe("bestiario integration", () => {
  const userRepository = new InMemoryUserRepository();
  const animaRepository = new InMemoryAnimaRepository();
  const bestiaryAnimaRepository = new InMemoryBestiaryAnimaRepository();
  const mapRepository = new InMemoryMapRepository();
  const app = createApp({ userRepository, animaRepository, bestiaryAnimaRepository, mapRepository });

  const loginAdminAgent = async () => {
    const suffix = `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
    const email = `admin_bestiary_${suffix}@example.com`;
    const username = `b_${suffix}`.slice(0, 24);

    await userRepository.create({
      username,
      email,
      passwordHash: await hashPassword("password123"),
      role: "ADMIN",
    });

    const authAgent = request.agent(app);
    const loginResponse = await authAgent.post("/auth/login").send({
      emailOrUsername: email,
      password: "password123",
    });
    expect(loginResponse.status).toBe(200);
    return authAgent;
  };

  const registerPlayerAgent = async () => {
    const suffix = `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
    const authAgent = request.agent(app);
    const registerResponse = await authAgent.post("/auth/register").send({
      username: `player_b_${suffix}`.slice(0, 24),
      email: `player_b_${suffix}@example.com`,
      password: "password123",
    });
    expect(registerResponse.status).toBe(201);
    return authAgent;
  };

  it("returns 401 when listing without auth", async () => {
    const response = await request(app).get("/bestiario");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 403 when non-admin requests bestiary endpoints", async () => {
    const playerAgent = await registerPlayerAgent();
    const response = await playerAgent.get("/bestiario");
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("creates and lists bestiary animas with bits/xp drops as admin", async () => {
    const adminAgent = await loginAdminAgent();

    const createResponse = await adminAgent.post("/bestiario").send({
      name: "Ferox",
      attack: 140,
      attackSpeedSeconds: 1.6,
      critChance: 10,
      agility: 85,
      defense: 100,
      maxHp: 1300,
      imageData: null,
      powerLevel: "ULTIMATE",
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.anima.name).toBe("Ferox");
    expect(createResponse.body.anima.bitsDrop).toBe(Math.round((140 + 100) * 0.1));
    expect(createResponse.body.anima.xpDrop).toBe(Math.round((140 + 100) * 0.15));

    const listResponse = await adminAgent.get("/bestiario");

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.animas.length).toBeGreaterThan(0);
    expect(listResponse.body.animas[0].name).toBe("Ferox");
  });

  it("updates an existing bestiary anima as admin", async () => {
    const adminAgent = await loginAdminAgent();

    const createResponse = await adminAgent.post("/bestiario").send({
      name: "Grimclaw",
      attack: 110,
      attackSpeedSeconds: 1.5,
      critChance: 9,
      agility: 80,
      defense: 95,
      maxHp: 1200,
      imageData: null,
      powerLevel: "CHAMPION",
    });

    const animaId = createResponse.body.anima.id as string;

    const updateResponse = await adminAgent.put(`/bestiario/${animaId}`).send({
      name: "Grimclaw Prime",
      attack: 170,
      attackSpeedSeconds: 1.2,
      critChance: 14,
      agility: 102,
      defense: 138,
      maxHp: 1850,
      imageData: null,
      powerLevel: "MEGA",
    });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.anima.name).toBe("Grimclaw Prime");
    expect(updateResponse.body.anima.attack).toBe(170);
    expect(updateResponse.body.anima.bitsDrop).toBe(Math.round((170 + 138) * 0.1));
    expect(updateResponse.body.anima.xpDrop).toBe(Math.round((170 + 138) * 0.15));
    expect(updateResponse.body.anima.powerLevel).toBe("MEGA");
  });
});
