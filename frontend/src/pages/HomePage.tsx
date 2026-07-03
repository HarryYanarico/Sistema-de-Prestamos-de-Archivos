import { useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import {
  BookOpenCheck,
  MapPin,
  ArrowLeftRight,
  FileText,
  Building2,
  LayoutDashboard,
  ChevronRight,
  Users,
} from 'lucide-react';
import { GET_MIS_AMBIENTES } from '../lib/queries';
import { usePermission } from '../context/AuthContext';

interface Ambiente {
  id: string;
  nombre: string;
  ubicacion?: string;
  descripcion?: string;
}

interface FeatureCard {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
  to: string;
  color: string;
  bgColor: string;
}

interface MisAmbientesData { misAmbientes: Ambiente[]; }

export default function HomePage() {
  const navigate = useNavigate();
  const { hasPerm } = usePermission();
  const { data: ambData, loading: ambLoading } = useQuery<MisAmbientesData>(GET_MIS_AMBIENTES);
  const ambientes = (ambData?.misAmbientes ?? []) as Ambiente[];

  const canViewDashboard = hasPerm('ver_dashboard');
  const canGestionarCarpetas = hasPerm('gestionar_carpetas');
  const canGestionarPrestamos = hasPerm('gestionar_prestamos');
  const canGestionarUbicaciones = hasPerm('gestionar_ubicaciones');
  const canGestionarTraspasos = hasPerm('gestionar_traspasos');

  const availableFeatures: FeatureCard[] = [];

  if (canViewDashboard) {
    availableFeatures.push({
      icon: LayoutDashboard,
      title: 'Dashboard',
      description: 'Ver estadísticas y reportes del sistema',
      to: '/dashboard',
      color: 'text-brand-600 dark:text-brand-dark-400',
      bgColor: 'bg-brand-100 dark:bg-brand-dark-600/20',
    });
  }

  if (canGestionarCarpetas) {
    availableFeatures.push({
      icon: FileText,
      title: 'Gestionar Carpetas',
      description: 'Ver y administrar carpetas de tus ambientes',
      to: '/carpetas',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/20',
    });
  }

  if (canGestionarPrestamos) {
    availableFeatures.push({
      icon: BookOpenCheck,
      title: 'Gestionar Préstamos',
      description: 'Registrar préstamos y devoluciones',
      to: '/prestamos',
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-100 dark:bg-amber-900/20',
    });
  }

  if (canGestionarUbicaciones) {
    availableFeatures.push({
      icon: MapPin,
      title: 'Gestionar Ubicaciones',
      description: 'Administrar ambientes, estantes y pisos',
      to: '/ubicaciones',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/20',
    });
  }

  if (canGestionarTraspasos) {
    availableFeatures.push({
      icon: ArrowLeftRight,
      title: 'Gestionar Traspasos',
      description: 'Transferir carpetas entre ubicaciones',
      to: '/traspasos',
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-100 dark:bg-purple-900/20',
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-bold text-surface-800 dark:text-navy-200 mb-4 flex items-center gap-2">
          <Building2 className="text-brand-600" size={20} />
          Tus Ambientes Asignados
        </h3>

        {ambLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
          </div>
        ) : ambientes.length === 0 ? (
          <div className="glass-panel rounded-2xl p-8 text-center">
            <Building2 className="mx-auto text-surface-400 dark:text-navy-600 mb-3" size={48} />
            <p className="text-surface-600 dark:text-navy-500">
              No tienes ambientes asignados. Contacta al administrador.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ambientes.map((amb) => (
              <div
                key={amb.id}
                className="glass-card rounded-xl p-5 hover:bg-white/80 dark:hover:bg-navy-800/80 transition-colors cursor-pointer group"
                onClick={() => navigate(`/carpetas?ambiente=${amb.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-brand-100 dark:bg-brand-dark-600/20">
                      <Building2 className="text-brand-600 dark:text-brand-dark-400" size={22} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-surface-800 dark:text-navy-200">
                        {amb.nombre}
                      </h4>
                      {amb.ubicacion && (
                        <p className="text-xs text-surface-500 dark:text-navy-500 mt-0.5">
                          {amb.ubicacion}
                        </p>
                      )}
                    </div>
                  </div>
                  <ChevronRight
                    className="text-surface-400 dark:text-navy-600 group-hover:text-brand-600 dark:group-hover:text-brand-dark-400 transition-colors"
                    size={20}
                  />
                </div>
                {amb.descripcion && (
                  <p className="text-xs text-surface-500 dark:text-navy-500 mt-3 pt-3 border-t border-white/20 dark:border-navy-700/30">
                    {amb.descripcion}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {availableFeatures.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-surface-800 dark:text-navy-200 mb-4 flex items-center gap-2">
            <Users className="text-brand-600" size={20} />
            Lo que puedes hacer
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableFeatures.map((feature) => (
              <button
                key={feature.to}
                onClick={() => navigate(feature.to)}
                className="glass-card rounded-xl p-5 text-left hover:bg-white/80 dark:hover:bg-navy-800/80 transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${feature.bgColor} shrink-0`}>
                    <feature.icon className={feature.color} size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-semibold text-surface-800 dark:text-navy-200">
                        {feature.title}
                      </h4>
                      <ChevronRight
                        className="text-surface-400 dark:text-navy-600 group-hover:text-brand-600 dark:group-hover:text-brand-dark-400 transition-colors shrink-0"
                        size={20}
                      />
                    </div>
                    <p className="text-sm text-surface-500 dark:text-navy-500 mt-1">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {availableFeatures.length === 0 && (
        <div className="glass-panel rounded-2xl p-8 text-center">
          <ShieldAlert className="mx-auto text-amber-500 mb-3" size={48} />
          <h4 className="font-semibold text-surface-800 dark:text-navy-200 mb-2">
            Sin funcionalidades asignadas
          </h4>
          <p className="text-sm text-surface-500 dark:text-navy-500">
            Tu cuenta no tiene permisos para acceder a ninguna funcionalidad.
            <br />
            Contacta al administrador del sistema.
          </p>
        </div>
      )}
    </div>
  );
}

function ShieldAlert({ className, size }: { className?: string; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size ?? 24}
      height={size ?? 24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}
