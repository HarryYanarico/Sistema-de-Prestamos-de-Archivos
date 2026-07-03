import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  GET_ALL_PERSONAS, REGISTRAR_PRESTAMO_DOC,
  GET_ALL_PRESTAMOS_DOC_PAGINATED, GET_ALL_PRESTAMOS_DOC_VENCIDOS_PAGINATED,
  REGISTRAR_PRORROGA_DOC, CREAR_BLOQUEO,
} from '../lib/queries';
import {
  BookOpenCheck, AlertTriangle, Calendar, X, Search, Undo2,
} from 'lucide-react';
import { usePermission } from '../context/AuthContext';
import Pagination from '../components/Pagination';
import PrestamosDocVencidosModal from '../components/prestamos/PrestamosDocVencidosModal';
import BloqueoModal from '../components/prestamos/BloqueoModal';
import type { BloqueoInfo } from '../components/prestamos/BloqueoModal';
import PrestamosPendientesModal from '../components/prestamos/PrestamosPendientesModal';
import RegistrarPrestamoDocModal from '../components/prestamos/RegistrarPrestamoDocModal';
import DevolverDocModal from '../components/prestamos/DevolverDocModal';
import DetallePrestamoDocModal from '../components/prestamos/DetallePrestamoDocModal';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function isOverdue(dateStr: string) {
  return new Date(dateStr) < new Date(new Date().toDateString());
}

function calcDiasRetraso(fechaDevolucion: string): number {
  const hoy = new Date(new Date().toDateString());
  const limite = new Date(fechaDevolucion);
  return Math.floor((hoy.getTime() - limite.getTime()) / (1000 * 60 * 60 * 24));
}

interface ItemPrestamoDoc {
  id: string; estado: string; fechaDevol?: string;
  documento?: { id: string; codigoDoc?: string; titulo?: string; tipoDoc?: string };
}
interface PersonaPrestamo {
  id: string; ci: string; nombre: string; apellido: string;
  telefono?: string; email?: string; cargo?: string;
}
interface PrestamoDocItem {
  id: string; fechaPrest: string; fechaDevolucion: string; observaciones?: string;
  persona: PersonaPrestamo;
  usuario?: { id: string; username: string; firstName: string; lastName: string };
  autorizadoPor?: { id: string; nombre: string; apellido: string; cargo: string };
  items: ItemPrestamoDoc[];
  tokenFirma?: string;
  fotoFirma?: string;
}
interface PrestamosDocPaginatedData { allPrestamosDocPaginated: { items: PrestamoDocItem[]; totalCount: number }; }
interface PrestamosDocVencidosPaginatedData { allPrestamosDocVencidosPaginated: { items: PrestamoDocItem[]; totalCount: number }; }
interface AllPersonasData { allPersonas: PersonaPrestamo[]; }
interface MutationPrestamoDocData { registrarPrestamoDoc?: { error?: string; tokenFirma?: string }; }

interface MutationProrrogaDocData { registrarProrrogaDoc?: { error?: string }; }
interface CrearBloqueoData { crearBloqueo?: { error?: string }; }
interface DevolucionDocItem extends ItemPrestamoDoc {
  personaNombre: string;
  observacionesIniciales?: string;
  selectedItems?: { id: string; codigoDoc?: string; titulo?: string; tipoDoc?: string }[];
}

function buildBloqueoInfo(p: PrestamoDocItem): BloqueoInfo {
  const itemsVencidos = (p.items || [])
    .filter((item: ItemPrestamoDoc) => item.estado !== 'devuelto')
    .map((item: ItemPrestamoDoc) => ({
      descripcion: item.documento?.codigoDoc
        ? `${item.documento.codigoDoc} — ${item.documento.titulo || ''}`
        : item.documento?.titulo || `Doc #${item.documento?.id}`,
    }));
  return {
    persona: {
      nombre: p.persona.nombre,
      apellido: p.persona.apellido,
      ci: p.persona.ci,
      telefono: p.persona.telefono,
      email: p.persona.email,
    },
    fechaPrest: p.fechaPrest,
    fechaDevolucion: p.fechaDevolucion,
    diasRetraso: calcDiasRetraso(p.fechaDevolucion),
    itemsVencidos,
  };
}

