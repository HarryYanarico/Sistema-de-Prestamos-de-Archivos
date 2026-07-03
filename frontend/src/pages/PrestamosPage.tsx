import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  GET_ALL_PERSONAS, GET_ALL_CARPETAS, REGISTRAR_PRESTAMO,
  GET_ALL_PRESTAMOS_PAGINATED, GET_ALL_PRESTAMOS_VENCIDOS_PAGINATED,
  GET_ALL_PRESTAMOS_ACTIVOS_PAGINATED,
  CREAR_BLOQUEO,
} from '../lib/queries';
import {
  BookOpenCheck, AlertTriangle, RotateCcw,
} from 'lucide-react';
import { formatDate } from '../utils/formatDate';
import { usePermission } from '../context/AuthContext';
import Pagination from '../components/Pagination';
import PrestamosVencidosModal from '../components/prestamos/PrestamosVencidosModal';
import DetallePrestamoModal from '../components/prestamos/DetallePrestamoModal';
import PrestamosPendientesModal from '../components/prestamos/PrestamosPendientesModal';
import DevolucionModal, { type BulkItem } from '../components/prestamos/DevolucionModal';
import DevolverCarpetaModal from '../components/prestamos/DevolverCarpetaModal';
import BloqueoModal from '../components/prestamos/BloqueoModal';
import type { BloqueoInfo } from '../components/prestamos/BloqueoModal';
import NuevaPersonaModal from '../components/prestamos/NuevaPersonaModal';
import RegistrarPrestamoModal from '../components/prestamos/RegistrarPrestamoModal';

interface PrestamoCarpetaItem {
  id: string; estado: string;
  carpeta?: { id: string; descripcion: string };
}
interface PrestamoItem {
  id: string; fechaPrest: string; fechaDevolucion: string; observaciones?: string;
  persona: { id: string; ci: string; nombre: string; apellido: string; telefono?: string; email?: string };
  usuario?: { id: string; username: string; firstName: string; lastName: string };
  autorizadoPor?: { id: string; nombre: string; apellido: string; cargo: string };
  carpetas: { id: string; descripcion: string; estado: string }[];
  prestamoCarpetas: PrestamoCarpetaItem[];
}
interface PrestamosPaginatedData { allPrestamosPaginated: { items: PrestamoItem[]; totalCount: number }; }
interface PrestamosVencidosPaginatedData { allPrestamosVencidosPaginated: { items: unknown[]; totalCount: number }; }
interface PrestamosActivosPaginatedData { allPrestamosActivosPaginated: { items: unknown[]; totalCount: number }; }
interface PersonaSimple {
  id: string; ci: string; nombre: string; apellido: string;
  telefono?: string; email?: string; cargo?: string;
}
interface AllPersonasData { allPersonas: PersonaSimple[]; }
interface CarpetaSimple {
  id: string; descripcion: string; fechaCrea: string; estado: string;
  piso: { id: string; nroFila: number; estante: { id: string; codigo: string; ambiente: { id: string; nombre: string } } };
}
interface AllCarpetasData { allCarpetas: CarpetaSimple[]; }
interface MutationRegistrarData { registrarPrestamo?: { error?: string; warning?: string }; }
interface MutationCrearBloqueoData { crearBloqueo?: { error?: string }; }

function isOverdue(dateStr: string) {
  return new Date(dateStr) < new Date(new Date().toDateString());
}

