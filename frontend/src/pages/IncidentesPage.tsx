import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  GET_ALL_INCIDENTES_PAGINATED, REGISTRAR_INCIDENTE, RESOLVER_CARPETAS,
} from '../lib/queries';
import { AlertTriangle, CheckCircle, Search, Plus, CheckSquare } from 'lucide-react';
import ResolverIncidenteModal from '../components/incidentes/ResolverIncidenteModal';
import { usePermission } from '../context/AuthContext';
import Pagination from '../components/Pagination';
import RegistrarIncidenteModal from '../components/incidentes/RegistrarIncidenteModal';
import DetalleIncidenteModal from '../components/incidentes/DetalleIncidenteModal';

interface IncidenteDetalleCarpeta {
  id: string;
  descripcion?: string;
  carpeta?: { id: string; descripcion: string; piso?: { id: string; nroFila: number; estante?: { codigo?: string; ambiente?: { nombre?: string } } } };
}
interface IncidenteItem {
  id: string; tipoInci: string; fechaReporte: string; estado: boolean;
  usuario?: { id: string; username: string; firstName: string; lastName: string };
  detalles?: IncidenteDetalleCarpeta[];
}
interface IncidentesPaginatedData { allIncidentesPaginated: { items: IncidenteItem[]; totalCount: number }; }
interface MutationIncidenteData { crearIncidente?: { incidente?: { id: string }; success?: boolean; error?: string }; }

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export default function IncidentesPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState<string>('');
  const itemsPerPage = 10;

  const { data: incidentesPaginated, refetch } = useQuery<IncidentesPaginatedData>(GET_ALL_INCIDENTES_PAGINATED, {
    variables: { page: currentPage, pageSize: itemsPerPage },
  });
  const [crearIncidente] = useMutation<MutationIncidenteData>(REGISTRAR_INCIDENTE);
  const [resolverCarpetas] = useMutation(RESOLVER_CARPETAS);

  const { hasPerm } = usePermission();

  const [showCrear, setShowCrear] = useState(false);
  const [showResolver, setShowResolver] = useState(false);
  const [detalleIncidente, setDetalleIncidente] = useState<IncidenteItem | null>(null);

  const filteredItems = useMemo(() => {
    const paginatedResult = incidentesPaginated?.allIncidentesPaginated;
    const items = paginatedResult?.items ?? [];
    let list = items;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((i: IncidenteItem) =>
        i.tipoInci.toLowerCase().includes(q) ||
        (i.usuario?.firstName ?? '').toLowerCase().includes(q) ||
        (i.usuario?.lastName ?? '').toLowerCase().includes(q)
      );
    }
    if (filterEstado !== '') {
      list = list.filter((i: IncidenteItem) => String(i.estado) === filterEstado);
    }
    return list;
  }, [incidentesPaginated, search, filterEstado]);

  const totalCount = incidentesPaginated?.allIncidentesPaginated?.totalCount ?? 0;

  const handleCrear = useCallback(async (vars: { tipoInci: string; carpetaIds: string[]; descripcion?: string }) => {
    try {
      const { data } = await crearIncidente({
        variables: { tipoInci: vars.tipoInci, carpetaIds: vars.carpetaIds, descripcion: vars.descripcion },
      });
      if (data?.crearIncidente?.error) throw new Error(data.crearIncidente.error);
      refetch();
      return '✅ Incidente registrado correctamente.';
    } catch (err: unknown) {
      return err instanceof Error ? err.message : 'Error al registrar incidente';
    }
  }, [crearIncidente, refetch]);

  const handleResolverCarpetas = useCallback(async (carpetaIds: string[]) => {
    try {
      const { data } = await resolverCarpetas({ variables: { carpetaIds } });
      if (data?.resolverCarpetas?.error) throw new Error(data.resolverCarpetas?.error);
      refetch();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al resolver carpetas');
    }
  }, [resolverCarpetas, refetch]);

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-surface-800 dark:text-navy-200">Incidentes</h2>
        <div className="flex gap-3">
          {hasPerm('gestionar_carpetas') && (
            <>
              <button onClick={() => setShowCrear(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 dark:from-amber-500 dark:to-amber-600 text-white font-medium shadow-md shadow-amber-500/30 dark:shadow-amber-800/30 hover:shadow-lg transition-all text-sm"
              >
                <Plus size={16} />
                Registrar Incidente
              </button>
              <button onClick={() => setShowResolver(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-500 dark:to-emerald-500 text-white font-medium shadow-md shadow-green-500/30 dark:shadow-green-800/30 hover:shadow-lg transition-all text-sm"
              >
                <CheckSquare size={16} />
                Resolver Incidentes
              </button>
            </>
          )}
        </div>
      </div>

      <div className="glass-panel rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-white/20 dark:border-navy-700/30">
          <h3 className="text-lg font-bold text-surface-800 dark:text-navy-200">Listado de Incidentes</h3>
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
              <option value="true">Activos</option>
              <option value="false">Resueltos</option>
            </select>
            <span className="text-sm text-surface-600 dark:text-navy-500">{totalCount} resultado(s)</span>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/20 dark:border-navy-700/30">
                <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Tipo</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Fecha</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Estado</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Carpetas</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Registró</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 dark:divide-navy-700/20">
              {filteredItems.map((inc: IncidenteItem) => (
                <tr key={inc.id}
                  className="hover:bg-white/30 dark:hover:bg-navy-800/50 transition-colors cursor-pointer"
                  onClick={() => setDetalleIncidente(inc)}
                >
                  <td className="px-6 py-4 text-sm font-semibold text-surface-800 dark:text-navy-200">{inc.tipoInci}</td>
                  <td className="px-6 py-4 text-sm text-surface-700 dark:text-navy-300 whitespace-nowrap">{formatDate(inc.fechaReporte)}</td>
                  <td className="px-6 py-4">
                    {inc.estado ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                        <AlertTriangle size={12} /> Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                        <CheckCircle size={12} /> Resuelto
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-surface-600 dark:text-navy-400 truncate max-w-xs" title={inc.detalles?.map(d => d.carpeta?.descripcion).join(', ')}>
                    {inc.detalles?.map(d => d.carpeta?.descripcion).join(', ') || '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-surface-600 dark:text-navy-400">
                    {inc.usuario ? `${inc.usuario.firstName} ${inc.usuario.lastName}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredItems.length === 0 && (
            <div className="text-center py-12 text-surface-500 dark:text-navy-500">
              <p className="text-lg font-medium">{search || filterEstado !== '' ? 'Sin resultados' : 'No hay incidentes registrados'}</p>
            </div>
          )}
        </div>
        <Pagination currentPage={currentPage} totalItems={totalCount} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />
      </div>

      {showCrear && (
        <RegistrarIncidenteModal
          onClose={() => setShowCrear(false)}
          onRegistrar={handleCrear}
        />
      )}

      {showResolver && (
        <ResolverIncidenteModal
          onClose={() => setShowResolver(false)}
          onResolver={handleResolverCarpetas}
        />
      )}

      {detalleIncidente && (
        <DetalleIncidenteModal
          incidente={detalleIncidente}
          onClose={() => setDetalleIncidente(null)}
        />
      )}
    </>
  );
}