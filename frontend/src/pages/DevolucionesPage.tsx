import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { GET_ALL_DEVOLUCIONES_PAGINATED, GET_ALL_PRESTAMOS_ACTIVOS_PAGINATED,
  CREAR_BLOQUEO,
 } from '../lib/queries';
import { Undo2, Search, Eye, Printer, X } from 'lucide-react';
import { usePermission } from '../context/AuthContext';
import Pagination from '../components/Pagination';
import DevolucionModal, { type BulkItem } from '../components/prestamos/DevolucionModal';
import DevolverCarpetaModal from '../components/prestamos/DevolverCarpetaModal';
import BloqueoModal from '../components/prestamos/BloqueoModal';
import DetalleDevolucionModal from '../components/prestamos/DetalleDevolucionModal';

interface DevolucionItem {
  id: string; fechaDevol: string; observaciones: string; estadoDevolucion: string;
  fotoFirma?: string | null; tokenFirma?: string | null;
  usuario?: { id: string; username: string; firstName: string; lastName: string } | null;
  prestamoCarpeta?: {
    id: string;
    carpeta: { id: string; descripcion: string };
  } | null;
}
interface DevolucionesData { allDevolucionesPaginated: { items: DevolucionItem[]; totalCount: number }; }

interface CrearBloqueoData { crearBloqueo?: { error?: string }; }

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function isOverdue(dateStr: string) {
  return new Date(dateStr) < new Date(new Date().toDateString());
}

export default function DevolucionesPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const itemsPerPage = 10;

  const { data: devolucionesPaginated, refetch: refetchDevoluciones } = useQuery<DevolucionesData>(GET_ALL_DEVOLUCIONES_PAGINATED, {
    variables: { page: currentPage, pageSize: itemsPerPage },
  });
