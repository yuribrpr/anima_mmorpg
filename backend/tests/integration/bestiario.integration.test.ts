import request from "supertest";
import { createApp } from "../../src/app";
import { InMemoryAnimaRepository } from "../helpers/in-memory-anima-repository.ts";
import { InMemoryBestiaryAnimaRepository } from "../helpers/in-memory-bestiary-anima-repository.ts";
import { InMemoryUserRepository } from "../helpers/in-memory-user-repository.ts";

describe("bestiario integration", () => {
  const userRepository = new InMemoryUserRepository();
  const animaRepository = new InMemoryAnimaRepository();
  const bestiaryAnimaRepository = new InMemoryBestiaryAnimaRepository();
  const app = createApp({ userRepository, animaRepository, bestiaryAnimaRepository });

  const registerAndAuth = async () => {
    const authAgent = request.agent(app);
    const suffix = `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;

    const registerResponse = await authAgent.post("/auth/register").send({
      username: `b_${suffix}`.slice(0, 24),
      email: `admin_bestiary_${suffix}@example.com`,
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

  it("creates and lists bestiary animas with bits/xp drops", async () => {
    const authAgent = await registerAndAuth();

    const createResponse = await authAgent.post("/bestiario").send({
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

    const listResponse = await authAgent.get("/bestiario");

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.animas.length).toBeGreaterThan(0);
    expect(listResponse.body.animas[0].name).toBe("Ferox");
  });

  it("updates an existing bestiary anima", async () => {
    const authAgent = await registerAndAuth();

    const createResponse = await authAgent.post("/bestiario").send({
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

    const updateResponse = await authAgent.put(`/bestiario/${animaId}`).send({
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
