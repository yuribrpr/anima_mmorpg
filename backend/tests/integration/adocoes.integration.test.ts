import request from "supertest";
import { hashPassword } from "../../src/lib/password";
import { createApp } from "../../src/app";
import { InMemoryAnimaRepository } from "../helpers/in-memory-anima-repository.ts";
import { InMemoryAdoptionRepository } from "../helpers/in-memory-adoption-repository.ts";
import { InMemoryBestiaryAnimaRepository } from "../helpers/in-memory-bestiary-anima-repository.ts";
import { InMemoryMapRepository } from "../helpers/in-memory-map-repository.ts";
import { InMemoryUserRepository } from "../helpers/in-memory-user-repository.ts";

describe("adocoes integration", () => {
  const userRepository = new InMemoryUserRepository();
  const animaRepository = new InMemoryAnimaRepository();
  const bestiaryAnimaRepository = new InMemoryBestiaryAnimaRepository();
  const adoptionRepository = new InMemoryAdoptionRepository(animaRepository);
  const mapRepository = new InMemoryMapRepository();
  const app = createApp({ userRepository, animaRepository, bestiaryAnimaRepository, adoptionRepository, mapRepository });

  const registerPlayerAgent = async () => {
    const authAgent = request.agent(app);
    const suffix = `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;

    const registerResponse = await authAgent.post("/auth/register").send({
      username: `a_${suffix}`.slice(0, 24),
      email: `adocoes_${suffix}@example.com`,
      password: "password123",
    });
    expect(registerResponse.status).toBe(201);

    return authAgent;
  };

  const loginAdminAgent = async () => {
    const suffix = `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
    const email = `admin_adocoes_${suffix}@example.com`;
    const username = `admin_${suffix}`.slice(0, 24);

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

  const createAnima = async (
    adminAgent: ReturnType<typeof request.agent>,
    input: {
      name: string;
      powerLevel: "ROOKIE" | "CHAMPION";
    },
  ) => {
    const response = await adminAgent.post("/animas").send({
      name: input.name,
      attack: 80,
      attackSpeedSeconds: 1.2,
      critChance: 6,
      agility: 75,
      defense: 70,
      maxHp: 700,
      imageData: null,
      powerLevel: input.powerLevel,
      nextEvolutionId: null,
    });

    expect(response.status).toBe(201);
    return response.body.anima.id as string;
  };

  it("returns 401 when accessing adoptions without auth", async () => {
    const response = await request(app).get("/adocoes/candidatos");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("lists only rookie animas as adoption candidates", async () => {
    const playerAgent = await registerPlayerAgent();
    const adminAgent = await loginAdminAgent();

    const rookieId = await createAnima(adminAgent, { name: "Cubby", powerLevel: "ROOKIE" });
    await createAnima(adminAgent, { name: "Bladeon", powerLevel: "CHAMPION" });

    const response = await playerAgent.get("/adocoes/candidatos");

    expect(response.status).toBe(200);
    const ids = response.body.animas.map((item: { id: string }) => item.id);
    expect(ids).toContain(rookieId);
    expect(response.body.animas.every((item: { powerLevel: string }) => item.powerLevel === "ROOKIE")).toBe(true);
  });

  it("adopts and lists user inventory with derived totals", async () => {
    const playerAgent = await registerPlayerAgent();
    const adminAgent = await loginAdminAgent();
    const rookieId = await createAnima(adminAgent, { name: "Piko", powerLevel: "ROOKIE" });

    const adoptResponse = await playerAgent.post("/adocoes").send({
      animaId: rookieId,
      nickname: "Piko Guardiao",
    });

    expect(adoptResponse.status).toBe(201);
    expect(adoptResponse.body.anima.nickname).toBe("Piko Guardiao");
    expect(adoptResponse.body.anima.level).toBe(1);
    expect(adoptResponse.body.anima.experienceMax).toBe(1000);
    expect(adoptResponse.body.anima.totalAttack).toBeGreaterThan(adoptResponse.body.anima.baseAnima.attack);
    expect(adoptResponse.body.anima.totalDefense).toBeGreaterThan(adoptResponse.body.anima.baseAnima.defense);
    expect(adoptResponse.body.anima.totalMaxHp).toBeGreaterThan(adoptResponse.body.anima.baseAnima.maxHp);
    expect(adoptResponse.body.anima.isPrimary).toBe(true);

    const inventoryResponse = await playerAgent.get("/adocoes");
    expect(inventoryResponse.status).toBe(200);
    expect(inventoryResponse.body.animas.length).toBe(1);
    expect(inventoryResponse.body.animas[0].nickname).toBe("Piko Guardiao");
  });

  it("sets one adopted anima as primary", async () => {
    const playerAgent = await registerPlayerAgent();
    const adminAgent = await loginAdminAgent();
    const rookieA = await createAnima(adminAgent, { name: "Rook A", powerLevel: "ROOKIE" });
    const rookieB = await createAnima(adminAgent, { name: "Rook B", powerLevel: "ROOKIE" });

    const firstAdoption = await playerAgent.post("/adocoes").send({
      animaId: rookieA,
      nickname: "Primeiro",
    });
    const secondAdoption = await playerAgent.post("/adocoes").send({
      animaId: rookieB,
      nickname: "Segundo",
    });

    const firstId = firstAdoption.body.anima.id as string;
    const secondId = secondAdoption.body.anima.id as string;

    const setPrimaryResponse = await playerAgent.patch(`/adocoes/${secondId}/principal`).send();
    expect(setPrimaryResponse.status).toBe(200);
    expect(setPrimaryResponse.body.anima.id).toBe(secondId);
    expect(setPrimaryResponse.body.anima.isPrimary).toBe(true);

    const inventoryResponse = await playerAgent.get("/adocoes");
    expect(inventoryResponse.status).toBe(200);

    const first = inventoryResponse.body.animas.find((item: { id: string }) => item.id === firstId);
    const second = inventoryResponse.body.animas.find((item: { id: string }) => item.id === secondId);
    expect(first?.isPrimary).toBe(false);
    expect(second?.isPrimary).toBe(true);
  });
});
