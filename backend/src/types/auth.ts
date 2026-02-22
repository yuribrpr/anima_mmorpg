export type UserRole = "PLAYER" | "ADMIN";

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  role: UserRole;
};

export type RegisterInput = {
  username: string;
  email: string;
  password: string;
};

export type LoginInput = {
  emailOrUsername: string;
  password: string;
};
