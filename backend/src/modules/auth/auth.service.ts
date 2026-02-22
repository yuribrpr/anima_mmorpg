import { AppError } from "../../lib/errors";
import { signAuthToken } from "../../lib/jwt";
import { hashPassword, verifyPassword } from "../../lib/password";
import { AuthUser, LoginInput, RegisterInput } from "../../types/auth";
import { UserEntity, UserRepository } from "./auth.repository";

const toAuthUser = (user: UserEntity): AuthUser => ({
  id: user.id,
  username: user.username,
  email: user.email,
  role: user.role,
});

export class AuthService {
  constructor(private readonly userRepository: UserRepository) {}

  async register(input: RegisterInput) {
    const existingEmail = await this.userRepository.findByEmail(input.email);
    if (existingEmail) {
      throw new AppError(409, "EMAIL_ALREADY_EXISTS", "Email already registered");
    }

    const existingUsername = await this.userRepository.findByUsername(input.username);
    if (existingUsername) {
      throw new AppError(409, "USERNAME_ALREADY_EXISTS", "Username already registered");
    }

    const passwordHash = await hashPassword(input.password);
    const user = await this.userRepository.create({
      email: input.email,
      username: input.username,
      passwordHash,
    });

    const token = signAuthToken(user.id, user.role);
    return {
      user: toAuthUser(user),
      token,
    };
  }

  async login(input: LoginInput) {
    const user = await this.userRepository.findByEmailOrUsername(input.emailOrUsername);

    if (!user) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid credentials");
    }

    const isValid = await verifyPassword(input.password, user.passwordHash);
    if (!isValid) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid credentials");
    }

    const token = signAuthToken(user.id, user.role);
    return {
      user: toAuthUser(user),
      token,
    };
  }

  async currentUser(userId: string) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new AppError(401, "UNAUTHORIZED", "Session no longer valid");
    }

    return toAuthUser(user);
  }
}
