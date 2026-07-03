import { useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { X, Undo2, AlertTriangle, Calendar, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { GET_PRESTAMO_CARPETAS_PAGINATED } from '../../lib/queries';
import type { BloqueoInfo } from './BloqueoModal';
import { formatDate } from '../../utils/formatDate';

interface Props {
  prestamo: any;
  onClose: () => void;
  onDevolverIndividual: (data: { pcId: string; carpetaDesc: string; carpetaId: string; personaNombre: string; personaId: string }) => void;
  onBloquear: (data: { personaId: string; personaNombre: string; info: BloqueoInfo }) => void;
  onSolicitarProrroga?: (prestamoId: string) => void;
  isOverdue: (d: string) => boolean;
  hasPerm: (p: string) => boolean;
}

const ITEMS_PER_PAGE = 5;

function calcDiasRetraso(fechaDevolucion: string): number {
  const hoy = new Date(new Date().toDateString());
  const limite = new Date(fechaDevolucion);
  return Math.floor((hoy.getTime() - limite.getTime()) / (1000 * 60 * 60 * 24));
}

function calcDiasEntre(fecha: string, referencia: string): number {
  return Math.floor(
    (new Date(fecha).getTime() - new Date(referencia).getTime()) / (1000 * 60 * 60 * 24)
  );
}

export default function DetallePrestamoModal({ prestamo, onClose, onDevolverIndividual, onBloquear, onSolicitarProrroga, isOverdue, hasPerm }: Props) {
  const [page, setPage] = useState(0);
  const { data, loading } = useQuery(GET_PRESTAMO_CARPETAS_PAGINATED, {
    variables: { prestamoId: prestamo.id, page: page + 1, pageSize: ITEMS_PER_PAGE },
    fetchPolicy: 'network-only',
  });

  const items = data?.prestamoCarpetasPaginated?.items ?? [];
  const totalCount = data?.prestamoCarpetasPaginated?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));
  const startItem = page * ITEMS_PER_PAGE + 1;
  const endItem = Math.min((page + 1) * ITEMS_PER_PAGE, totalCount);

  const prestamoCarpetas = prestamo.prestamoCarpetas || [];
  const tienePendientes = prestamoCarpetas.some((pc: any) => pc.estado !== 'devuelto');

  const handleBloquear = () => {
    const diasRetraso = calcDiasRetraso(prestamo.fechaDevolucion);
    const itemsVencidos = prestamoCarpetas
      .filter((pc: any) => pc.estado !== 'devuelto')
      .map((pc: any) => ({
        descripcion: pc.carpeta?.descripcion || '??',
      }));
    onBloquear({
      personaId: prestamo.persona.id,
      personaNombre: `${prestamo.persona.nombre} ${prestamo.persona.apellido}`,
      info: {
        persona: {
          nombre: prestamo.persona.nombre,
          apellido: prestamo.persona.apellido,
          ci: prestamo.persona.ci,
          telefono: prestamo.persona.telefono,
          email: prestamo.persona.email,
        },
        fechaPrest: prestamo.fechaPrest,
        fechaDevolucion: prestamo.fechaDevolucion,
        diasRetraso,
        itemsVencidos,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/70 backdrop-blur-sm p-4">
      <div className="glass-panel rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-surface-800 dark:text-navy-200">Detalle del Préstamo</h3>
          <button onClick={onClose}
            className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-400 transition-colors"
          ><X size={20} /></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="glass-card rounded-xl p-4">
            <p className="text-xs text-surface-600 dark:text-navy-500 mb-1">Fecha de préstamo</p>
            <p className="font-semibold text-surface-800 dark:text-navy-200">{formatDate(prestamo.fechaPrest)}</p>
          </div>
          <div className="glass-card rounded-xl p-4">
            <p className="text-xs text-surface-600 dark:text-navy-500 mb-1">Fecha de devolución</p>
            <p className="font-semibold text-surface-800 dark:text-navy-200">{formatDate(prestamo.fechaDevolucion)}</p>
          </div>
        </div>

        <div className="glass-card rounded-xl p-4 mb-4">
          <p className="text-xs text-surface-600 dark:text-navy-500 mb-2">Persona que recibe</p>
          <p className="font-semibold text-surface-800 dark:text-navy-200 text-lg">{prestamo.persona.nombre} {prestamo.persona.apellido}</p>
          <div className="text-sm text-surface-600 dark:text-navy-500 space-y-0.5 mt-1">
            <p>CI: {prestamo.persona.ci}</p>
            <p>Tel: {prestamo.persona.telefono || '—'}</p>
            <p>Email: {prestamo.persona.email || '—'}</p>
          </div>
        </div>

        {prestamo.autorizadoPor && (
          <div className="glass-card rounded-xl p-4 mb-4 border border-amber-100 dark:border-amber-800">
            <p className="text-xs text-surface-600 dark:text-navy-500 mb-2">Autorizado por</p>
            <p className="font-semibold text-surface-800 dark:text-navy-200">{prestamo.autorizadoPor.nombre} {prestamo.autorizadoPor.apellido}</p>
            <span className="mt-1 inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">{prestamo.autorizadoPor.cargo}</span>
          </div>
        )}

        <div className="glass-card rounded-xl p-4 mb-4">
          <p className="text-xs text-surface-600 dark:text-navy-500 mb-2">Registrado por</p>
          <p className="font-semibold text-surface-800 dark:text-navy-200">
            {prestamo.usuario ? `${prestamo.usuario.firstName} ${prestamo.usuario.lastName} (@${prestamo.usuario.username})` : '—'}
          </p>
        </div>

        {isOverdue(prestamo.fechaDevolucion) && tienePendientes && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
            <AlertTriangle size={16} />
            Este préstamo está <strong>vencido</strong> —
            <button onClick={handleBloquear}
              className="underline font-semibold hover:text-red-800"
            >Bloquear a {prestamo.persona.nombre}</button>
          </div>
        )}

        {prestamo.observaciones && (
          <div className="glass-card rounded-xl p-4 mb-4">
            <p className="text-xs text-surface-600 dark:text-navy-500 mb-2">Observaciones</p>
            <p className="text-surface-700 dark:text-navy-300">{prestamo.observaciones}</p>
          </div>
        )}

        {onSolicitarProrroga && (
          <div className="mb-4">
            <button onClick={() => onSolicitarProrroga(prestamo.id)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 dark:from-brand-dark-500 dark:to-blue-500 text-white font-medium shadow-md hover:shadow-lg transition-all text-sm"
            ><Calendar size={16} /> Solicitar Prórroga</button>
          </div>
        )}

        <div className="glass-card rounded-xl p-4">
          <p className="text-xs text-surface-600 dark:text-navy-500 mb-3">Carpetas ({totalCount})</p>
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 size={24} className="animate-spin text-brand-600" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-surface-500 dark:text-navy-500">Sin carpetas</p>
          ) : (
            <div className="space-y-2">
              {items.map((pc: {
                id: string; estado: string; fechaDevol?: string;
                carpeta: { id: string; descripcion: string; estado: boolean; piso?: { nroFila: number; descripcion: string; estante: { codigo: string; ambiente: { nombre: string } } } };
              }) => {
                const c = pc.carpeta;
                return (
                  <div key={pc.id} className="flex items-center justify-between p-3 rounded-xl bg-white/50 dark:bg-navy-800/50 border border-white/40 dark:border-navy-700/40">
                    <div>
                      <p className="font-semibold text-surface-800 dark:text-navy-200 text-sm">{c.descripcion}</p>
                      {c.piso && <p className="text-xs text-surface-500 dark:text-navy-500 mt-0.5">{c.piso.estante.ambiente.nombre} / {c.piso.estante.codigo} / Fila {c.piso.nroFila}</p>}
                    </div>
                    {pc.estado === 'devuelto' ? (
                      (() => {
                        const diff = pc.fechaDevol ? calcDiasEntre(pc.fechaDevol, prestamo.fechaDevolucion) : 0;
                        const conRetraso = diff > 0;
                        return (
                          <div className="flex flex-col items-end gap-0.5">
                            {pc.fechaDevol && <span className="text-[10px] text-surface-500 dark:text-navy-500">{formatDate(pc.fechaDevol)}</span>}
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              conRetraso
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                            }`}>
                              {conRetraso ? `Devuelto con ${diff} día(s) de retraso` : 'Devuelto'}
                            </span>
                          </div>
                        );
                      })()
                    ) : hasPerm('gestionar_devoluciones') ? (
                      <button onClick={() => onDevolverIndividual({
                        pcId: pc.id,
                        carpetaDesc: c.descripcion,
                        carpetaId: c.id,
                        personaNombre: `${prestamo.persona.nombre} ${prestamo.persona.apellido}`,
                        personaId: prestamo.persona.id,
                      })}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 dark:bg-brand-dark-500 text-white text-xs font-semibold hover:bg-brand-500 dark:hover:bg-brand-dark-600 transition-all shadow-sm"
                      ><Undo2 size={14} /> Devolver</button>
                    ) : null}
                  </div>
                );
              })}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-3 border-t border-white/10 dark:border-navy-700/20">
                  <p className="text-xs text-surface-500 dark:text-navy-500">
                    Mostrando {startItem}-{endItem} de {totalCount}
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
          )}
        </div>
      </div>
    </div>
  );
}
