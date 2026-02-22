import "express";
import { UserRole } from "./auth";

declare module "express-serve-static-core" {
  interface Request {
    authUserId?: string;
    authUserRole?: UserRole;
  }
}
