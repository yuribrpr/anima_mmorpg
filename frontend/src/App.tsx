import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/contexts/auth-context";
import { useAuth } from "@/contexts/use-auth";
import { FullPageLoader } from "@/components/common/FullPageLoader";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { AdocaoPage } from "@/pages/Adocao";
import { AdminAnimasPage } from "@/pages/AdminAnimas";
import { AdminBestiarioPage } from "@/pages/AdminBestiario";
import { InventarioPage } from "@/pages/Inventario";
import { LoginPage } from "@/pages/Login";
import { RegisterPage } from "@/pages/Register";

const PublicOnlyRoute = () => {
  const { user, status } = useAuth();

  if (status === "loading") {
    return <FullPageLoader label="Carregando sessão..." />;
  }

  if (user) {
    return <Navigate to="/app/inventario" replace />;
  }

  return <Outlet />;
};

const AppRoutes = () => (
  <Routes>
    <Route element={<PublicOnlyRoute />}>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
    </Route>

    <Route element={<ProtectedLayout />}>
      <Route path="/app" element={<Navigate to="/app/inventario" replace />} />
      <Route path="/app/adocao" element={<AdocaoPage />} />
      <Route path="/app/inventario" element={<InventarioPage />} />
      <Route path="/app/admin/animas" element={<AdminAnimasPage />} />
      <Route path="/app/admin/bestiario" element={<AdminBestiarioPage />} />
    </Route>

    <Route path="*" element={<Navigate to="/app/inventario" replace />} />
  </Routes>
);

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