export default function PrestamosPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { data: prestamosPaginated, refetch: refetchPrestamosPaginated } = useQuery<PrestamosPaginatedData>(GET_ALL_PRESTAMOS_PAGINATED, {
    variables: { page: currentPage, pageSize: itemsPerPage },
  });
  const { data: vencidosCountData } = useQuery<PrestamosVencidosPaginatedData>(GET_ALL_PRESTAMOS_VENCIDOS_PAGINATED, {
    variables: { page: 1, pageSize: 1 },
  });
  const vencidosCount = vencidosCountData?.allPrestamosVencidosPaginated?.totalCount ?? 0;
  const { data: activosCountData } = useQuery<PrestamosActivosPaginatedData>(GET_ALL_PRESTAMOS_ACTIVOS_PAGINATED, {
    variables: { page: 1, pageSize: 1 },
  });
  const activosCount = activosCountData?.allPrestamosActivosPaginated?.totalCount ?? 0;

  const { data: ultimosPrestamosData } = useQuery<PrestamosPaginatedData>(GET_ALL_PRESTAMOS_PAGINATED, {
    variables: { page: 1, pageSize: 3 },
  });

  const { data: personasData } = useQuery<AllPersonasData>(GET_ALL_PERSONAS);
  const { data: carpetasData } = useQuery<AllCarpetasData>(GET_ALL_CARPETAS);
  const [registrar] = useMutation<MutationRegistrarData>(REGISTRAR_PRESTAMO);
  const [crearBloqueo] = useMutation<MutationCrearBloqueoData>(CREAR_BLOQUEO);

  const { hasPerm, isAdmin } = usePermission();

  const personas = personasData?.allPersonas ?? [];
  const carpetasDisponibles = (carpetasData?.allCarpetas ?? []).filter((c: CarpetaSimple) => c.estado === 'disponible');
  const personasConCargo = personas.filter((p: PersonaSimple) => p.cargo);
  const ultimasPersonas = ultimosPrestamosData?.allPrestamosPaginated?.items
    ? [...new Map(
        ultimosPrestamosData.allPrestamosPaginated.items.map((p) => [p.persona.id, p.persona])
      ).values()]
    : [];

  // ---- Modal visibility ----
  const [showForm, setShowForm] = useState(false);
  const [showVencidos, setShowVencidos] = useState(false);
  const [showDevolucion, setShowDevolucion] = useState(false);
  const [showNewPersona, setShowNewPersona] = useState(false);

  // ---- Detail / devolucion / bloqueo state ----
  const [selectedPrestamo, setSelectedPrestamo] = useState<PrestamoItem | null>(null);
  const [vencidoPendientes, setVencidoPendientes] = useState<{
    persona: { id: string; nombre: string; apellido: string; ci: string; telefono?: string; email?: string };
    items: { descripcion: string; fechaPrest: string; fechaDevolucion: string; diasRetraso: number }[];
  } | null>(null);
  const [devolverItems, setDevolverItems] = useState<BulkItem[] | null>(null);
  const [showBloqueo, setShowBloqueo] = useState<{ personaId: string; personaNombre: string; info?: BloqueoInfo } | null>(null);

  const paginatedResult = prestamosPaginated?.allPrestamosPaginated;
  const paginadosPrestamos = paginatedResult?.items ?? [];
  const totalPrestamos = paginatedResult?.totalCount ?? 0;

  // ---- Handlers ----
  const handleRegistrar = useCallback(async (vars: Record<string, unknown>): Promise<{ error?: string; warning?: string; tokenFirma?: string }> => {
    try {
      const { data: res } = await registrar({ variables: vars });
      if (res?.registrarPrestamo?.error) return { error: res.registrarPrestamo.error };
      refetchPrestamosPaginated();
      const warning = res?.registrarPrestamo?.warning;
      if (warning) return { warning, tokenFirma: res?.registrarPrestamo?.tokenFirma };
      return { tokenFirma: res?.registrarPrestamo?.tokenFirma };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Error al registrar' };
    }
  }, [registrar, refetchPrestamosPaginated]);

  const refetchAll = useCallback(() => {
    refetchPrestamosPaginated();
  }, [refetchPrestamosPaginated]);

  const handleBloquear = useCallback(async (personaId: string, motivo: string): Promise<string> => {
    try {
      const { data } = await crearBloqueo({
        variables: { personaId, motivo },
      });
      if (data?.crearBloqueo?.error) throw new Error(data.crearBloqueo.error);
      return '✅ Persona bloqueada correctamente.';
    } catch (err: unknown) {
      return err instanceof Error ? err.message : 'Error al bloquear';
    }
  }, [crearBloqueo]);

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-surface-800 dark:text-navy-200">Préstamos</h2>
        <div className="flex gap-3">
          {vencidosCount > 0 && (
            <button onClick={() => setShowVencidos(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-500 dark:from-red-500 dark:to-red-600 text-white font-medium shadow-md shadow-red-500/30 dark:shadow-red-800/30 hover:shadow-lg transition-all text-sm"
            >
              <AlertTriangle size={16} />
              Préstamos Vencidos
              <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-xs font-bold">{vencidosCount}</span>
            </button>
          )}
          {hasPerm('gestionar_devoluciones') && (
            <button onClick={() => setShowDevolucion(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-green-600 to-green-500 dark:from-green-500 dark:to-green-600 text-white font-medium shadow-md shadow-green-500/30 dark:shadow-green-800/30 hover:shadow-lg transition-all text-sm"
            >
              <RotateCcw size={16} />
              Registrar Devolución
              {activosCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-xs font-bold">{activosCount}</span>
              )}
            </button>
          )}
          {hasPerm('gestionar_prestamos') && (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 dark:from-brand-dark-500 dark:to-blue-500 text-white font-medium shadow-md shadow-brand-500/30 dark:shadow-brand-dark-600/20 hover:shadow-lg transition-all text-sm"
            >
              <BookOpenCheck size={16} />
              Registrar Préstamo
            </button>
          )}
        </div>
      </div>

      <div className="glass-panel rounded-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/20 dark:border-navy-700/30">
          <h3 className="text-lg font-bold text-surface-800 dark:text-navy-200">Préstamos</h3>
          <span className="text-sm text-surface-600 dark:text-navy-500">{totalPrestamos} resultado(s)</span>
        </div>
        <div className="overflow-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/20 dark:border-navy-700/30">
                <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Fecha</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Persona</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Carpetas</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Devolución</th>
                {isAdmin && <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Registró</th>}
                <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Autorizó</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 dark:divide-navy-700/20">
              {paginadosPrestamos.map((p) => (
                  <tr key={p.id} onClick={() => setSelectedPrestamo(p)}
                    className="hover:bg-white/30 dark:hover:bg-navy-800/50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 text-sm text-surface-700 dark:text-navy-300">{formatDate(p.fechaPrest)}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-surface-800 dark:text-navy-200">{p.persona.nombre} {p.persona.apellido}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {p.carpetas.map((c) => (
                          <span key={c.id} className="px-2 py-0.5 rounded-md text-xs bg-surface-100 dark:bg-navy-800 text-surface-600 dark:text-navy-400">{c.descripcion}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-surface-600 dark:text-navy-400">{formatDate(p.fechaDevolucion)}</td>
                    {isAdmin && <td className="px-6 py-4 text-sm text-surface-600 dark:text-navy-400">{p.usuario ? `${p.usuario.firstName} ${p.usuario.lastName}` : '—'}</td>}
                    <td className="px-6 py-4 text-sm text-surface-600 dark:text-navy-400">
                      {p.autorizadoPor ? (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-brand-100 dark:bg-brand-dark-600/20 text-brand-700 dark:text-brand-dark-400">
                          {p.autorizadoPor.nombre} {p.autorizadoPor.apellido} ({p.autorizadoPor.cargo})
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {totalPrestamos === 0 && (
            <div className="text-center py-12 text-surface-500 dark:text-navy-500">
              <p className="text-lg font-medium">No hay préstamos registrados</p>
            </div>
          )}
          </div>
          <Pagination currentPage={currentPage} totalItems={totalPrestamos} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />
      </div>

      {showVencidos && (
        <PrestamosVencidosModal
          onClose={() => setShowVencidos(false)}
          onSelect={(p) => {
            const items = (p.prestamoCarpetas || [])
              .filter((pc: PrestamoCarpetaItem) => pc.estado !== 'devuelto')
              .map((pc: PrestamoCarpetaItem) => {
                const diasRetraso = Math.max(0, Math.floor(
                  (new Date(new Date().toDateString()).getTime() - new Date(p.fechaDevolucion).getTime()) / (1000 * 60 * 60 * 24)
                ));
                return {
                  descripcion: pc.carpeta?.descripcion || '??',
                  fechaPrest: p.fechaPrest,
                  fechaDevolucion: p.fechaDevolucion,
                  diasRetraso,
                };
              });
            setVencidoPendientes({
              persona: p.persona,
              items,
            });
          }}
          formatDate={formatDate}
        />
      )}

      {selectedPrestamo && (
        <DetallePrestamoModal
          prestamo={selectedPrestamo}
          onClose={() => setSelectedPrestamo(null)}
          onDevolverIndividual={(data) => {
            setSelectedPrestamo(null);
            setDevolverItems([{
              pcId: data.pcId,
              carpetaDesc: data.carpetaDesc,
              carpetaId: data.carpetaId,
              personaNombre: data.personaNombre,
              personaId: data.personaId,
              prestamoId: selectedPrestamo?.id ?? '',
              fechaPrest: selectedPrestamo?.fechaPrest ?? '',
              fechaDevolucion: selectedPrestamo?.fechaDevolucion ?? '',
            }]);
          }}
          onBloquear={(data) => setShowBloqueo({ personaId: data.personaId, personaNombre: data.personaNombre, info: data.info })}
          isOverdue={isOverdue}
          hasPerm={hasPerm}
        />
      )}

      {vencidoPendientes && (
        <PrestamosPendientesModal
          persona={vencidoPendientes.persona}
          items={vencidoPendientes.items}
          type="carpetas"
          onClose={() => setVencidoPendientes(null)}
          onBloquear={hasPerm('gestionar_bloqueos') ? handleBloquear : undefined}
        />
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
            refetchAll();
          }}
        />
      )}

      {showBloqueo && (
        <BloqueoModal
          personaNombre={showBloqueo.personaNombre}
          info={showBloqueo.info}
          onClose={() => setShowBloqueo(null)}
          onBloquear={async (motivo) => {
            const res = await handleBloquear(showBloqueo.personaId, motivo);
            if (res.startsWith('✅')) setShowBloqueo(null);
            return res;
          }}
        />
      )}

      <NuevaPersonaModal
        show={showNewPersona}
        onClose={() => setShowNewPersona(false)}
        onCreated={() => {
          const input = document.querySelector<HTMLInputElement>('[data-search-persona]');
          if (input) input.value = '';
        }}
      />

      <RegistrarPrestamoModal
        show={showForm}
        onClose={() => setShowForm(false)}
        personas={personas}
        ultimasPersonas={ultimasPersonas}
        carpetasDisponibles={carpetasDisponibles}
        personasConCargo={personasConCargo}
        hasPerm={hasPerm}
        onRegistrar={handleRegistrar}
        onShowNewPersona={() => setShowNewPersona(true)}
        onBloquear={hasPerm('gestionar_bloqueos') ? handleBloquear : undefined}
      />
    </>
  );
}