export default function PrestamosDocPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const itemsPerPage = 10;

  const { data: prestamosPaginated, refetch } = useQuery<PrestamosDocPaginatedData>(GET_ALL_PRESTAMOS_DOC_PAGINATED, {
    variables: { page: currentPage, pageSize: itemsPerPage },
  });
  const { data: vencidosCountData } = useQuery<PrestamosDocVencidosPaginatedData>(GET_ALL_PRESTAMOS_DOC_VENCIDOS_PAGINATED, {
    variables: { page: 1, pageSize: 1 },
  });
  const vencidosCount = vencidosCountData?.allPrestamosDocVencidosPaginated?.totalCount ?? 0;

  const { data: ultimosPrestamosData } = useQuery<PrestamosDocPaginatedData>(GET_ALL_PRESTAMOS_DOC_PAGINATED, {
    variables: { page: 1, pageSize: 3 },
  });

  const { data: personasData } = useQuery<AllPersonasData>(GET_ALL_PERSONAS);
  const [registrarPrestamo] = useMutation<MutationPrestamoDocData>(REGISTRAR_PRESTAMO_DOC);
  const [crearBloqueo] = useMutation<CrearBloqueoData>(CREAR_BLOQUEO);
  const [registrarProrroga] = useMutation<MutationProrrogaDocData>(REGISTRAR_PRORROGA_DOC);

  const { hasPerm } = usePermission();
  const personas = personasData?.allPersonas ?? [];
  const personasConCargo = personas.filter((p) => p.cargo);
  const ultimasPersonas = ultimosPrestamosData?.allPrestamosDocPaginated?.items
    ? [...new Map(
        ultimosPrestamosData.allPrestamosDocPaginated.items.map((p) => [p.persona.id, p.persona])
      ).values()]
    : [];

  const paginatedResult = prestamosPaginated?.allPrestamosDocPaginated;
  const items = paginatedResult?.items ?? [];
  const totalCount = paginatedResult?.totalCount ?? 0;

  const filteredItems = items.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchPersona = p.persona.nombre.toLowerCase().includes(q)
      || p.persona.apellido.toLowerCase().includes(q);
    const matchDoc = p.items?.some((item) =>
      item.documento?.codigoDoc?.toLowerCase().includes(q)
    );
    return matchPersona || matchDoc;
  });

  const [showForm, setShowForm] = useState(false);
  const [showVencidos, setShowVencidos] = useState(false);
  const [selectedPrestamo, setSelectedPrestamo] = useState<PrestamoDocItem | null>(null);

  const [prorrogaPrestamoId, setProrrogaPrestamoId] = useState<string | null>(null);
  const [prorrogaPersonaId, setProrrogaPersonaId] = useState('');
  const [prorrogaDias, setProrrogaDias] = useState('');
  const [prorrogaMotivo, setProrrogaMotivo] = useState('');
  const [prorrogaError, setProrrogaError] = useState('');
  const [prorrogaSaving, setProrrogaSaving] = useState(false);

  const [devolucionItem, setDevolucionItem] = useState<DevolucionDocItem | null>(null);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [showBloqueo, setShowBloqueo] = useState<{ personaId: string; personaNombre: string; info?: BloqueoInfo } | null>(null);
  const [vencidoDocPendientes, setVencidoDocPendientes] = useState<{
    persona: { id: string; nombre: string; apellido: string; ci: string; telefono?: string; email?: string };
    items: { descripcion: string; fechaPrest: string; fechaDevolucion: string; diasRetraso: number }[];
  } | null>(null);
  const handleRegistrarDoc = useCallback(async (vars: Record<string, unknown>): Promise<{ error?: string; tokenFirma?: string }> => {
    try {
      const { data } = await registrarPrestamo({ variables: vars });
      if (data?.registrarPrestamoDoc?.error) return { error: data.registrarPrestamoDoc.error };
      refetch();
      return { tokenFirma: data?.registrarPrestamoDoc?.tokenFirma };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Error al registrar' };
    }
  }, [registrarPrestamo, refetch]);

  const handleDevolverAbrir = (item: ItemPrestamoDoc) => {
    if (!selectedPrestamo) return;
    setDevolucionItem({
      ...item,
      personaNombre: `${selectedPrestamo.persona.nombre} ${selectedPrestamo.persona.apellido}`,
    });
  };

  const toggleDocSelection = (itemId: string) => {
    setSelectedDocIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const handleDevolverSeleccionados = () => {
    if (!selectedPrestamo || selectedDocIds.size === 0) return;
    const firstItem = selectedPrestamo.items.find(i => selectedDocIds.has(i.id));
    if (firstItem) {
      let obs = '';
      if (isOverdue(selectedPrestamo.fechaDevolucion)) {
        const diasRetraso = calcDiasRetraso(selectedPrestamo.fechaDevolucion);
        obs = `Se devolvió con ${diasRetraso} día(s) de retraso desde la fecha ${formatDate(selectedPrestamo.fechaDevolucion)}`;
      }
      const selectedItems = selectedPrestamo.items
        .filter(i => selectedDocIds.has(i.id))
        .map(i => i.documento ? { id: i.documento.id, codigoDoc: i.documento.codigoDoc, titulo: i.documento.titulo, tipoDoc: i.documento.tipoDoc } : { id: i.id });
      setDevolucionItem({
        ...firstItem,
        personaNombre: `${selectedPrestamo.persona.nombre} ${selectedPrestamo.persona.apellido}`,
        observacionesIniciales: obs || undefined,
        selectedItems,
      });
    }
  };

  const handleBloquear = useCallback(async (personaId: string, motivo: string): Promise<string> => {
    try {
      const { data } = await crearBloqueo({
        variables: { personaId, motivo },
      });
      if (data?.crearBloqueo?.error) throw new Error(data.crearBloqueo.error);
      refetch();
      return '✅ Persona bloqueada correctamente.';
    } catch (err: unknown) {
      return err instanceof Error ? err.message : 'Error al bloquear';
    }
  }, [crearBloqueo, refetch]);

  const handleProrroga = async () => {
    if (!prorrogaPrestamoId || !prorrogaPersonaId || !prorrogaDias) {
      setProrrogaError('Todos los campos son obligatorios.');
      return;
    }
    setProrrogaSaving(true);
    try {
      const { data } = await registrarProrroga({
        variables: {
          prestamoId: prorrogaPrestamoId,
          personaSolicitaId: prorrogaPersonaId,
          diasOtorgados: parseInt(prorrogaDias),
          motivo: prorrogaMotivo || undefined,
        },
      });
      if (data?.registrarProrrogaDoc?.error) throw new Error(data.registrarProrrogaDoc.error);
      setProrrogaPrestamoId(null);
      resetProrrogaForm();
      refetch();
    } catch (err: unknown) {
      setProrrogaError(err instanceof Error ? err.message : 'Error al registrar prórroga');
    } finally {
      setProrrogaSaving(false);
    }
  };

  const resetProrrogaForm = () => {
    setProrrogaPersonaId('');
    setProrrogaDias('');
    setProrrogaMotivo('');
    setProrrogaError('');
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-surface-800 dark:text-navy-200">Préstamos de Documentos</h2>
        <div className="flex gap-3">
          {vencidosCount > 0 && (
            <button onClick={() => setShowVencidos(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-500 dark:from-red-500 dark:to-red-600 text-white font-medium shadow-md shadow-red-500/30 hover:shadow-lg transition-all text-sm"
            >
              <AlertTriangle size={16} />
              Vencidos
              <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-xs font-bold">{vencidosCount}</span>
            </button>
          )}
          {hasPerm('gestionar_prestamos') && (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 dark:from-brand-dark-500 dark:to-blue-500 text-white font-medium shadow-md shadow-brand-500/30 hover:shadow-lg transition-all text-sm"
            >
              <BookOpenCheck size={16} />
              Nuevo Préstamo
            </button>
          )}
        </div>
      </div>

      <div className="glass-panel rounded-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/20 dark:border-navy-700/30">
          <h3 className="text-lg font-bold text-surface-800 dark:text-navy-200">Préstamos de Documentos</h3>
          <span className="text-sm text-surface-600 dark:text-navy-500">{filteredItems.length} de {totalCount} resultado(s)</span>
        </div>
        <div className="px-6 py-3 border-b border-white/10 dark:border-navy-700/20">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" size={16} />
            <input
              type="text"
              placeholder="Buscar por persona o código de documento..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 placeholder:text-surface-500 dark:placeholder:text-navy-500 focus:outline-none focus:ring-2 focus:ring-brand-400/50 text-sm"
            />
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/20 dark:border-navy-700/30">
                <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Fecha</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Persona</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Documentos</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Devolución</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 dark:divide-navy-700/20">
              {filteredItems.map((p: PrestamoDocItem) => (
                <tr key={p.id} onClick={() => setSelectedPrestamo(p)}
                  className="hover:bg-white/30 dark:hover:bg-navy-800/50 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4 text-sm text-surface-700 dark:text-navy-300">{formatDate(p.fechaPrest)}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-surface-800 dark:text-navy-200">{p.persona.nombre} {p.persona.apellido}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {(p.items ?? []).slice(0, 3).map((item: ItemPrestamoDoc) => (
                        <span key={item.id} className={`px-2 py-0.5 rounded-md text-xs ${
                          item.estado === 'devuelto'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                        }`}>
                          {item.documento?.codigoDoc}{item.documento?.titulo ? ` — ${item.documento.titulo}` : ''}{item.documento?.tipoDoc ? ` (${item.documento.tipoDoc})` : ''}
                        </span>
                      ))}
                      {(p.items ?? []).length > 3 && (
                        <span className="px-2 py-0.5 rounded-md text-xs bg-surface-100 dark:bg-navy-700 text-surface-600 dark:text-navy-400">
                          +{(p.items ?? []).length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={`px-6 py-4 text-sm ${isOverdue(p.fechaDevolucion) ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-surface-600 dark:text-navy-400'}`}>
                    {formatDate(p.fechaDevolucion)}
                  </td>
                  <td className="px-6 py-4">
                    {p.items?.every((i: ItemPrestamoDoc) => i.estado === 'devuelto')
                      ? <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">Completado</span>
                      : <span className="px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">Activo</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalCount === 0 && (
            <div className="text-center py-12 text-surface-500 dark:text-navy-500">
              <p className="text-lg font-medium">No hay préstamos de documentos</p>
            </div>
          )}
        </div>
        <Pagination currentPage={currentPage} totalItems={totalCount} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />
      </div>

      {showVencidos && (
        <PrestamosDocVencidosModal
          onClose={() => setShowVencidos(false)}
          onSelect={(p) => {
            const vencidoItems = (p.items || [])
              .filter((item) => item.estado !== 'devuelto')
              .map((item) => {
                const diasRetraso = Math.max(0, Math.floor(
                  (new Date(new Date().toDateString()).getTime() - new Date(p.fechaDevolucion).getTime()) / (1000 * 60 * 60 * 24)
                ));
                const descripcion = item.documento?.codigoDoc
                  ? `${item.documento.codigoDoc} — ${item.documento.titulo}`
                  : item.documento?.titulo || `Doc #${item.documento?.id}`;
                return {
                  descripcion,
                  fechaPrest: p.fechaPrest,
                  fechaDevolucion: p.fechaDevolucion,
                  diasRetraso,
                };
              });
              setVencidoDocPendientes({
              persona: p.persona,
              items: vencidoItems,
            });
          }}
          formatDate={formatDate}
        />
      )}

      {selectedPrestamo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => { setSelectedPrestamo(null); setSelectedDocIds(new Set()); }}>
          <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-white/20 dark:border-navy-700/30">
              <h3 className="text-lg font-bold text-surface-800 dark:text-navy-200">
                Documentos del Préstamo
              </h3>
              <button onClick={() => { setSelectedPrestamo(null); setSelectedDocIds(new Set()); }} className="text-surface-500 hover:text-surface-700"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4 overflow-auto">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-surface-500">Persona:</span> <span className="font-semibold text-surface-800 dark:text-navy-200">{selectedPrestamo.persona.nombre} {selectedPrestamo.persona.apellido}</span></div>
                <div><span className="text-surface-500">Fecha Préstamo:</span> <span className="text-surface-800 dark:text-navy-200">{formatDate(selectedPrestamo.fechaPrest)}</span></div>
                <div><span className="text-surface-500">Fecha de devolución:</span> <span className={`${isOverdue(selectedPrestamo.fechaDevolucion) ? 'text-red-600 font-semibold' : 'text-surface-800 dark:text-navy-200'}`}>{formatDate(selectedPrestamo.fechaDevolucion)}</span></div>
                <div><span className="text-surface-500">Observaciones:</span> <span className="text-surface-800 dark:text-navy-200">{selectedPrestamo.observaciones || '—'}</span></div>
              </div>

              {isOverdue(selectedPrestamo.fechaDevolucion) && hasPerm('gestionar_bloqueos') && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
                  <AlertTriangle size={16} />
                  Este préstamo está <strong>vencido</strong> —
                  <button onClick={() => setShowBloqueo({ personaId: selectedPrestamo.persona.id, personaNombre: `${selectedPrestamo.persona.nombre} ${selectedPrestamo.persona.apellido}`, info: buildBloqueoInfo(selectedPrestamo) })}
                    className="underline font-semibold hover:text-red-800"
                  >Bloquear a {selectedPrestamo.persona.nombre}</button>
                </div>
              )}

              <div className="flex items-center gap-2 mb-4">
                {hasPerm('gestionar_prorrogas') && (
                  <button onClick={() => { setProrrogaPrestamoId(selectedPrestamo.id); setProrrogaPersonaId(selectedPrestamo.persona.id); }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 dark:from-brand-dark-500 dark:to-blue-500 text-white font-medium shadow-md hover:shadow-lg transition-all text-sm"
                  ><Calendar size={16} /> Prórroga</button>
                )}
                {hasPerm('gestionar_devoluciones') && (
                  <button onClick={handleDevolverSeleccionados}
                    disabled={selectedDocIds.size === 0}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-green-600 to-green-500 dark:from-green-500 dark:to-green-600 text-white font-medium shadow-md hover:shadow-lg transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  ><Undo2 size={16} /> Devolver{selectedDocIds.size > 0 ? ` (${selectedDocIds.size})` : ''}</button>
                )}
              </div>

              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/20 dark:border-navy-700/30">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-surface-600 uppercase w-10"></th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-surface-600 uppercase">Documento</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-surface-600 uppercase">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 dark:divide-navy-700/20">
                  {(selectedPrestamo.items ?? []).map((item: ItemPrestamoDoc) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        {item.estado !== 'devuelto' && hasPerm('gestionar_devoluciones') && (
                          <input
                            type="checkbox"
                            checked={selectedDocIds.has(item.id)}
                            onChange={() => toggleDocSelection(item.id)}
                            className="rounded border-surface-300 text-brand-600 focus:ring-brand-400"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-surface-800 dark:text-navy-200">
                        <span className="font-mono text-xs text-surface-500">{item.documento?.codigoDoc}</span>
                        {item.documento?.titulo && <span> — {item.documento.titulo}</span>}
                        {item.documento?.tipoDoc && <span className="text-xs text-surface-400 ml-1">({item.documento.tipoDoc})</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-md text-xs ${
                          item.estado === 'devuelto'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700'
                            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700'
                        }`}>{item.estado}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {selectedPrestamo.fotoFirma && (
                <div className="mt-4 p-4 rounded-xl bg-surface-50 dark:bg-navy-800/50 border border-white/40 dark:border-navy-700/40">
                  <p className="text-xs text-surface-600 dark:text-navy-500 mb-2">Foto Firma</p>
                  <a href={`/api/firma/imagen/${selectedPrestamo.tokenFirma}/`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-100 dark:bg-brand-dark-600/30 text-brand-600 dark:text-brand-dark-400 hover:bg-brand-200 dark:hover:bg-brand-dark-600/50 transition-colors text-sm font-medium"
                  >
                    Ver foto firma
                  </a>
                </div>
              )}

              {selectedPrestamo.tokenFirma && !selectedPrestamo.fotoFirma && (
                <div className="mt-4 p-4 rounded-xl bg-surface-50 dark:bg-navy-800/50 border border-white/40 dark:border-navy-700/40">
                  <p className="text-xs text-surface-600 dark:text-navy-500 mb-2">Foto Firma</p>
                  <p className="text-sm text-surface-500 dark:text-navy-400 italic">Pendiente de firma</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {prorrogaPrestamoId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => { setProrrogaPrestamoId(null); resetProrrogaForm(); }}>
          <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-surface-800 dark:text-navy-200 mb-4">Registrar Prórroga</h3>
            <div className="space-y-3">
              {selectedDocIds.size > 0 && selectedPrestamo && (
                <div className="px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-1">
                    Documentos seleccionados:
                  </p>
                  {selectedPrestamo.items.filter(i => selectedDocIds.has(i.id)).map(item => (
                    <p key={item.id} className="text-xs text-blue-600 dark:text-blue-400">
                      {item.documento?.codigoDoc} — {item.documento?.titulo}{item.documento?.tipoDoc ? ` (${item.documento.tipoDoc})` : ''}
                    </p>
                  ))}
                </div>
              )}
              <input type="number" placeholder="Días a otorgar" value={prorrogaDias}
                onChange={(e) => setProrrogaDias(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400/50 transition-all text-sm"
              />
              <input type="text" placeholder="Motivo (opcional)" value={prorrogaMotivo}
                onChange={(e) => setProrrogaMotivo(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400/50 transition-all text-sm"
              />
              {prorrogaError && <p className="text-xs text-red-600">{prorrogaError}</p>}
              <div className="flex justify-end gap-2">
                <button onClick={() => { setProrrogaPrestamoId(null); resetProrrogaForm(); }}
                  className="px-4 py-2 rounded-xl text-surface-600 bg-white/60 border border-white/80 hover:bg-white transition-colors text-xs font-medium"
                >Cancelar</button>
                <button onClick={handleProrroga} disabled={prorrogaSaving}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 text-white font-medium shadow-md text-xs disabled:opacity-50"
                >{prorrogaSaving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {devolucionItem && selectedPrestamo && (
        <DevolverDocModal
          prestamoId={devolucionItem.id}
          item={devolucionItem.documento ?? {}}
          personaNombre={devolucionItem.personaNombre}
          personaId={selectedPrestamo.persona.id}
          fechaPrest={selectedPrestamo.fechaPrest}
          formatDate={formatDate}
          observacionesIniciales={devolucionItem.observacionesIniciales}
          selectedItems={devolucionItem.selectedItems}
          onClose={() => { setDevolucionItem(null); refetch(); }}
          onSuccess={() => { setDevolucionItem(null); refetch(); }}
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

      {showForm && (
        <RegistrarPrestamoDocModal
          show={showForm}
          onClose={() => setShowForm(false)}
          personas={personas}
          ultimasPersonas={ultimasPersonas}
          personasConCargo={personasConCargo}
          hasPerm={hasPerm}
          onRegistrar={handleRegistrarDoc}
          onBloquear={hasPerm('gestionar_bloqueos') ? handleBloquear : undefined}
        />
      )}

      {vencidoDocPendientes && (
        <PrestamosPendientesModal
          persona={vencidoDocPendientes.persona}
          items={vencidoDocPendientes.items}
          type="documentos"
          onClose={() => setVencidoDocPendientes(null)}
          onBloquear={hasPerm('gestionar_bloqueos') ? handleBloquear : undefined}
        />
      )}
    </>
  );
}


