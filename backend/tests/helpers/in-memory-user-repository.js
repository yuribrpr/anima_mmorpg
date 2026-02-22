"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryUserRepository = void 0;
class InMemoryUserRepository {
    users = new Map();
    async findByEmail(email) {
        for (const user of this.users.values()) {
            if (user.email === email)
                return user;
        }
        return null;
    }
    async findByUsername(username) {
        for (const user of this.users.values()) {
            if (user.username === username)
                return user;
        }
        return null;
    }
    async findByEmailOrUsername(value) {
        for (const user of this.users.values()) {
            if (user.email === value || user.username === value)
                return user;
        }
        return null;
    }
    async findById(id) {
        return this.users.get(id) ?? null;
    }
    async create(data) {
        const now = new Date();
        const user = {
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
exports.InMemoryUserRepository = InMemoryUserRepository;
