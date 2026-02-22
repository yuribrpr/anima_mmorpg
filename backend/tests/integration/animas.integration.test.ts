import request from "supertest";
import { hashPassword } from "../../src/lib/password";
import { createApp } from "../../src/app";
import { InMemoryAnimaRepository } from "../helpers/in-memory-anima-repository.ts";
import { InMemoryBestiaryAnimaRepository } from "../helpers/in-memory-bestiary-anima-repository.ts";
import { InMemoryMapRepository } from "../helpers/in-memory-map-repository.ts";
import { InMemoryUserRepository } from "../helpers/in-memory-user-repository.ts";

describe("animas integration", () => {
  const userRepository = new InMemoryUserRepository();
  const animaRepository = new InMemoryAnimaRepository();
  const bestiaryAnimaRepository = new InMemoryBestiaryAnimaRepository();
  const mapRepository = new InMemoryMapRepository();
  const app = createApp({ userRepository, animaRepository, bestiaryAnimaRepository, mapRepository });

  const loginAdminAgent = async () => {
    const suffix = `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
    const email = `admin_${suffix}@example.com`;
    const username = `admin_${suffix}`.slice(0, 24);

    await userRepository.create({
      username,
      email,
      passwordHash: await hashPassword("password123"),
      role: "ADMIN",
    });

    const authAgent = request.agent(app);
    const response = await authAgent.post("/auth/login").send({
      emailOrUsername: email,
      password: "password123",
    });
    expect(response.status).toBe(200);
    return authAgent;
  };

  const registerPlayerAgent = async () => {
    const authAgent = request.agent(app);
    const suffix = `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;

    await authAgent.post("/auth/register").send({
      username: `player_${suffix}`.slice(0, 24),
      email: `player_${suffix}@example.com`,
      password: "password123",
    });

    return authAgent;
  };

  it("returns 401 when listing animas without auth", async () => {
    const response = await request(app).get("/animas");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 403 when non-admin tries to list animas", async () => {
    const player = await registerPlayerAgent();
    const response = await player.get("/animas");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("creates and lists animas as admin", async () => {
    const admin = await loginAdminAgent();

    const createResponse = await admin.post("/animas").send({
      name: "Drakoid",
      attack: 120,
      attackSpeedSeconds: 1.4,
      critChance: 17,
      agility: 95,
      defense: 88,
      maxHp: 840,
      imageData: "data:image/png;base64,ZmFrZQ==",
      powerLevel: "CHAMPION",
      nextEvolutionId: null,
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.anima.name).toBe("Drakoid");

    const listResponse = await admin.get("/animas");

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.animas.length).toBeGreaterThan(0);
    expect(listResponse.body.animas[0].name).toBe("Drakoid");
  });

  it("updates an existing anima as admin", async () => {
    const admin = await loginAdminAgent();

    const createResponse = await admin.post("/animas").send({
      name: "Hydrake",
      attack: 100,
      attackSpeedSeconds: 1.3,
      critChance: 12,
      agility: 91,
      defense: 95,
      maxHp: 900,
      imageData: null,
      powerLevel: "CHAMPION",
      nextEvolutionId: null,
    });

    const animaId = createResponse.body.anima.id as string;

    const updateResponse = await admin.put(`/animas/${animaId}`).send({
      name: "Hydrake X",
      attack: 120,
      attackSpeedSeconds: 1.15,
      critChance: 18,
      agility: 101,
      defense: 108,
      maxHp: 1040,
      imageData: null,
      powerLevel: "ULTIMATE",
      nextEvolutionId: null,
    });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.anima.name).toBe("Hydrake X");
    expect(updateResponse.body.anima.attack).toBe(120);
    expect(updateResponse.body.anima.powerLevel).toBe("ULTIMATE");
  });

  it("deletes an anima as admin", async () => {
    const admin = await loginAdminAgent();

    const createResponse = await admin.post("/animas").send({
      name: "Voltamon",
      attack: 90,
      attackSpeedSeconds: 1.1,
      critChance: 12,
      agility: 110,
      defense: 76,
      maxHp: 700,
      imageData: null,
      powerLevel: "ROOKIE",
      nextEvolutionId: null,
    });

    const animaId = createResponse.body.anima.id as string;

    const deleteResponse = await admin.delete(`/animas/${animaId}`);
    expect(deleteResponse.status).toBe(204);

    const listResponse = await admin.get("/animas");
    const exists = listResponse.body.animas.some((item: { id: string }) => item.id === animaId);
    expect(exists).toBe(false);
  });
});
