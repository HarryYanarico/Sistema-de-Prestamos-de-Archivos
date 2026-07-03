import { useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { ChevronRight, X, AlertTriangle, ChevronLeft, Loader2 } from 'lucide-react';
import { GET_ALL_PRESTAMOS_VENCIDOS_PAGINATED } from '../../lib/queries';

interface PrestamoCarpetaVencido {
  id: string; estado: string;
  carpeta?: { id: string; descripcion: string };
}
interface PrestamoVencido {
  id: string; fechaPrest: string; fechaDevolucion: string;
  persona: { id: string; nombre: string; apellido: string; ci: string };
  carpetas: { id: string; descripcion: string }[];
  prestamoCarpetas: PrestamoCarpetaVencido[];
}

interface Props {
  onClose: () => void;
  onSelect: (p: PrestamoVencido) => void;
  formatDate: (d: string) => string;
}

const ITEMS_PER_PAGE = 10;

export default function PrestamosVencidosModal({ onClose, onSelect, formatDate }: Props) {
  const [page, setPage] = useState(0);
  const { data, loading } = useQuery(GET_ALL_PRESTAMOS_VENCIDOS_PAGINATED, {
    variables: { page: page + 1, pageSize: ITEMS_PER_PAGE },
    fetchPolicy: 'network-only',
  });

  const items = data?.allPrestamosVencidosPaginated?.items ?? [];
  const totalCount = data?.allPrestamosVencidosPaginated?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/70 backdrop-blur-sm p-4">
      <div className="glass-panel rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-surface-800 dark:text-navy-200 flex items-center gap-2">
              <AlertTriangle size={22} className="text-red-500" />
              Préstamos Vencidos
            </h3>
            <p className="text-xs text-surface-600 dark:text-navy-500 mt-0.5">
              {totalCount} préstamo(s) con fecha de devolución vencida
            </p>
          </div>
          <button onClick={onClose}
            className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-400 transition-colors"
          ><X size={20} /></button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin text-brand-600" />
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((p: PrestamoVencido) => {
              const daysOverdue = Math.floor(
                (new Date(new Date().toDateString()).getTime() - new Date(p.fechaDevolucion).getTime()) / (1000 * 60 * 60 * 24)
              );
              return (
                <button key={p.id} onClick={() => { onSelect(p); onClose(); }}
                  className="w-full text-left p-4 rounded-xl bg-white/50 dark:bg-navy-800/50 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-700 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-surface-800 dark:text-navy-200 text-sm">
                        {p.persona.nombre} {p.persona.apellido}
                      </p>
                      <div className="text-xs text-surface-600 dark:text-navy-500 mt-1 space-y-0.5">
                        <p>Préstamo: {formatDate(p.fechaPrest)} — Devolución: {formatDate(p.fechaDevolucion)}</p>
                        <p>CI: {p.persona.ci} · {p.carpetas.length} carpeta(s)</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 whitespace-nowrap">
                        {daysOverdue} día{daysOverdue !== 1 ? 's' : ''} vencido
                      </span>
                      <ChevronRight size={16} className="text-surface-400 dark:text-navy-500" />
                    </div>
                  </div>
                </button>
              );
            })}
            {items.length === 0 && (
              <div className="text-center py-12 text-surface-500 dark:text-navy-500">
                <p className="text-lg font-medium">No hay préstamos vencidos</p>
              </div>
            )}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/10 dark:border-navy-700/20">
            <p className="text-xs text-surface-500 dark:text-navy-500">
              Página {page + 1} de {totalPages} ({totalCount} resultados)
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 0}
                className="p-1.5 rounded-lg text-surface-500 dark:text-navy-500 hover:bg-white/30 dark:hover:bg-navy-800/50 hover:text-surface-800 dark:hover:text-navy-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-medium text-surface-600 dark:text-navy-400">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg text-surface-500 dark:text-navy-500 hover:bg-white/30 dark:hover:bg-navy-800/50 hover:text-surface-800 dark:hover:text-navy-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
