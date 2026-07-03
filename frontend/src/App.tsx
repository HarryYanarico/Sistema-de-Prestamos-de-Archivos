import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { usePermission } from "./context/AuthContext";
import Layout from "./components/Layout";
import ErrorBoundary from "./components/ErrorBoundary";

const Login = lazy(() => import("./pages/Login"));
const HomePage = lazy(() => import("./pages/HomePage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Profile = lazy(() => import("./pages/Profile"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const PersonasPage = lazy(() => import("./pages/PersonasPage"));
const UbicacionesPage = lazy(() => import("./pages/UbicacionesPage"));
const PrestamosPage = lazy(() => import("./pages/PrestamosPage"));
const PrestamosDocPage = lazy(() => import("./pages/PrestamosDocPage"));
const TraspasosPage = lazy(() => import("./pages/TraspasosPage"));
const CarpetasPage = lazy(() => import("./pages/CarpetasPage"));
const BloqueosPage = lazy(() => import("./pages/BloqueosPage"));
const DevolucionesPage = lazy(() => import("./pages/DevolucionesPage"));
const IncidentesPage = lazy(() => import("./pages/IncidentesPage"));
const ProrrogasPage = lazy(() => import("./pages/ProrrogasPage"));
const RetirosPage = lazy(() => import("./pages/RetirosPage"));
const SearchResultsPage = lazy(() => import("./pages/SearchResultsPage"));
const FirmaPage = lazy(() => import("./pages/FirmaPage"));
const ReportesPage = lazy(() => import("./pages/ReportesPage"));
const NoPermisosPage = lazy(() => import("./pages/NoPermisosPage"));
const AccesoDenegadoPage = lazy(() => import("./pages/AccesoDenegadoPage"));

const FEATURE_PERMS = [
  "ver_dashboard",
  "gestionar_carpetas",
  "gestionar_documentos",
  "gestionar_prestamos",
  "gestionar_devoluciones",
  "gestionar_traspasos",
  "gestionar_ubicaciones",
  "gestionar_personas",
  "gestionar_bloqueos",
  "gestionar_prorrogas",
  "gestionar_retiros",
  "gestionar_usuarios",
];

function hasAnyPermission(user: any): boolean {
  if (!user) return false;
  if (user.isSuperuser) return true;
  const perms = user.permissionsList ?? [];
  return FEATURE_PERMS.some((p) => perms.includes(`api.${p}`));
}

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-white via-red-50 to-blue-100 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      }>
      {children}
    </Suspense>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-red-50 to-blue-100 flex items-center justify-center">
      <div className="text-surface-600 text-lg font-medium">Cargando...</div>
    </div>
  );
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <LoadingFallback />;
  if (isAuthenticated)
    return (
      <Navigate
        to="/"
        replace
      />
    );
  return <>{children}</>;
}

function NoPermisosRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, user } = useAuth();
  const { hasPerm } = usePermission();

  if (loading) return <LoadingFallback />;
  if (!isAuthenticated)
    return (
      <Navigate
        to="/login"
        replace
      />
    );

  const hasAny = user?.isSuperuser || FEATURE_PERMS.some((p) => hasPerm(p));
  if (hasAny)
    return (
      <Navigate
        to="/"
        replace
      />
    );

  return <>{children}</>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, user } = useAuth();
  const { hasPerm } = usePermission();

  if (loading) return <LoadingFallback />;
  if (!isAuthenticated)
    return (
      <Navigate
        to="/login"
        replace
      />
    );

  const hasAny = user?.isSuperuser || FEATURE_PERMS.some((p) => hasPerm(p));
  if (!hasAny)
    return (
      <Navigate
        to="/no-permisos"
        replace
      />
    );

  return <Layout>{children}</Layout>;
}

