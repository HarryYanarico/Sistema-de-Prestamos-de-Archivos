import { useQuery } from '@apollo/client/react';
import {
  FileText, BookOpenCheck, Users, FolderSearch,
  AlertTriangle, Clock, ArrowLeftRight, RotateCcw, CheckCircle2,
} from 'lucide-react';
import { GET_DASHBOARD_STATS } from '../lib/queries';

interface DashboardStats {
  totalCarpetas: number;
  prestamosActivos: number;
  prestamosVencidosCount: number;
  carpetasDisponibles: number;
  personasCount: number;
  traspasosPendientes: number;
  incidentesActivos: number;
  carpetasPorAmbiente: { ambienteId: string; ambienteNombre: string; count: number }[];
  prestamosRecientes: {
    id: string;
    fechaPrest: string;
    fechaDevolucion: string;
    persona: { nombre: string; apellido: string };
    carpetas: { descripcion: string }[];
  }[];
  prestamosPorVencer: {
    id: string;
    fechaDevolucion: string;
    persona: { nombre: string; apellido: string };
    carpetas: { descripcion: string }[];
  }[];
  devolucionesRecientes: {
    id: string;
    fechaDevol: string;
    usuario: { firstName: string; lastName: string };
    prestamoCarpeta: { carpeta: { descripcion: string } };
  }[];
}

