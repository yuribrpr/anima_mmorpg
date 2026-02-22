import { Navigate, Outlet } from "react-router-dom";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { FullPageLoader } from "@/components/common/FullPageLoader";
import { useAuth } from "@/contexts/use-auth";

export const ProtectedLayout = () => {
  const { status, user, logout } = useAuth();

  if (status === "loading") {
    return <FullPageLoader label="Carregando area autenticada..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen lg:flex">
      <AppSidebar username={user.username} userRole={user.role} onLogout={logout} />
      <main className="flex-1 p-4 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
};
