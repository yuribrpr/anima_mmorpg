import type { ComponentType } from "react";
import { useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronRight, Compass, FolderCog, Ghost, LogOut, Package, Shield, SlidersHorizontal, Sparkles, Swords, Users, Map as MapIcon } from "lucide-react";
import type { UserRole } from "@/types/auth";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type SidebarProps = {
  username: string;
  userRole: UserRole;
  onLogout: () => Promise<void>;
};

type NavItem = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  to: string;
};

const mainItems: NavItem[] = [
  { label: "Explorar", icon: Compass, to: "/app/explorar" },
  { label: "Inventario", icon: Shield, to: "/app/inventario" },
  { label: "Adocao", icon: Sparkles, to: "/app/adocao" },
];

const adminWorldItems: NavItem[] = [
  { label: "Mapas", icon: MapIcon, to: "/app/admin/mapas" },
  { label: "Bestiario", icon: Ghost, to: "/app/admin/bestiario" },
  { label: "NPCs", icon: Users, to: "/app/admin/npcs" },
];

const adminDataItems: NavItem[] = [
  { label: "Animas", icon: Sparkles, to: "/app/admin/animas" },
  { label: "Itens", icon: Package, to: "/app/admin/itens" },
  { label: "Variaveis Globais", icon: SlidersHorizontal, to: "/app/admin/variaveis-globais" },
];

const SidebarPanel = ({ username, userRole, onLogout, className }: SidebarProps & { className?: string }) => {
  const location = useLocation();
  const adminOpen = useMemo(() => location.pathname.startsWith("/app/admin"), [location.pathname]);

  return (
    <aside className={cn("flex h-full w-72 flex-col border-r border-border bg-card/70 p-4 backdrop-blur", className)}>
      <div className="mb-4 flex items-center gap-2 px-2">
        <Swords className="h-5 w-5" />
        <div>
          <p className="text-sm text-muted-foreground">Anima MMO</p>
          <p className="text-sm font-semibold">{username}</p>
        </div>
      </div>

      <Separator className="mb-4" />

      <nav className="space-y-1">
        <div className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Jogo</div>
        {mainItems.slice(0, 2).map((item) => {
          const Icon = item.icon;
          return (
            <Button
              key={item.label}
              asChild
              variant="ghost"
              className={cn(
                "w-full justify-start gap-2 text-muted-foreground",
                location.pathname === item.to ? "bg-muted text-foreground" : undefined,
              )}
            >
              <NavLink to={item.to}>
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            </Button>
          );
        })}

        <div className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Colecao</div>
        {mainItems.slice(2).map((item) => {
          const Icon = item.icon;
          return (
            <Button
              key={item.label}
              asChild
              variant="ghost"
              className={cn(
                "w-full justify-start gap-2 text-muted-foreground",
                location.pathname === item.to ? "bg-muted text-foreground" : undefined,
              )}
            >
              <NavLink to={item.to}>
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            </Button>
          );
        })}

        {userRole === "ADMIN" ? (
          <Collapsible defaultOpen={adminOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="group w-full justify-start gap-2 text-muted-foreground">
                <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
                <FolderCog className="h-4 w-4" />
                Administracao
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="ml-6 mt-1 space-y-1">
              <div className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Mundo</div>
              {adminWorldItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.label}
                    asChild
                    variant="ghost"
                    className={cn(
                      "w-full justify-start text-muted-foreground",
                      location.pathname === item.to ? "bg-muted text-foreground" : undefined,
                    )}
                  >
                    <NavLink to={item.to} className="inline-flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5" />
                      {item.label}
                    </NavLink>
                  </Button>
                );
              })}

              <div className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Dados</div>
              {adminDataItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.label}
                    asChild
                    variant="ghost"
                    className={cn(
                      "w-full justify-start text-muted-foreground",
                      location.pathname === item.to ? "bg-muted text-foreground" : undefined,
                    )}
                  >
                    <NavLink to={item.to} className="inline-flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5" />
                      {item.label}
                    </NavLink>
                  </Button>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </nav>

      <div className="mt-auto pt-4">
        <Button variant="outline" className="w-full justify-start gap-2" onClick={() => void onLogout()}>
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </aside>
  );
};

export const AppSidebar = ({ username, userRole, onLogout }: SidebarProps) => {
  return (
    <>
      <div className="hidden lg:block">
        <SidebarPanel username={username} userRole={userRole} onLogout={onLogout} className="min-h-screen" />
      </div>

      <div className="border-b border-border p-4 lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              Menu
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Navegacao</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              <SidebarPanel username={username} userRole={userRole} onLogout={onLogout} className="w-full border-none p-0" />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
};
