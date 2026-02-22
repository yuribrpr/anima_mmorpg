import { User } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { UserRole } from "../../types/auth";

export type UserEntity = User;

export type CreateUserData = {
  username: string;
  email: string;
  passwordHash: string;
  role?: UserRole;
};

export interface UserRepository {
  findByEmail(email: string): Promise<UserEntity | null>;
  findByUsername(username: string): Promise<UserEntity | null>;
  findByEmailOrUsername(value: string): Promise<UserEntity | null>;
  findById(id: string): Promise<UserEntity | null>;
  create(data: CreateUserData): Promise<UserEntity>;
}

export class PrismaUserRepository implements UserRepository {
  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  async findByUsername(username: string) {
    return prisma.user.findUnique({ where: { username } });
  }

  async findByEmailOrUsername(value: string) {
    return prisma.user.findFirst({
      where: {
        OR: [{ email: value }, { username: value }],
      },
    });
  }

  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }

  async create(data: CreateUserData) {
    return prisma.user.create({ data });
  }
}
