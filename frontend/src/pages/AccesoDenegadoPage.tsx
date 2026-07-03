import { ShieldX, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AccesoDenegadoPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-panel rounded-2xl p-8 text-center max-w-md w-full">
        <div className="mx-auto w-20 h-20 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-6">
          <ShieldX className="text-red-600 dark:text-red-400" size={40} />
        </div>
        <h2 className="text-2xl font-bold text-surface-800 dark:text-navy-200 mb-3">
          Acceso Denegado
        </h2>
        <p className="text-surface-600 dark:text-navy-500 mb-6">
          No tienes los permisos necesarios para acceder a esta página.
          <br />
          Si crees que esto es un error, contacta al administrador.
        </p>
        <button
          onClick={() => navigate('/')}
          className="flex items-center justify-center gap-2 mx-auto px-6 py-3 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 text-white font-medium shadow-md hover:shadow-lg transition-all"
        >
          <ArrowLeft size={18} />
          Ir al Inicio
        </button>
      </div>
    </div>
  );
}
