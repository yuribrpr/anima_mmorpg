import { UserEntity, UserRepository } from "../../src/modules/auth/auth.repository";

type CreateData = {
  username: string;
  email: string;
  passwordHash: string;
};

export class InMemoryUserRepository implements UserRepository {
  private users = new Map<string, UserEntity>();

  async findByEmail(email: string) {
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }

    return null;
  }

  async findByUsername(username: string) {
    for (const user of this.users.values()) {
      if (user.username === username) return user;
    }

    return null;
  }

  async findByEmailOrUsername(value: string) {
    for (const user of this.users.values()) {
      if (user.email === value || user.username === value) return user;
    }

    return null;
  }

  async findById(id: string) {
    return this.users.get(id) ?? null;
  }

  async create(data: CreateData) {
    const now = new Date();
    const user: UserEntity = {
      id: `user_${this.users.size + 1}`,
      email: data.email,
      username: data.username,
      passwordHash: data.passwordHash,
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(user.id, user);
    return user;
  }
}