const [crearBloqueo] = useMutation<CrearBloqueoData>(CREAR_BLOQUEO);
  const { data: activosCountData } = useQuery<{ allPrestamosActivosPaginated: { totalCount: number } }>(GET_ALL_PRESTAMOS_ACTIVOS_PAGINATED, {
    variables: { page: 1, pageSize: 1 },
  });
  const activosCount = activosCountData?.allPrestamosActivosPaginated?.totalCount ?? 0;

  const { hasPerm, isAdmin } = usePermission();

  const [showDevolucion, setShowDevolucion] = useState(false);
  const [showBloqueo, setShowBloqueo] = useState<{ personaId: string; personaNombre: string } | null>(null);
  const [selectedDevolucion, setSelectedDevolucion] = useState<DevolucionItem | null>(null);
  const [firmaPreview, setFirmaPreview] = useState<string | null>(null);
  const [devolverItems, setDevolverItems] = useState<BulkItem[] | null>(null);

  const paginatedResult = devolucionesPaginated?.allDevolucionesPaginated;
  const items = useMemo(() => paginatedResult?.items ?? [], [paginatedResult]);
  const totalCount = paginatedResult?.totalCount ?? 0;

  const filteredItems = useMemo(() => {
    let list = items;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((d: DevolucionItem) =>
        (d.prestamoCarpeta?.carpeta?.descripcion ?? '').toLowerCase().includes(q) ||
        (d.usuario?.firstName ?? '').toLowerCase().includes(q) ||
        (d.usuario?.lastName ?? '').toLowerCase().includes(q) ||
        (d.observaciones ?? '').toLowerCase().includes(q)
      );
    }
    if (filterEstado) {
      list = list.filter((d: DevolucionItem) => d.estadoDevolucion === filterEstado);
    }
    return list;
  }, [items, search, filterEstado]);

  const handleBloquear = useCallback(async (personaId: string, motivo: string): Promise<string> => {
    try {
      const { data } = await crearBloqueo({ variables: { personaId, motivo } });
      if (data?.crearBloqueo?.error) throw new Error(data.crearBloqueo.error);
      return '✅ Persona bloqueada correctamente.';
    } catch (err: unknown) {
      return err instanceof Error ? err.message : 'Error al bloquear';
    }
  }, [crearBloqueo]);

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-surface-800 dark:text-navy-200">Devoluciones</h2>
        <div className="flex gap-3">
          {hasPerm('gestionar_devoluciones') && (
            <button onClick={() => setShowDevolucion(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-green-600 to-green-500 dark:from-green-500 dark:to-green-600 text-white font-medium shadow-md shadow-green-500/30 dark:shadow-green-800/30 hover:shadow-lg transition-all text-sm"
            >
              <Undo2 size={16} />
              Registrar Devolución
              {activosCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-xs font-bold">{activosCount}</span>
              )}
            </button>
          )}
        </div>
      </div>

      {isAdmin ? (
        <div className="glass-panel rounded-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-white/20 dark:border-navy-700/30">
            <h3 className="text-lg font-bold text-surface-800 dark:text-navy-200">Historial</h3>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500 dark:text-navy-500" size={16} />
                <input type="text" placeholder="Buscar..." value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-48 pl-9 pr-4 py-2 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 placeholder:text-surface-600 dark:placeholder:text-navy-500 focus:outline-none focus:ring-2 focus:ring-brand-400/50 transition-all text-sm"
                />
              </div>
              <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)}
                className="px-3 py-2 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400/50 transition-all text-sm"
              >
                <option value="">Todos</option>
                <option value="buen_estado">Buen estado</option>
                <option value="mal_estado">Mal estado</option>
                <option value="danado">Dañado</option>
              </select>
              <span className="text-sm text-surface-600 dark:text-navy-500">{totalCount} resultado(s)</span>
            </div>
          </div>
          <div className="overflow-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/20 dark:border-navy-700/30">
                  <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Fecha</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Carpeta</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Estado</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Observaciones</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Registró</th>
                  <th className="text-center px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Foto Firma</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 dark:divide-navy-700/20">
                {filteredItems.map((d: DevolucionItem) => (
                  <tr key={d.id} onClick={() => setSelectedDevolucion(d)}
                    className="cursor-pointer hover:bg-white/30 dark:hover:bg-navy-800/50 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm text-surface-700 dark:text-navy-300 whitespace-nowrap">{formatDate(d.fechaDevol)}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-surface-800 dark:text-navy-200">
                      {d.prestamoCarpeta?.carpeta?.descripcion ?? '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        d.estadoDevolucion === 'buen_estado'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                          : d.estadoDevolucion === 'mal_estado'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                      }`}>
                        {d.estadoDevolucion === 'buen_estado' ? 'Buen estado' : d.estadoDevolucion === 'mal_estado' ? 'Mal estado' : 'Dañado'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-surface-600 dark:text-navy-400 max-w-[200px] truncate">
                      {d.observaciones || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-surface-600 dark:text-navy-400">
                      {d.usuario ? `${d.usuario.firstName} ${d.usuario.lastName}` : '—'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {d.tokenFirma ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); setFirmaPreview(d.tokenFirma!); }}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand-100 dark:bg-brand-dark-600/30 text-brand-600 dark:text-brand-dark-400 hover:bg-brand-200 dark:hover:bg-brand-dark-600/50 transition-colors"
                          title="Ver foto firma"
                        >
                          <Eye size={16} />
                        </button>
                      ) : (
                        <span className="text-surface-400 dark:text-navy-500">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredItems.length === 0 && (
              <div className="text-center py-12 text-surface-500 dark:text-navy-500">
                <p className="text-lg font-medium">{search || filterEstado ? 'Sin resultados' : 'No hay devoluciones registradas'}</p>
              </div>
            )}
          </div>
          <Pagination currentPage={currentPage} totalItems={totalCount} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />
        </div>
      ) : (
        <div className="glass-panel rounded-2xl p-12 text-center">
          <Undo2 size={48} className="mx-auto mb-4 text-surface-400 dark:text-navy-500" />
          <p className="text-lg text-surface-600 dark:text-navy-400">
            Selecciona una carpeta en préstamo para registrar su devolución.
          </p>
        </div>
      )}

{showDevolucion && (
         <DevolucionModal
           onClose={() => setShowDevolucion(false)}
           onBulkDevolver={(items) => {
             setShowDevolucion(false);
             setDevolverItems(items);
           }}
           formatDate={formatDate}
           isOverdue={isOverdue}
         />
       )}

       {devolverItems && (
         <DevolverCarpetaModal
           items={devolverItems}
           formatDate={formatDate}
           onClose={() => setDevolverItems(null)}
           onSuccess={() => {
             setDevolverItems(null);
             refetchDevoluciones();
           }}
         />
       )}

      {showBloqueo && (
        <BloqueoModal
          personaNombre={showBloqueo.personaNombre}
          onClose={() => setShowBloqueo(null)}
          onBloquear={async (motivo) => {
            const res = await handleBloquear(showBloqueo.personaId, motivo);
            if (res.startsWith('✅')) setShowBloqueo(null);
            return res;
          }}
        />
      )}

      {selectedDevolucion && (
        <DetalleDevolucionModal
          devolucion={selectedDevolucion}
          onClose={() => setSelectedDevolucion(null)}
        />
      )}

      {firmaPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setFirmaPreview(null)}>
          <div className="relative max-w-3xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="glass-panel rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-surface-800 dark:text-navy-200">Foto Firma</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const printWin = window.open('', '_blank');
                      if (printWin) {
                        printWin.document.write(`
                          <html><head><title>Foto Firma</title>
                          <style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh}img{max-width:100%;height:auto}</style>
                          </head><body>
                          <img src="/api/firma/imagen/${firmaPreview}/" onload="window.print();window.close()" />
                          </body></html>
                        `);
                        printWin.document.close();
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-colors"
                  >
                    <Printer size={16} />
                    Imprimir
                  </button>
                  <button
                    onClick={() => setFirmaPreview(null)}
                    className="flex items-center justify-center w-8 h-8 rounded-lg bg-surface-200 dark:bg-navy-700 text-surface-600 dark:text-navy-300 hover:bg-surface-300 dark:hover:bg-navy-600 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              <img
                src={`/api/firma/imagen/${firmaPreview}/`}
                alt="Foto Firma"
                className="w-full h-auto rounded-xl bg-white"
                style={{ maxHeight: '70vh', objectFit: 'contain' }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