function PermissionRoute({
  children,
  permissions,
  requireAny = false,
}: {
  children: React.ReactNode;
  permissions: string | string[];
  requireAny?: boolean;
}) {
  const { isAuthenticated, loading, user } = useAuth();
  const { hasPerm } = usePermission();

  if (loading) return <LoadingFallback />;
  if (!isAuthenticated)
    return (
      <Navigate
        to="/login"
        replace
      />
    );

  const hasAny = user?.isSuperuser || FEATURE_PERMS.some((p) => hasPerm(p));
  if (!hasAny)
    return (
      <Navigate
        to="/no-permisos"
        replace
      />
    );

  const perms = Array.isArray(permissions) ? permissions : [permissions];
  const hasAccess = requireAny
    ? perms.some((p) => hasPerm(p))
    : perms.every((p) => hasPerm(p));

  if (!hasAccess)
    return (
      <Navigate
        to="/acceso-denegado"
        replace
      />
    );

  return <Layout>{children}</Layout>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const { isAdmin } = usePermission();

  if (loading) return <LoadingFallback />;
  if (!isAuthenticated)
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  if (!isAdmin)
    return (
      <Navigate
        to="/acceso-denegado"
        replace
      />
    );

  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <SuspenseWrapper>
          <Routes>
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />

            <Route
              path="/firma/:token"
              element={<FirmaPage />}
            />

            <Route
              path="/no-permisos"
              element={
                <NoPermisosRoute>
                  <NoPermisosPage />
                </NoPermisosRoute>
              }
            />

            <Route
              path="/acceso-denegado"
              element={
                <ProtectedRoute>
                  <AccesoDenegadoPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard"
              element={
                <PermissionRoute permissions="ver_dashboard">
                  <Dashboard />
                </PermissionRoute>
              }
            />

            <Route
              path="/perfil"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />

            <Route
              path="/buscar"
              element={
                <ProtectedRoute>
                  <SearchResultsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/carpetas"
              element={
                <PermissionRoute permissions="gestionar_carpetas">
                  <CarpetasPage />
                </PermissionRoute>
              }
            />

            <Route
              path="/prestamos"
              element={
                <PermissionRoute
                  permissions={[
                    "gestionar_prestamos",
                    "gestionar_devoluciones",
                  ]}
                  requireAny={true}>
                  <PrestamosPage />
                </PermissionRoute>
              }
            />

            <Route
              path="/prestamos/documentos"
              element={
                <PermissionRoute
                  permissions={[
                    "gestionar_prestamos",
                    "gestionar_devoluciones",
                  ]}
                  requireAny={true}>
                  <PrestamosDocPage />
                </PermissionRoute>
              }
            />

            <Route
              path="/ubicaciones"
              element={
                <PermissionRoute permissions="gestionar_ubicaciones">
                  <UbicacionesPage />
                </PermissionRoute>
              }
            />

            <Route
              path="/traspasos"
              element={
                <PermissionRoute permissions="gestionar_traspasos">
                  <TraspasosPage />
                </PermissionRoute>
              }
            />

            <Route
              path="/usuarios"
              element={
                <AdminRoute>
                  <UsersPage />
                </AdminRoute>
              }
            />

            <Route
              path="/personas"
              element={
                <AdminRoute>
                  <PersonasPage />
                </AdminRoute>
              }
            />

            <Route
              path="/bloqueos"
              element={
                <PermissionRoute permissions="gestionar_bloqueos">
                  <BloqueosPage />
                </PermissionRoute>
              }
            />

            <Route
              path="/devoluciones"
              element={
                <PermissionRoute
                  permissions={[
                    "gestionar_prestamos",
                    "gestionar_devoluciones",
                  ]}
                  requireAny={true}>
                  <DevolucionesPage />
                </PermissionRoute>
              }
            />

            <Route
              path="/incidentes"
              element={
                <PermissionRoute permissions="gestionar_carpetas">
                  <IncidentesPage />
                </PermissionRoute>
              }
            />

            <Route
              path="/prorrogas"
              element={
                <PermissionRoute permissions="gestionar_prorrogas">
                  <ProrrogasPage />
                </PermissionRoute>
              }
            />

            <Route
              path="/retiros"
              element={
                <PermissionRoute permissions="gestionar_retiros">
                  <RetirosPage />
                </PermissionRoute>
              }
            />

            <Route
              path="/reportes"
              element={
                <ProtectedRoute>
                  <ReportesPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="*"
              element={
                <Navigate
                  to="/"
                  replace
                />
              }
            />
          </Routes>
        </SuspenseWrapper>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
