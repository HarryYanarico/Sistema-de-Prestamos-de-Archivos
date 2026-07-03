/* eslint-disable react-refresh/only-export-components */
/* eslint-disable react-hooks/set-state-in-effect */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { client } from '../lib/apollo';
import { LOGIN_MUTATION, GET_ME } from '../lib/queries';

const SESSION_INVALIDATED_KEY = 'last_known_session_invalidated_at';
const REFRESH_INTERVAL_MS = 30 * 1000;

interface User {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  isSuperuser: boolean;
  dateJoined?: string;
  groups: { id: string; name: string }[];
  permissionsList: string[];
  ambientesAsignados: string[];
  sessionInvalidatedAt?: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  refreshSession: () => Promise<void>;
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(
      atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
    );
    return !payload.exp || Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

function clearToken() {
  localStorage.removeItem('jwt_token');
  localStorage.removeItem(SESSION_INVALIDATED_KEY);
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setLoading(false), 8000);
    return () => clearTimeout(timer);
  }, [loading]);

  const checkAndHandleSessionInvalidation = useCallback((newInvalidatedAt: string | null | undefined): boolean => {
    const lastKnown = localStorage.getItem(SESSION_INVALIDATED_KEY);

    if (lastKnown === null) {
      if (newInvalidatedAt) {
        localStorage.setItem(SESSION_INVALIDATED_KEY, newInvalidatedAt);
      } else {
        localStorage.setItem(SESSION_INVALIDATED_KEY, 'none');
      }
      return false;
    }

    const currentValue = newInvalidatedAt ?? 'none';

    if (lastKnown !== currentValue) {
      return true;
    }

    return false;
  }, []);

  const performLogout = useCallback(() => {
    clearToken();
    setUser(null);
    client.resetStore();
  }, []);

  const refreshSession = useCallback(async () => {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      setLoading(false);
      setUser(null);
      return;
    }

    if (isTokenExpired(token)) {
      performLogout();
      setLoading(false);
      return;
    }

    try {
      const { data } = await client.query({ query: GET_ME, fetchPolicy: 'network-only' });
        if (data?.me) {
        if (checkAndHandleSessionInvalidation(data.me.sessionInvalidatedAt)) {
          localStorage.setItem('session_invalidated_message', 'Tus permisos han sido actualizados por un administrador. Debes iniciar sesión nuevamente.');
          performLogout();
          return;
        }

        if (data.me.sessionInvalidatedAt) {
          localStorage.setItem(SESSION_INVALIDATED_KEY, data.me.sessionInvalidatedAt);
        } else {
          localStorage.setItem(SESSION_INVALIDATED_KEY, 'none');
        }

        setUser(data.me);
      } else {
        performLogout();
      }
    } catch {
      performLogout();
    } finally {
      setLoading(false);
    }
  }, [checkAndHandleSessionInvalidation, performLogout]);

  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      setLoading(false);
      return;
    }

    if (isTokenExpired(token)) {
      clearToken();
      setLoading(false);
      return;
    }

    client.query({ query: GET_ME, fetchPolicy: 'network-only' })
      .then(({ data }) => {
        if (data?.me) {
          if (data.me.sessionInvalidatedAt) {
            localStorage.setItem(SESSION_INVALIDATED_KEY, data.me.sessionInvalidatedAt);
          } else {
            localStorage.setItem(SESSION_INVALIDATED_KEY, 'none');
          }
          setUser(data.me);
        } else {
          clearToken();
        }
      })
      .catch(() => {
        clearToken();
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    if (!token) return;

    const intervalId = setInterval(() => {
      refreshSession();
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [refreshSession]);

  const login = async (username: string, password: string) => {
    const { data } = await client.mutate({
      mutation: LOGIN_MUTATION,
      variables: { username, password },
    });
    const result = data?.login2fa;
    if (!result?.success) {
      throw new Error(result?.error || 'Credenciales inválidas');
    }
    if (result.requires2fa) {
      throw new Error('Se requiere verificación 2FA. Utiliza la página de inicio de sesión.');
    }
    if (result.token) {
      localStorage.setItem('jwt_token', result.token);
      const { data: userData } = await client.query({ query: GET_ME, fetchPolicy: 'network-only' });
      if (userData?.me) {
        if (userData.me.sessionInvalidatedAt) {
          localStorage.setItem(SESSION_INVALIDATED_KEY, userData.me.sessionInvalidatedAt);
        } else {
          localStorage.setItem(SESSION_INVALIDATED_KEY, 'none');
        }
        setUser(userData.me);
      }
    } else {
      throw new Error('No se pudo obtener el token de autenticación');
    }
  };

  const logout = () => {
    performLogout();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

export function usePermission() {
  const { user } = useAuth();
  const hasPerm = (codename: string) =>
    user?.isSuperuser || (user?.permissionsList?.includes(`api.${codename}`) ?? false);
  const isAdmin = user?.isSuperuser || (user?.groups?.some((g) => g.name === 'Administrador') ?? false);
  return { hasPerm, isAdmin };
}
