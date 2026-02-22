import { createContext } from "react";
import type { AuthContextValue } from "./auth-context";

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
