import { useState, useCallback } from 'react';
import { useQuery } from '@apollo/client/react';
import { X, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { GET_ALL_INCIDENTES_PAGINATED } from '../../lib/queries';

interface CarpetaItem {
  id: string;
  descripcion: string;
  estado: string;
}

interface DetalleIncidente {
  id: string;
  descripcion?: string;
  carpeta?: CarpetaItem;
}

interface IncidenteItem {
  id: string;
  tipoInci: string;
  fechaReporte: string;
  estado: boolean;
  detalles?: DetalleIncidente[];
}

interface Props {
  onClose: () => void;
  onResolver: (carpetaIds: string[]) => Promise<void>;
}

export default function ResolverIncidenteModal({ onClose, onResolver }: Props) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const pageSize = 10;

  const { data: incidentesData, loading: loadingIncidentes, error } = useQuery(GET_ALL_INCIDENTES_PAGINATED, {
    variables: { page, pageSize, search: search || undefined },
    fetchPolicy: 'network-only',
  });

  // Filtrar incidentes activos y aplanar carpetas
  const { carpetas, totalCarpetas } = ((): { carpetas: (CarpetaItem & { incidenteId: string })[], totalCarpetas: number } => {
    const activos = (incidentesData?.allIncidentesPaginated?.items ?? []).filter(
      (inc: IncidenteItem) => inc.estado === true
    );
    const carpetas: (CarpetaItem & { incidenteId: string })[] = [];
    const seen = new Set<string>();
    activos.forEach((inc: IncidenteItem) => {
      (inc.detalles ?? []).forEach((det: DetalleIncidente) => {
        if (det.carpeta && !seen.has(det.carpeta.id)) {
          seen.add(det.carpeta.id);
          carpetas.push({ ...det.carpeta, incidenteId: inc.id });
        }
      });
    });
    return { carpetas, totalCarpetas: carpetas.length };
  })();

  const totalPages = Math.max(1, Math.ceil(totalCarpetas / pageSize));

  const toggleCarpeta = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === carpetas.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(carpetas.map(c => c.id)));
    }
  }, [carpetas, selectedIds.size]);

  const handleResolver = async () => {
    setSaving(true);
    try {
      await onResolver(Array.from(selectedIds));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    setPage(1);
    setSelectedIds(new Set());
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 dark:bg-black/70 backdrop-blur-sm p-4 pt-8">
      <div className="glass-panel rounded-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-surface-800 dark:text-navy-200">Resolver Incidentes</h3>
          <button onClick={onClose}
            className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-100 transition-colors"
          ><X size={20} /></button>
        </div>

        <div className="space-y-4">
          {selectedIds.size > 0 && (
            <div className="mb-2 p-2 rounded-lg bg-brand-50 dark:bg-brand-dark-600/20 border border-brand-200 dark:border-brand-dark-500/30 flex items-center justify-between">
              <span className="text-xs font-medium text-brand-700 dark:text-brand-dark-400">
                {selectedIds.size} carpeta(s) seleccionada(s)
              </span>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-brand-600 dark:text-brand-dark-400 hover:underline"
              >
                Limpiar
              </button>
            </div>
          )}
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-surface-600 dark:text-navy-400">
              {selectedIds.size} de {totalCarpetas} carpeta(s) afectada(s)
            </p>
            {carpetas.length > 0 && (
              <button
                onClick={handleSelectAll}
                className="text-xs text-brand-600 dark:text-brand-dark-400 hover:underline"
              >
                {selectedIds.size === carpetas.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </button>
            )}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500 dark:text-navy-500" size={16} />
            <input type="text" placeholder="Buscar..." value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-sm"
            />
          </div>

          <div className="max-h-48 overflow-y-auto border border-white/20 dark:border-navy-700/30 rounded-xl">
            {error ? (
              <p className="text-sm text-red-500 dark:text-red-400 text-center py-8">Error: {error.message}</p>
            ) : loadingIncidentes ? (
              <div className="flex items-center justify-center py-8 text-sm text-surface-500">
                <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mr-2" />
                Cargando...
              </div>
            ) : carpetas.length === 0 ? (
              <p className="text-sm text-surface-500 dark:text-navy-500 text-center py-8">Sin incidentes activos</p>
            ) : (
              <div className="divide-y divide-white/10 dark:divide-navy-700/20">
                {carpetas.map((c) => (
                  <label key={c.id}
                    className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer text-sm transition-colors ${
                      selectedIds.has(c.id)
                        ? 'bg-brand-50 dark:bg-brand-dark-600/20'
                        : 'hover:bg-white/30 dark:hover:bg-navy-800/50'
                    }`}
                  >
                    <input type="checkbox" checked={selectedIds.has(c.id)}
                      onChange={() => toggleCarpeta(c.id)}
                      className="w-4 h-4 rounded border-surface-300 text-brand-600 focus:ring-brand-400"
                    />
                    <span className="text-surface-800 dark:text-navy-200">{c.descripcion}</span>
                    <span className="ml-auto text-xs text-surface-500 dark:text-navy-400">{c.estado}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-2 text-xs text-surface-500 dark:text-navy-500">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/30 dark:hover:bg-navy-800/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              ><ChevronLeft size={14} /> Anterior</button>
              <span>Pág. {page} de {totalPages} ({totalCarpetas} carpeta(s))</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/30 dark:hover:bg-navy-800/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >Siguiente <ChevronRight size={14} /></button>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/20 dark:border-navy-700/30">
          <button onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-surface-600 dark:text-navy-400 bg-white/60 dark:bg-navy-800/60 border border-white/80 dark:border-navy-700/60 hover:bg-white dark:hover:bg-navy-800 transition-colors text-sm font-medium"
          >Cancelar</button>
          <button onClick={handleResolver} disabled={saving || selectedIds.size === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-500 dark:to-emerald-500 text-white font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
          >{saving ? 'Resolviendo...' : `Resolver ${selectedIds.size} carpeta(s)`}</button>
        </div>
      </div>
    </div>
  );
}