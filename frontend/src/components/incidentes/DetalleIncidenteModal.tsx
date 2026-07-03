import { X, AlertTriangle, CheckCircle } from 'lucide-react';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

interface Props {
  incidente: any;
  onClose: () => void;
}

export default function DetalleIncidenteModal({ incidente, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/70 backdrop-blur-sm p-4">
      <div className="glass-panel rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-surface-800 dark:text-navy-200">Detalle del Incidente</h3>
          <button onClick={onClose}
            className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-100 transition-colors"
          ><X size={20} /></button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs text-surface-600 dark:text-navy-500 mb-1">Tipo</p>
              <p className="font-semibold text-surface-800 dark:text-navy-200">{incidente.tipoInci}</p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs text-surface-600 dark:text-navy-500 mb-1">Fecha de Reporte</p>
              <p className="font-semibold text-surface-800 dark:text-navy-200">{formatDate(incidente.fechaReporte)}</p>
            </div>
          </div>

          <div className="glass-card rounded-xl p-4">
            <p className="text-xs text-surface-600 dark:text-navy-500 mb-1">Estado</p>
            {incidente.estado ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                <AlertTriangle size={12} /> Activo
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                <CheckCircle size={12} /> Resuelto
              </span>
            )}
          </div>

          <div className="glass-card rounded-xl p-4">
            <p className="text-xs text-surface-600 dark:text-navy-500 mb-1">Registrado por</p>
            <p className="font-semibold text-surface-800 dark:text-navy-200">
              {incidente.usuario ? `${incidente.usuario.firstName} ${incidente.usuario.lastName} (@${incidente.usuario.username})` : '—'}
            </p>
          </div>

          <div className="glass-card rounded-xl p-4">
            <p className="text-xs text-surface-600 dark:text-navy-500 mb-3">Carpetas Afectadas ({incidente.detalles?.length ?? 0})</p>
            {(incidente.detalles ?? []).length === 0 ? (
              <p className="text-sm text-surface-500 dark:text-navy-500">Sin carpetas registradas</p>
            ) : (
              <div className="space-y-2">
                {incidente.detalles.map((det: any) => {
                  const piso = det.carpeta?.piso;
                  return (
                    <div key={det.id} className="p-3 rounded-xl bg-white/50 dark:bg-navy-800/50 border border-white/40 dark:border-navy-700/40">
                      <p className="text-sm font-semibold text-surface-800 dark:text-navy-200">{det.carpeta?.descripcion ?? '—'}</p>
                      {piso && (
                        <p className="text-xs text-surface-500 dark:text-navy-500 mt-0.5">
                          {piso.estante?.ambiente?.nombre} / {piso.estante?.codigo} / Fila {piso.nroFila}
                        </p>
                      )}
                      {det.descripcion && <p className="text-xs text-surface-600 dark:text-navy-400 mt-1">{det.descripcion}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end mt-6 pt-4 border-t border-white/20 dark:border-navy-700/30">
          <button onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 dark:from-brand-dark-500 dark:to-blue-500 text-white font-medium shadow-md text-sm"
          >Cerrar</button>
        </div>
      </div>
    </div>
  );
}
