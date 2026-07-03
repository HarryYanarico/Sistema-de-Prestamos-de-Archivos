import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  GET_ALL_PRORROGAS_PAGINATED, REGISTRAR_PRORROGA,
} from '../lib/queries';
import { Search, Plus } from 'lucide-react';
import { usePermission } from '../context/AuthContext';
import Pagination from '../components/Pagination';
import RegistrarProrrogaModal from '../components/prorrogas/RegistrarProrrogaModal';
import DetalleProrrogaModal from '../components/prorrogas/DetalleProrrogaModal';

interface ProrrogaItem {
  id: string; fechaRegistro: string; diasOtorgados: number; motivo?: string;
  personaSolicita?: { id: string; nombre: string; apellido: string };
  prestamo?: { persona?: { id: string; nombre: string; apellido: string } };
  usuario?: { id: string; username: string; firstName: string; lastName: string };
}
interface ProrrogasPaginatedData { allProrrogasPaginated: { items: ProrrogaItem[]; totalCount: number }; }
interface MutationProrrogaData { registrarProrroga?: { error?: string }; }

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export default function ProrrogasPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const itemsPerPage = 10;

  const { data: prorrogasPaginated, refetch } = useQuery<ProrrogasPaginatedData>(GET_ALL_PRORROGAS_PAGINATED, {
    variables: { page: currentPage, pageSize: itemsPerPage },
  });
  const [registrar] = useMutation<MutationProrrogaData>(REGISTRAR_PRORROGA);

  const { hasPerm } = usePermission();

  const [showRegistrar, setShowRegistrar] = useState(false);
  const [detalleProrroga, setDetalleProrroga] = useState<ProrrogaItem | null>(null);

  const filteredItems = useMemo(() => {
    const paginatedResult = prorrogasPaginated?.allProrrogasPaginated;
    const items = paginatedResult?.items ?? [];
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter((p: ProrrogaItem) =>
      (p.prestamo?.persona?.nombre ?? '').toLowerCase().includes(q) ||
      (p.prestamo?.persona?.apellido ?? '').toLowerCase().includes(q) ||
      (p.personaSolicita?.nombre ?? '').toLowerCase().includes(q) ||
      (p.personaSolicita?.apellido ?? '').toLowerCase().includes(q) ||
      (p.motivo ?? '').toLowerCase().includes(q)
    );
  }, [prorrogasPaginated, search]);

  const totalCount = prorrogasPaginated?.allProrrogasPaginated?.totalCount ?? 0;

  const handleRegistrar = useCallback(async (vars: { prestamoId: string; personaSolicitaId: string; diasOtorgados: number; motivo?: string }) => {
    try {
      const { data } = await registrar({
        variables: {
          prestamoId: vars.prestamoId,
          personaSolicitaId: vars.personaSolicitaId,
          diasOtorgados: vars.diasOtorgados,
          motivo: vars.motivo,
        },
      });
      if (data?.registrarProrroga?.error) throw new Error(data.registrarProrroga.error);
      refetch();
      return '✅ Prórroga registrada correctamente.';
    } catch (err: unknown) {
      return err instanceof Error ? err.message : 'Error al registrar prórroga';
    }
  }, [registrar, refetch]);

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-surface-800 dark:text-navy-200">Prórrogas</h2>
        <div className="flex gap-3">
          {hasPerm('gestionar_prorrogas') && (
            <button onClick={() => setShowRegistrar(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 dark:from-brand-dark-500 dark:to-blue-500 text-white font-medium shadow-md shadow-brand-500/30 dark:shadow-brand-800/30 hover:shadow-lg transition-all text-sm"
            >
              <Plus size={16} />
              Registrar Prórroga
            </button>
          )}
        </div>
      </div>

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
            <span className="text-sm text-surface-600 dark:text-navy-500">{totalCount} resultado(s)</span>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/20 dark:border-navy-700/30">
                <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Fecha</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Solicitó</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Prestatario</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Días</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Registró</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 dark:divide-navy-700/20">
              {filteredItems.map((p: ProrrogaItem) => (
                <tr key={p.id}
                  className="cursor-pointer hover:bg-white/30 dark:hover:bg-navy-800/50 transition-colors"
                  onClick={() => setDetalleProrroga(p)}
                >
                  <td className="px-6 py-4 text-sm text-surface-700 dark:text-navy-300 whitespace-nowrap">{formatDate(p.fechaRegistro)}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-surface-800 dark:text-navy-200">
                    {p.personaSolicita ? `${p.personaSolicita.nombre} ${p.personaSolicita.apellido}` : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-surface-600 dark:text-navy-400">
                    {p.prestamo?.persona ? `${p.prestamo.persona.nombre} ${p.prestamo.persona.apellido}` : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-surface-700 dark:text-navy-300">{p.diasOtorgados} día(s)</td>
                  <td className="px-6 py-4 text-sm text-surface-600 dark:text-navy-400">
                    {p.usuario ? `${p.usuario.firstName} ${p.usuario.lastName}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredItems.length === 0 && (
            <div className="text-center py-12 text-surface-500 dark:text-navy-500">
              <p className="text-lg font-medium">{search ? 'Sin resultados' : 'No hay prórrogas registradas'}</p>
            </div>
          )}
        </div>
        <Pagination currentPage={currentPage} totalItems={totalCount} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />
      </div>

      {showRegistrar && (
        <RegistrarProrrogaModal
          onClose={() => setShowRegistrar(false)}
          onRegistrar={handleRegistrar}
        />
      )}

      {detalleProrroga && (
        <DetalleProrrogaModal
          prorroga={detalleProrroga}
          onClose={() => setDetalleProrroga(null)}
        />
      )}
    </>
  );
}
