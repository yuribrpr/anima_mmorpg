import request from "supertest";
import { createApp } from "../../src/app";
import { InMemoryAnimaRepository } from "../helpers/in-memory-anima-repository.ts";
import { InMemoryBestiaryAnimaRepository } from "../helpers/in-memory-bestiary-anima-repository.ts";
import { InMemoryUserRepository } from "../helpers/in-memory-user-repository.ts";

describe("animas integration", () => {
  const userRepository = new InMemoryUserRepository();
  const animaRepository = new InMemoryAnimaRepository();
  const bestiaryAnimaRepository = new InMemoryBestiaryAnimaRepository();
  const app = createApp({ userRepository, animaRepository, bestiaryAnimaRepository });

  const registerAndAuth = async () => {
    const authAgent = request.agent(app);

    await authAgent.post("/auth/register").send({
      username: `admin_${Date.now()}`,
      email: `admin_${Date.now()}@example.com`,
      password: "password123",
    });

    return authAgent;
  };

  it("returns 401 when listing animas without auth", async () => {
    const response = await request(app).get("/animas");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("creates and lists animas", async () => {
    const authAgent = await registerAndAuth();

    const createResponse = await authAgent.post("/animas").send({
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

    const listResponse = await authAgent.get("/animas");

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.animas.length).toBeGreaterThan(0);
    expect(listResponse.body.animas[0].name).toBe("Drakoid");
  });

  it("updates an existing anima", async () => {
    const authAgent = await registerAndAuth();

    const createResponse = await authAgent.post("/animas").send({
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

    const updateResponse = await authAgent.put(`/animas/${animaId}`).send({
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

  it("deletes an anima", async () => {
    const authAgent = await registerAndAuth();

    const createResponse = await authAgent.post("/animas").send({
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

    const deleteResponse = await authAgent.delete(`/animas/${animaId}`);
    expect(deleteResponse.status).toBe(204);

    const listResponse = await authAgent.get("/animas");
    const exists = listResponse.body.animas.some((item: { id: string }) => item.id === animaId);
    expect(exists).toBe(false);
  });
});
