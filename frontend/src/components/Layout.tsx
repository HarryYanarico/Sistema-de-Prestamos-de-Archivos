import { ReactNode, useState, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpenCheck,
  Users,
  LayoutDashboard,
  Settings,
  Search,
  FileText,
  MapPin,
  UserCircle,
  LogOut,
  ArrowLeftRight,
  Calendar,
  Ban,
  Archive,
  Sun,
  Moon,
  Home,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Undo2,
  AlertTriangle,
  BarChart3,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { usePermission } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import NotificationBell from "./NotificationBell";

interface LayoutProps {
  children: ReactNode;
}

interface NavItem {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  to?: string;
  children?: NavItem[];
}

interface NavSection {
  label: string;
  items: NavItem[];
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const { isAdmin, hasPerm } = usePermission();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [headerSearch, setHeaderSearch] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(
    new Set(["Préstamos"]),
  );
  const primaryRole = user?.groups[0]?.name ?? "Sin rol";

  const canGestionarBloqueos = hasPerm("gestionar_bloqueos");
  const canGestionarCarpetas = hasPerm("gestionar_carpetas");
  const canGestionarPrestamos = hasPerm("gestionar_prestamos");
  const canGestionarDevoluciones = hasPerm("gestionar_devoluciones");
  const canGestionarUbicaciones = hasPerm("gestionar_ubicaciones");
  const canGestionarTraspasos = hasPerm("gestionar_traspasos");
  const canGestionarProrrogas = hasPerm("gestionar_prorrogas");
  const canGestionarRetiros = hasPerm("gestionar_retiros");

  const toggleMenu = (label: string) => {
    setExpandedMenus((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const pageTitle = useMemo(() => {
    const map: Record<string, string> = {
      "/": "Inicio",
      "/dashboard": "Dashboard",
      "/carpetas": "Carpetas",
      "/incidentes": "Incidentes",
      "/prestamos": "Préstamos",
      "/prestamos/documentos": "Préstamos de Documentos",
      "/devoluciones": "Devoluciones",
      "/ubicaciones": "Ubicaciones",
      "/traspasos": "Traspasos",
      "/prorrogas": "Prórrogas",
      "/retiros": "Retiro",
      "/reportes": "Reportes",
      "/usuarios": "Usuarios",
      "/personas": "Personas",
      "/bloqueos": "Bloqueos",
      "/perfil": "Perfil",
    };
    return map[location.pathname] ?? "Inicio";
  }, [location.pathname]);

  const navSections = useMemo<NavSection[]>(() => {
    const sections: NavSection[] = [];

    const mainItems: NavItem[] = [{ icon: Home, label: "Inicio", to: "/" }];

    if (isAdmin || hasPerm("ver_dashboard")) {
      mainItems.push({
        icon: LayoutDashboard,
        label: "Dashboard",
        to: "/dashboard",
      });
    }

    if (mainItems.length > 0) {
      sections.push({ label: "Principal", items: mainItems });
    }

    const gestionItems: NavItem[] = [];

    if (canGestionarCarpetas) {
      gestionItems.push({ icon: FileText, label: "Carpetas", to: "/carpetas" });
    }

    if (canGestionarCarpetas) {
      gestionItems.push({
        icon: AlertTriangle,
        label: "Incidentes",
        to: "/incidentes",
      });
    }

    if (canGestionarPrestamos || canGestionarDevoluciones) {
      gestionItems.push({
        icon: BookOpenCheck,
        label: "Préstamos",
        children: [
          { icon: BookOpenCheck, label: "Carpetas", to: "/prestamos" },
          { icon: FileText, label: "Documentos", to: "/prestamos/documentos" },
        ],
      });
    }

    if (canGestionarDevoluciones || canGestionarPrestamos) {
      gestionItems.push({
        icon: Undo2,
        label: "Devoluciones",
        to: "/devoluciones",
      });
    }

    if (canGestionarUbicaciones) {
      gestionItems.push({
        icon: MapPin,
        label: "Ubicaciones",
        to: "/ubicaciones",
      });
    }

    if (canGestionarTraspasos) {
      gestionItems.push({
        icon: ArrowLeftRight,
        label: "Traspasos",
        to: "/traspasos",
      });
    }

    if (canGestionarProrrogas) {
      gestionItems.push({
        icon: Calendar,
        label: "Prórrogas",
        to: "/prorrogas",
      });
    }

    if (canGestionarRetiros) {
      gestionItems.push({ icon: Archive, label: "Retiro", to: "/retiros" });
    }

    gestionItems.push({ icon: BarChart3, label: "Reportes", to: "/reportes" });

    if (gestionItems.length > 0) {
      sections.push({ label: "Gestión", items: gestionItems });
    }

    const adminItems: NavItem[] = [];
    if (isAdmin) {
      adminItems.push({ icon: Users, label: "Usuarios", to: "/usuarios" });
      adminItems.push({ icon: UserCircle, label: "Personas", to: "/personas" });
    }
    if (canGestionarBloqueos) {
      adminItems.push({ icon: Ban, label: "Bloqueos", to: "/bloqueos" });
    }
    if (adminItems.length > 0) {
      sections.push({ label: "Administración", items: adminItems });
    }

    return sections;
  }, [
    canGestionarBloqueos,
    canGestionarCarpetas,
    canGestionarPrestamos,
    canGestionarDevoluciones,
    canGestionarUbicaciones,
    canGestionarTraspasos,
    canGestionarProrrogas,
    isAdmin,
  ]);

  return (
    <div className="h-screen bg-gradient-to-br from-white via-red-50 to-blue-100 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950 flex overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand-300/30 dark:bg-brand-dark-400/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-brand-500/20 dark:bg-brand-dark-500/10 blur-[120px] pointer-events-none" />

      <aside
        className={`${sidebarCollapsed ? "w-20" : "w-64"} m-4 mr-0 rounded-2xl glass-panel flex flex-col z-10 hidden md:flex transition-all duration-300`}>
        <div
          className={`p-4 flex justify-center items-center gap-2 ${sidebarCollapsed ? "justify-center" : ""}`}>
          {sidebarCollapsed ? (
            <img src="/logo.jfif" alt="Logo" className="w-10 h-10 rounded-full object-cover mx-auto shrink-0" />
          ) : (
            <div className="flex flex-col items-center w-full">
              <div className="flex items-center w-full justify-center">
                <img src="/logo.jfif" alt="Logo" className="w-12 h-12 rounded-full object-cover shrink-0" />
                <div className="w-px mx-2 h-12 bg-gray-400 dark:bg-gray-500 shrink-0"></div>
                <div className="font-serif leading-none">
                  <div className="flex items-end">
                    <span className="text-4xl text-blue-800 dark:text-blue-300 leading-none">
                      U
                    </span>
                    <div className="flex flex-col ml-0.5">
                      <div className="flex text-lg font-bold leading-none">
                        <span className="text-blue-800 dark:text-blue-300">
                          A
                        </span>
                        <span className="text-red-600 dark:text-red-400">
                          G
                        </span>
                      </div>
                      <div className="flex text-lg font-bold leading-none">
                        <span className="text-red-600 dark:text-red-400">
                          R
                        </span>
                        <span className="text-red-600 dark:text-red-400">
                          M
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="w-full h-px bg-gray-400 dark:bg-gray-500 my-0.5"></div>
                  <div className="static h-1 text-center">
                    <h1 className="absolute w-[600px] text-[4px] tracking-[-0.05em] uppercase font-bold transform scale-[0.25] origin-top-left leading-none text-black left-[35.3%]">
                      UNIVERSIDAD AUTÓNOMA GABRIEL RENÉ MORENO
                    </h1>
                  </div>
                </div>
              </div>
              <div className="text-center mt-0.5">
                <p className="text-[0.5rem] font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-[0.15em]">
                  DEPARTAMENTO DE
                </p>
                <p className="text-[0.55rem] font-bold text-red-600 dark:text-red-400 uppercase tracking-[0.15em]">
                  REGISTRO Y TRÁMITES
                </p>
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 px-3 py-2 space-y-3 overflow-y-auto min-h-0">
          {navSections.map((section) => {
            const isGestion = section.label === "Gestión";
            const borderColor = isGestion
              ? "border-l-red-400 dark:border-l-red-500"
              : "border-l-blue-400 dark:border-l-blue-500";
            return (
              <div key={section.label}>
                {!sidebarCollapsed && (
                  <p className="text-xs font-semibold text-surface-400 dark:text-navy-500 uppercase tracking-wider px-3 mb-2">
                    {section.label}
                  </p>
                )}
                <div className="space-y-1">
                  {section.items.map((item) => {
                    if (item.children) {
                      const isExpanded = expandedMenus.has(item.label);
                      const isActive = item.children.some(
                        (c) => location.pathname === c.to,
                      );
                      return (
                        <div key={item.label}>
                          <button
                            onClick={() => toggleMenu(item.label)}
                            title={sidebarCollapsed ? item.label : undefined}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                              sidebarCollapsed ? "justify-center" : ""
                            } ${
                              isActive
                                ? `border-l-4 ${borderColor} bg-brand-50 text-brand-700 dark:bg-brand-dark-600/20 dark:text-brand-dark-400 font-medium shadow-sm border border-brand-100/50 dark:border-brand-dark-600/30`
                                : "border-l-4 border-transparent text-surface-600 dark:text-navy-400 hover:bg-white/50 dark:hover:bg-navy-800/50 hover:text-surface-900 dark:hover:text-navy-200"
                            }`}>
                            <div
                              className={
                                isActive
                                  ? "text-brand-600 dark:text-brand-dark-400"
                                  : "text-surface-400 dark:text-navy-500"
                              }>
                              <item.icon size={18} />
                            </div>
                            {!sidebarCollapsed && (
                              <>
                                <span className="text-sm flex-1 text-left">
                                  {item.label}
                                </span>
                                <ChevronDown
                                  size={14}
                                  className={`transition-transform ${isExpanded ? "rotate-0" : "-rotate-90"}`}
                                />
                              </>
                            )}
                          </button>
                          {isExpanded && !sidebarCollapsed && (
                            <div
                              className={`ml-4 mt-1 space-y-1 border-l-2 ${isGestion ? "border-red-200 dark:border-red-900/50" : "border-blue-200 dark:border-blue-900/50"} pl-2`}>
                              {item.children.map((child) => (
                                <Link
                                  key={child.to}
                                  to={child.to!}
                                  className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all ${
                                    location.pathname === child.to
                                      ? `border-l-4 ${borderColor} bg-brand-50 text-brand-700 dark:bg-brand-dark-600/20 dark:text-brand-dark-400 font-medium`
                                      : "border-l-4 border-transparent text-surface-600 dark:text-navy-400 hover:bg-white/50 dark:hover:bg-navy-800/50 hover:text-surface-900 dark:hover:text-navy-200"
                                  }`}>
                                  <child.icon size={16} />
                                  <span className="text-sm">{child.label}</span>
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    }
                    return (
                      <Link
                        key={item.to}
                        to={item.to!}
                        title={sidebarCollapsed ? item.label : undefined}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                          sidebarCollapsed ? "justify-center" : ""
                        } ${
                          location.pathname === item.to
                            ? `border-l-4 ${borderColor} bg-brand-50 text-brand-700 dark:bg-brand-dark-600/20 dark:text-brand-dark-400 font-medium shadow-sm border border-brand-100/50 dark:border-brand-dark-600/30`
                            : "border-l-4 border-transparent text-surface-600 dark:text-navy-400 hover:bg-white/50 dark:hover:bg-navy-800/50 hover:text-surface-900 dark:hover:text-navy-200"
                        }`}>
                        <div
                          className={
                            location.pathname === item.to
                              ? "text-brand-600 dark:text-brand-dark-400"
                              : "text-surface-400 dark:text-navy-500"
                          }>
                          <item.icon size={18} />
                        </div>
                        {!sidebarCollapsed && (
                          <span className="text-sm">{item.label}</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div
          className={`p-3 mt-auto space-y-2 border-t border-white/30 dark:border-navy-700/30`}>
          {!sidebarCollapsed ? (
            <Link
              to="/perfil"
              className="glass-card rounded-xl p-3 flex items-center gap-3 cursor-pointer">
              <div className="w-9 h-9 rounded-full bg-surface-200 dark:bg-navy-700 flex items-center justify-center text-surface-500 dark:text-navy-400 flex-shrink-0">
                <UserCircle size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-surface-800 dark:text-navy-200 truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-surface-500 dark:text-navy-500">
                  {primaryRole}
                </p>
              </div>
            </Link>
          ) : (
            <Link
              to="/perfil"
              title="Perfil"
              className="w-full flex items-center justify-center py-2 rounded-xl text-surface-600 dark:text-navy-400 hover:bg-white/50 dark:hover:bg-navy-800/50 transition-colors">
              <UserCircle size={18} />
            </Link>
          )}

          <div className="flex items-center gap-1">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? "Expandir sidebar" : "Minimizar sidebar"}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-surface-500 dark:text-navy-500 hover:bg-white/50 dark:hover:bg-navy-800/50 transition-colors">
              {sidebarCollapsed ? (
                <ChevronRight size={18} />
              ) : (
                <ChevronLeft size={18} />
              )}
              {!sidebarCollapsed && <span className="text-sm">Minimizar</span>}
            </button>
          </div>

          <button
            onClick={logout}
            title={sidebarCollapsed ? "Cerrar sesión" : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors text-sm font-medium ${
              sidebarCollapsed ? "justify-center" : ""
            }`}>
            <LogOut size={18} />
            {!sidebarCollapsed && <span>Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="absolute left-0 top-0 h-full w-72 glass-panel rounded-r-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}>
            <div className="p-4 flex items-center justify-between">
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-2">
                  <div className="w-12 h-12 bg-blue-600 dark:bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0">
                    LOGO
                  </div>
                  <div className="w-px h-12 bg-gray-400 dark:bg-gray-500 shrink-0"></div>
                  <div className="font-serif leading-none">
                    <div className="flex items-end">
                      <span className="text-4xl text-blue-800 dark:text-blue-300 leading-none">
                        U
                      </span>
                      <div className="flex flex-col ml-0.5">
                        <div className="flex text-lg font-bold leading-tight">
                          <span className="text-blue-800 dark:text-blue-300">
                            A
                          </span>
                          <span className="text-red-600 dark:text-red-400">
                            G
                          </span>
                        </div>
                        <div className="flex text-lg font-bold leading-tight">
                          <span className="text-red-600 dark:text-red-400">
                            R
                          </span>
                          <span className="text-red-600 dark:text-red-400">
                            M
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="w-full h-px bg-gray-400 dark:bg-gray-500 my-0.5"></div>
                    <div className="static h-4 text-center overflow-visible">
                      <h1 className="text-[4px] tracking-[-0.05em] uppercase font-bold transform scale-[0.4] origin-center leading-none text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        UNIVERSIDAD AUTÓNOMA GABRIEL RENÉ MORENO
                      </h1>
                    </div>
                  </div>
                </div>
                <div className="text-center mt-0.5">
                  <p className="text-[0.5rem] font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-[0.15em]">
                    DEPARTAMENTO DE
                  </p>
                  <p className="text-[0.55rem] font-bold text-red-600 dark:text-red-400 uppercase tracking-[0.15em]">
                    REGISTRO Y TRÁMITES
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 px-3 py-2 space-y-3 overflow-y-auto min-h-0">
              {navSections.map((section) => {
                const isGestion = section.label === "Gestión";
                const borderColor = isGestion
                  ? "border-l-red-400 dark:border-l-red-500"
                  : "border-l-blue-400 dark:border-l-blue-500";
                return (
                  <div key={section.label}>
                    <p className="text-xs font-semibold text-surface-400 dark:text-navy-500 uppercase tracking-wider px-3 mb-2">
                      {section.label}
                    </p>
                    <div className="space-y-1">
                      {section.items.map((item) => {
                        if (item.children) {
                          const isExpanded = expandedMenus.has(item.label);
                          const isActive = item.children.some(
                            (c) => location.pathname === c.to,
                          );
                          return (
                            <div key={item.label}>
                              <button
                                onClick={() => toggleMenu(item.label)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                                  isActive
                                    ? `border-l-4 ${borderColor} bg-brand-50 text-brand-700 dark:bg-brand-dark-600/20 dark:text-brand-dark-400 font-medium shadow-sm border border-brand-100/50 dark:border-brand-dark-600/30`
                                    : "border-l-4 border-b-4 border-transparent text-surface-600 dark:text-navy-400 hover:bg-white/50 dark:hover:bg-navy-800/50 hover:text-surface-900 dark:hover:text-navy-200"
                                }`}>
                                <div
                                  className={
                                    isActive
                                      ? "text-blue-600 dark:text-brand-dark-400"
                                      : "text-surface-400 dark:text-navy-500"
                                  }>
                                  <item.icon size={18} />
                                </div>
                                <span className="text-sm flex-1 text-left">
                                  {item.label}
                                </span>
                                <ChevronDown
                                  size={14}
                                  className={`transition-transform ${isExpanded ? "rotate-0" : "-rotate-90"}`}
                                />
                              </button>
                              {isExpanded && (
                                <div
                                  className={`ml-4 mt-1 space-y-1 border-l-2 ${isGestion ? "border-red-200 dark:border-red-900/50" : "border-blue-200 dark:border-blue-900/50"} pl-2`}>
                                  {item.children.map((child) => (
                                    <Link
                                      key={child.to}
                                      to={child.to!}
                                      onClick={() => setMobileMenuOpen(false)}
                                      className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all ${
                                        location.pathname === child.to
                                          ? `border-l-4 ${borderColor} bg-brand-50 text-brand-700 dark:bg-brand-dark-600/20 dark:text-brand-dark-400 font-medium`
                                          : "border-l-4 border-transparent text-surface-600 dark:text-navy-400 hover:bg-white/50 dark:hover:bg-navy-800/50 hover:text-surface-900 dark:hover:text-navy-200"
                                      }`}>
                                      <child.icon size={16} />
                                      <span className="text-sm">
                                        {child.label}
                                      </span>
                                    </Link>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        }
                        return (
                          <Link
                            key={item.to}
                            to={item.to!}
                            onClick={() => setMobileMenuOpen(false)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                              location.pathname === item.to
                                ? `border-l-4 ${borderColor} bg-brand-50 text-brand-700 dark:bg-brand-dark-600/20 dark:text-brand-dark-400 font-medium shadow-sm border border-brand-100/50 dark:border-brand-dark-600/30`
                                : "border-l-4 border-transparent text-surface-600 dark:text-navy-400 hover:bg-white/50 dark:hover:bg-navy-800/50 hover:text-surface-900 dark:hover:text-navy-200"
                            }`}>
                            <div
                              className={
                                location.pathname === item.to
                                  ? "text-brand-600 dark:text-brand-dark-400"
                                  : "text-surface-400 dark:text-navy-500"
                              }>
                              <item.icon size={18} />
                            </div>
                            <span className="text-sm">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </nav>

            <div className="p-3 mt-auto space-y-2 border-t border-white/30 dark:border-navy-700/30">
              <Link
                to="/perfil"
                onClick={() => setMobileMenuOpen(false)}
                className="glass-card rounded-xl p-3 flex items-center gap-3 cursor-pointer">
                <div className="w-9 h-9 rounded-full bg-surface-200 dark:bg-navy-700 flex items-center justify-center text-surface-500 dark:text-navy-400 flex-shrink-0">
                  <UserCircle size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-surface-800 dark:text-navy-200 truncate">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-surface-500 dark:text-navy-500">
                    {primaryRole}
                  </p>
                </div>
              </Link>

              <button
                onClick={logout}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors text-sm font-medium">
                <LogOut size={18} />
                <span>Cerrar sesión</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 p-4 md:p-8 z-10 flex flex-col h-screen overflow-y-auto">
        <header className="flex justify-between items-center mb-8 glass-panel px-6 py-4 rounded-2xl">
          <div>
            <h2 className="text-2xl font-bold text-surface-800 dark:text-navy-200">
              Hola, {user?.firstName ?? "Usuario"}
            </h2>
            <p className="text-surface-500 dark:text-navy-400 text-sm mt-1">
              {" "}
              Rol: {primaryRole}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden w-10 h-10 rounded-xl bg-white/50 dark:bg-navy-800/50 border border-white/40 dark:border-navy-700/40 flex items-center justify-center text-surface-600 dark:text-navy-400 hover:text-brand-600 dark:hover:text-brand-dark-400 hover:bg-white dark:hover:bg-navy-800 transition-colors">
              <Menu size={20} />
            </button>
            <div
              className="relative hidden sm:block"
              onClick={(e) => {
                const input = e.currentTarget.querySelector('input');
                if (input) input.focus();
              }}
            >
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 dark:text-navy-500 pointer-events-none"
                size={18}
              />
              <input
                type="text"
                placeholder="Buscar expediente..."
                value={headerSearch}
                onChange={(e) => setHeaderSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && headerSearch.trim()) {
                    navigate(
                      `/buscar?q=${encodeURIComponent(headerSearch.trim())}`,
                    );
                    setHeaderSearch("");
                  }
                }}
                className="pl-10 pr-4 py-2 rounded-xl bg-white/50 dark:bg-navy-800/50 border border-white/40 dark:border-navy-700/40 focus:outline-none focus:ring-2 focus:ring-brand-400/50 focus:bg-white dark:focus:bg-navy-800 w-64 transition-all"
              />
            </div>
            <button
              onClick={toggleTheme}
              className="w-10 h-10 rounded-xl bg-white/50 dark:bg-navy-800/50 border border-white/40 dark:border-navy-700/40 flex items-center justify-center text-surface-600 dark:text-navy-400 hover:text-brand-600 dark:hover:text-brand-dark-400 hover:bg-white dark:hover:bg-navy-800 transition-colors"
              title={theme === "light" ? "Modo oscuro" : "Modo claro"}>
              {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            <NotificationBell />
            <Link
              to="/perfil"
              className="w-10 h-10 rounded-xl bg-white/50 dark:bg-navy-800/50 border border-white/40 dark:border-navy-700/40 flex items-center justify-center text-surface-600 dark:text-navy-400 hover:text-brand-600 dark:hover:text-brand-dark-400 hover:bg-white dark:hover:bg-navy-800 transition-colors">
              <Settings size={20} />
            </Link>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
