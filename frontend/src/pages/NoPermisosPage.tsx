import { ShieldAlert, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function NoPermisosPage() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-panel rounded-2xl p-8 text-center max-w-md w-full">
        <div className="mx-auto w-20 h-20 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-6">
          <ShieldAlert className="text-amber-600 dark:text-amber-400" size={40} />
        </div>
        <h2 className="text-2xl font-bold text-surface-800 dark:text-navy-200 mb-3">
          Sin Permisos Asignados
        </h2>
        <p className="text-surface-600 dark:text-navy-500 mb-6">
          Tu cuenta de usuario no tiene permisos asignados para acceder al sistema.
          <br />
          <br />
          Por favor, contacta al administrador del sistema para que te asigne los permisos correspondientes.
        </p>
        <button
          onClick={logout}
          className="flex items-center justify-center gap-2 mx-auto px-6 py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white font-medium shadow-md hover:shadow-lg transition-all"
        >
          <LogOut size={18} />
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
}
