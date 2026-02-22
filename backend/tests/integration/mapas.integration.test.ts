import request from "supertest";
import { hashPassword } from "../../src/lib/password";
import { createApp } from "../../src/app";
import { InMemoryAdoptionRepository } from "../helpers/in-memory-adoption-repository.ts";
import { InMemoryAnimaRepository } from "../helpers/in-memory-anima-repository.ts";
import { InMemoryBestiaryAnimaRepository } from "../helpers/in-memory-bestiary-anima-repository.ts";
import { InMemoryMapRepository } from "../helpers/in-memory-map-repository.ts";
import { InMemoryUserRepository } from "../helpers/in-memory-user-repository.ts";

describe("mapas integration", () => {
  const userRepository = new InMemoryUserRepository();
  const animaRepository = new InMemoryAnimaRepository();
  const bestiaryAnimaRepository = new InMemoryBestiaryAnimaRepository();
  const adoptionRepository = new InMemoryAdoptionRepository(animaRepository);
  const mapRepository = new InMemoryMapRepository();
  const app = createApp({
    userRepository,
    animaRepository,
    bestiaryAnimaRepository,
    adoptionRepository,
    mapRepository,
  });

  const registerPlayerAgent = async () => {
    const suffix = `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
    const agent = request.agent(app);
    const response = await agent.post("/auth/register").send({
      username: `p_${suffix}`.slice(0, 24),
      email: `player_${suffix}@example.com`,
      password: "password123",
    });

    expect(response.status).toBe(201);
    return agent;
  };

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

    const agent = request.agent(app);
    const response = await agent.post("/auth/login").send({
      emailOrUsername: email,
      password: "password123",
    });

    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe("ADMIN");
    return agent;
  };

  it("returns 401 for active map without authentication", async () => {
    const response = await request(app).get("/mapas/ativo");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns active map and creates initial player state when missing", async () => {
    const agent = await registerPlayerAgent();
    const response = await agent.get("/mapas/ativo");

    expect(response.status).toBe(200);
    expect(response.body.map.isActive).toBe(true);
    expect(response.body.map.cols).toBe(60);
    expect(response.body.map.rows).toBe(34);
    expect(response.body.state.scaleX).toBe(3);
    expect(response.body.state.scaleY).toBe(3);
  });

  it("updates active map state and persists coordinates", async () => {
    const agent = await registerPlayerAgent();
    const updateResponse = await agent.patch("/mapas/ativo/estado").send({
      tileX: 4,
      tileY: 9,
      scaleX: 2.5,
      scaleY: 4,
    });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.state.tileX).toBe(4);
    expect(updateResponse.body.state.tileY).toBe(9);
    expect(updateResponse.body.state.scaleX).toBe(2.5);
    expect(updateResponse.body.state.scaleY).toBe(4);

    const activeResponse = await agent.get("/mapas/ativo");
    expect(activeResponse.status).toBe(200);
    expect(activeResponse.body.state.tileX).toBe(4);
    expect(activeResponse.body.state.tileY).toBe(9);
  });

  it("returns 403 for non-admin requests to map admin endpoints", async () => {
    const agent = await registerPlayerAgent();
    const response = await agent.get("/mapas");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("activates maps uniquely", async () => {
    const adminAgent = await loginAdminAgent();

    const first = await adminAgent.post("/mapas").send({ name: "Mapa A" });
    const second = await adminAgent.post("/mapas").send({ name: "Mapa B" });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const firstId = first.body.map.id as string;
    const secondId = second.body.map.id as string;

    const activateA = await adminAgent.patch(`/mapas/${firstId}/ativar`).send();
    expect(activateA.status).toBe(200);
    expect(activateA.body.map.isActive).toBe(true);

    const activateB = await adminAgent.patch(`/mapas/${secondId}/ativar`).send();
    expect(activateB.status).toBe(200);
    expect(activateB.body.map.isActive).toBe(true);

    const list = await adminAgent.get("/mapas");
    expect(list.status).toBe(200);
    const activeMaps = list.body.maps.filter((map: { isActive: boolean }) => map.isActive);
    expect(activeMaps.length).toBe(1);
    expect(activeMaps[0].id).toBe(secondId);
  });

  it("validates map layout payload", async () => {
    const adminAgent = await loginAdminAgent();
    const createResponse = await adminAgent.post("/mapas").send({ name: "Mapa C" });
    const mapId = createResponse.body.map.id as string;

    const invalidLayoutResponse = await adminAgent.patch(`/mapas/${mapId}/layout`).send({
      tileLayer: [],
      collisionLayer: [],
      spawnX: 0,
      spawnY: 0,
      backgroundScale: 1,
    });

    expect(invalidLayoutResponse.status).toBe(400);
    expect(invalidLayoutResponse.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("teleports player through a portal and keeps destination map as current", async () => {
    const agent = await registerPlayerAgent();
    const adminAgent = await loginAdminAgent();

    const activeResponse = await agent.get("/mapas/ativo");
    expect(activeResponse.status).toBe(200);
    const sourceMapId = activeResponse.body.map.id as string;
    const playerTileX = activeResponse.body.state.tileX as number;
    const playerTileY = activeResponse.body.state.tileY as number;

    const sourceMapResponse = await adminAgent.get(`/mapas/${sourceMapId}`);
    expect(sourceMapResponse.status).toBe(200);

    const targetCreate = await adminAgent.post("/mapas").send({ name: "Mapa Portal Destino" });
    expect(targetCreate.status).toBe(201);
    const targetMapId = targetCreate.body.map.id as string;

    const area = Array.from({ length: 34 }, () => Array.from({ length: 60 }, () => false));
    area[playerTileY][playerTileX] = true;
    const sourceMap = sourceMapResponse.body.map;
    const updateSourceLayout = await adminAgent.patch(`/mapas/${sourceMapId}/layout`).send({
      tileLayer: sourceMap.tileLayer,
      collisionLayer: sourceMap.collisionLayer,
      enemySpawns: sourceMap.enemySpawns,
      portals: [
        {
          id: "portal_test",
          targetMapId,
          targetMapName: "Mapa Portal Destino",
          targetSpawnX: 5,
          targetSpawnY: 6,
          area,
        },
      ],
      spawnX: sourceMap.spawnX,
      spawnY: sourceMap.spawnY,
      backgroundScale: sourceMap.backgroundScale,
    });
    expect(updateSourceLayout.status).toBe(200);

    const teleportResponse = await agent.post("/mapas/teleportar").send({ portalId: "portal_test" });
    expect(teleportResponse.status).toBe(200);
    expect(teleportResponse.body.map.id).toBe(targetMapId);
    expect(teleportResponse.body.state.mapId).toBe(targetMapId);
    expect(teleportResponse.body.state.tileX).toBe(5);
    expect(teleportResponse.body.state.tileY).toBe(6);

    const afterTeleport = await agent.get("/mapas/ativo");
    expect(afterTeleport.status).toBe(200);
    expect(afterTeleport.body.map.id).toBe(targetMapId);
    expect(afterTeleport.body.state.mapId).toBe(targetMapId);
  });
});
