import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { FullPageLoader } from "@/components/common/FullPageLoader";
import { useAuth } from "@/contexts/use-auth";
import { cn } from "@/lib/utils";

export const ProtectedLayout = () => {
  const { status, user, logout } = useAuth();
  const location = useLocation();
  const [focusMode, setFocusMode] = useState(false);
  const effectiveFocusMode = focusMode && location.pathname === "/app/explorar";

  useEffect(() => {
    const onFocusMode = (event: Event) => {
      const customEvent = event as CustomEvent<{ enabled?: boolean }>;
      setFocusMode(Boolean(customEvent.detail?.enabled));
    };

    window.addEventListener("explore:focus-mode", onFocusMode as EventListener);
    return () => window.removeEventListener("explore:focus-mode", onFocusMode as EventListener);
  }, []);

  if (status === "loading") {
    return <FullPageLoader label="Carregando area autenticada..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className={cn("min-h-screen lg:flex", effectiveFocusMode ? "bg-black" : undefined)}>
      {effectiveFocusMode ? null : <AppSidebar username={user.username} userRole={user.role} onLogout={logout} />}
      <main className={cn("flex-1 p-4 lg:p-8", effectiveFocusMode ? "p-0 lg:p-0" : undefined)}>
        <Outlet />
      </main>
    </div>
  );
};