interface DashboardData {
  dashboardStats: DashboardStats;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function Dashboard() {
  const { loading, error, data } = useQuery<DashboardData>(GET_DASHBOARD_STATS);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="glass-panel rounded-2xl p-8 text-center text-surface-600 dark:text-navy-500">
        {error ? `Error al cargar estadísticas: ${error.message}` : 'No hay datos disponibles'}
      </div>
    );
  }

  const s = data.dashboardStats;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <StatCard
          title="Total Carpetas"
          value={s.totalCarpetas.toLocaleString()}
          icon={<FileText className="text-brand-600 dark:text-brand-dark-400" size={20} />}
          color="bg-brand-100 dark:bg-brand-dark-600/20"
        />
        <StatCard
          title="Préstamos Activos"
          value={s.prestamosActivos.toLocaleString()}
          icon={<BookOpenCheck className="text-amber-600 dark:text-amber-400" size={20} />}
          color="bg-amber-100 dark:bg-amber-900/40"
        />
        <StatCard
          title="Vencidos"
          value={s.prestamosVencidosCount.toLocaleString()}
          icon={<AlertTriangle className="text-red-600 dark:text-red-400" size={20} />}
          color="bg-red-100 dark:bg-red-900/40"
        />
        <StatCard
          title="Disponibles"
          value={s.carpetasDisponibles.toLocaleString()}
          icon={<CheckCircle2 className="text-green-600 dark:text-green-400" size={20} />}
          color="bg-green-100 dark:bg-green-900/40"
        />
        <StatCard
          title="Personas"
          value={s.personasCount.toLocaleString()}
          icon={<Users className="text-indigo-600 dark:text-indigo-400" size={20} />}
          color="bg-indigo-100 dark:bg-indigo-900/40"
        />
        <StatCard
          title="Traspasos Pend."
          value={s.traspasosPendientes.toLocaleString()}
          icon={<ArrowLeftRight className="text-purple-600 dark:text-purple-400" size={20} />}
          color="bg-purple-100 dark:bg-purple-900/40"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-surface-800 dark:text-navy-200 flex items-center gap-2">
              <Clock size={18} className="text-amber-500 dark:text-amber-400" />
              Préstamos por Vencer
            </h3>
          </div>
          {s.prestamosPorVencer.length === 0 ? (
            <p className="text-surface-500 dark:text-navy-500 text-sm py-4 text-center">No hay préstamos próximos a vencer</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
              {s.prestamosPorVencer.map((p) => {
                const d = daysUntil(p.fechaDevolucion);
                const isUrgent = d <= 2;
                return (
                  <div key={p.id} className={`glass-card rounded-xl p-4 flex items-center justify-between ${isUrgent ? 'border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-900/20' : ''}`}>
                    <div>
                      <p className="font-semibold text-sm text-surface-800 dark:text-navy-200">{p.persona.nombre} {p.persona.apellido}</p>
                      <p className="text-xs text-surface-600 dark:text-navy-500">{p.carpetas.map(c => c.descripcion).join(', ') || 'Sin descripción'}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        isUrgent ? 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300'
                      }`}>
                        {d <= 0 ? 'Vencido' : `${d} días`}
                      </span>
                      <p className="text-xs text-surface-500 dark:text-navy-500 mt-1">Vence: {formatDate(p.fechaDevolucion)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="glass-panel rounded-2xl p-6">
          <h3 className="text-lg font-bold text-surface-800 dark:text-navy-200 flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-red-500 dark:text-red-400" />
            Alertas
          </h3>
          <div className="space-y-3">
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">
                  <AlertTriangle size={16} />
                </div>
                <div>
                  <p className="font-semibold text-sm text-surface-800 dark:text-navy-200">{s.prestamosVencidosCount} Vencidos</p>
                  <p className="text-xs text-surface-600 dark:text-navy-500">Préstamos que excedieron la fecha de devolución</p>
                </div>
              </div>
            </div>
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400">
                  <ArrowLeftRight size={16} />
                </div>
                <div>
                  <p className="font-semibold text-sm text-surface-800 dark:text-navy-200">{s.traspasosPendientes} Traspasos Pend.</p>
                  <p className="text-xs text-surface-600 dark:text-navy-500">Carpetas en tránsito por ubicar</p>
                </div>
              </div>
            </div>
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300">
                  <FolderSearch size={16} />
                </div>
                <div>
                  <p className="font-semibold text-sm text-surface-800 dark:text-navy-200">{s.incidentesActivos} Incidentes Activos</p>
                  <p className="text-xs text-surface-600 dark:text-navy-500">Reportes de incidentes sin resolver</p>
                </div>
              </div>
            </div>
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400">
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <p className="font-semibold text-sm text-surface-800 dark:text-navy-200">{s.carpetasDisponibles} Disponibles</p>
                  <p className="text-xs text-surface-600 dark:text-navy-500">Carpetas listas para préstamo</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-surface-800 dark:text-navy-200 flex items-center gap-2">
              <BookOpenCheck size={18} className="text-brand-600 dark:text-brand-dark-400" />
              Préstamos Recientes
            </h3>
          </div>
          {s.prestamosRecientes.length === 0 ? (
            <p className="text-surface-500 dark:text-navy-500 text-sm py-4 text-center">No hay préstamos registrados</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
              {s.prestamosRecientes.map((p) => (
                <div key={p.id} className="glass-card rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-surface-100 flex items-center justify-center text-surface-600 dark:text-navy-500">
                      <FolderSearch size={18} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-surface-800 dark:text-navy-200">{p.persona.nombre} {p.persona.apellido}</p>
                      <p className="text-xs text-surface-600 dark:text-navy-500">{p.carpetas.map(c => c.descripcion).join(', ') || 'Sin descripción'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
                      En Préstamo
                    </span>
                    <p className="text-xs text-surface-500 dark:text-navy-500 mt-1">{formatDate(p.fechaPrest)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-panel rounded-2xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-surface-800 dark:text-navy-200 flex items-center gap-2">
              <RotateCcw size={18} className="text-green-600 dark:text-green-400" />
              Devoluciones Recientes
            </h3>
          </div>
          {s.devolucionesRecientes.length === 0 ? (
            <p className="text-surface-500 dark:text-navy-500 text-sm py-4 text-center">No hay devoluciones registradas</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
              {s.devolucionesRecientes.map((d) => (
                <div key={d.id} className="glass-card rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center text-green-600 dark:text-green-400">
                      <RotateCcw size={18} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-surface-800 dark:text-navy-200">{d.prestamoCarpeta.carpeta.descripcion}</p>
                      <p className="text-xs text-surface-600 dark:text-navy-500">por {d.usuario ? `${d.usuario.firstName} ${d.usuario.lastName}` : '—'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300">
                      Devuelto
                    </span>
                    <p className="text-xs text-surface-500 dark:text-navy-500 mt-1">{formatDate(d.fechaDevol)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-surface-800 dark:text-navy-200">Carpetas por Ambiente</h3>
          </div>
          {s.carpetasPorAmbiente.length === 0 ? (
            <p className="text-surface-500 dark:text-navy-500 text-sm py-4 text-center">No hay datos de ambientes</p>
          ) : (
            <div className="space-y-3">
              {s.carpetasPorAmbiente.map((a) => {
                const maxCount = Math.max(...s.carpetasPorAmbiente.map(x => x.count));
                const pct = (a.count / maxCount) * 100;
                return (
                  <div key={a.ambienteId}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-surface-700 dark:text-navy-300">{a.ambienteNombre}</span>
                      <span className="text-surface-600 dark:text-navy-500">{a.count}</span>
                    </div>
                    <div className="w-full bg-surface-200 dark:bg-navy-700 rounded-full h-2.5">
                      <div
                        className="bg-gradient-to-r from-brand-600 to-blue-500 dark:from-brand-dark-500 dark:to-blue-400 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="glass-panel rounded-2xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-surface-800 dark:text-navy-200">Estado General</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 h-full">
            <EstadoItem
              label="Disponibles"
              value={s.carpetasDisponibles}
              total={s.totalCarpetas}
              color="bg-green-500"
              bgColor="bg-green-100 dark:bg-green-900/40"
            />
            <EstadoItem
              label="En Préstamo"
              value={s.prestamosActivos}
              total={s.totalCarpetas}
              color="bg-amber-500"
              bgColor="bg-amber-100 dark:bg-amber-900/40"
            />
            {s.totalCarpetas > 0 && (
              <div className="col-span-2 mt-2">
                <div className="w-full bg-surface-200 dark:bg-navy-700 rounded-full h-4 overflow-hidden flex">
                  {s.carpetasDisponibles > 0 && (
                    <div
                      className="bg-green-500 h-full transition-all duration-500"
                      style={{ width: `${(s.carpetasDisponibles / s.totalCarpetas) * 100}%` }}
                      title={`Disponibles: ${s.carpetasDisponibles}`}
                    />
                  )}
                  {s.prestamosActivos > 0 && (
                    <div
                      className="bg-amber-500 h-full transition-all duration-500"
                      style={{ width: `${(s.prestamosActivos / s.totalCarpetas) * 100}%` }}
                      title={`En préstamo: ${s.prestamosActivos}`}
                    />
                  )}
                  {(s.totalCarpetas - s.carpetasDisponibles - s.prestamosActivos) > 0 && (
                    <div
                      className="bg-surface-400 dark:bg-navy-600 h-full transition-all duration-500"
                      style={{ width: `${((s.totalCarpetas - s.carpetasDisponibles - s.prestamosActivos) / s.totalCarpetas) * 100}%` }}
                      title={`Otros: ${s.totalCarpetas - s.carpetasDisponibles - s.prestamosActivos}`}
                    />
                  )}
                </div>
                <div className="flex justify-between text-xs text-surface-600 dark:text-navy-500 mt-2">
                  <span><span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" /> Disponibles ({s.carpetasDisponibles})</span>
                  <span><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1" /> En préstamo ({s.prestamosActivos})</span>
                  <span><span className="inline-block w-2 h-2 rounded-full bg-surface-400 dark:bg-navy-600 mr-1" /> Otros ({s.totalCarpetas - s.carpetasDisponibles - s.prestamosActivos})</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="glass-panel rounded-2xl p-4 relative overflow-hidden group">
      <div className={`absolute -right-4 -top-4 w-20 h-20 rounded-full ${color} opacity-50 group-hover:scale-150 transition-transform duration-500 ease-out`} />
      <div className="relative z-10">
        <div className={`p-2.5 rounded-xl ${color} shadow-sm inline-flex mb-3`}>
          {icon}
        </div>
        <h3 className="text-surface-600 dark:text-navy-500 text-xs font-medium mb-0.5">{title}</h3>
        <p className="text-2xl font-bold text-surface-800 dark:text-navy-200">{value}</p>
      </div>
    </div>
  );
}

function EstadoItem({ label, value, total, color, bgColor }: { label: string; value: number; total: number; color: string; bgColor: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className={`glass-card rounded-xl p-4 ${bgColor}`}>
      <p className="text-sm font-semibold text-surface-700 dark:text-navy-300">{label}</p>
      <p className="text-2xl font-bold text-surface-800 dark:text-navy-200">{value}</p>
      <p className="text-xs text-surface-600 dark:text-navy-500">{pct}% del total</p>
      <div className="w-full bg-surface-200 dark:bg-navy-700 rounded-full h-2 mt-2">
        <div className={`${color} h-2 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}