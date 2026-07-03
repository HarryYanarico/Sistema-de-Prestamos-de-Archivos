import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useLazyQuery } from '@apollo/client/react';
import { useSearchParams } from 'react-router-dom';
import { GET_ALL_CARPETAS_PAGINATED, GET_ALL_AMBIENTES, GET_ALL_PRESTAMOS, GET_ALL_PISOS, CREAR_DOCUMENTO, EDITAR_CARPETA, EDITAR_DOCUMENTO, GET_ALL_PERSONAS_PAGINATED, GET_TRASPASOS_PENDIENTES_PAGINATED, UBICAR_CARPETAS } from '../lib/queries';
import { Search, Filter, FolderOpen, FileText, X, Pencil, Plus, UserCheck, MapPin, Clock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import Pagination from '../components/Pagination';
import { usePermission } from '../context/AuthContext';
import { formatDate } from '../utils/formatDate';

type Ambiente = { id: string; nombre: string; ubicacion?: string };
type PersonaMini = { id: string; nombre: string; apellido: string; ci: string; tipoEntidad: string };
type Documento = { id: string; codigoDoc: string; titulo: string; tipoDoc: string; fechaIngre: string; propietario?: PersonaMini | null };
type Carpeta = {
  id: string; descripcion: string; fechaCrea: string; estado: string;
  piso: {
    id: string; nroFila: number; descripcion?: string;
    estante: { id: string; codigo: string; ambiente: { id: string; nombre: string; ubicacion?: string } };
  };
  documentos: Documento[];
};

interface AmbientesData { allAmbientes: Ambiente[]; }
interface CarpetasPaginatedData {
  allCarpetasPaginated: { items: Carpeta[]; totalCount: number };
}
interface PrestamosData {
  allPrestamos: {
    id: string; fechaPrest: string; fechaDevolucion: string;
    persona: { nombre: string; apellido: string; ci: string };
    prestamoCarpetas: { id: string; carpeta: { id: string } }[];
  }[];
}
interface PersonasPaginatedData {
  allPersonasPaginated: { items: PersonaMini[]; totalCount: number };
}

type TraspasoPendiente = {
  traspasoCarpetaId: string;
  carpeta: { id: string; descripcion: string; estado: string };
  traspaso: { id: string; fecha: string; observaciones?: string; ambienteOrigen: { id: string; nombre: string }; ambienteDestino: { id: string; nombre: string } };
};
type TraspasosPendientesData = { allTraspasosPendientesPaginated: { items: TraspasoPendiente[]; totalCount: number } };
type PisoConRel = { id: string; nroFila: number; descripcion?: string; estante: { id: string; codigo: string; ambiente: { id: string; nombre: string } } };
type AllPisosData = { allPisos: PisoConRel[] };

export default function CarpetasPage() {
  const [searchParams] = useSearchParams();
  const [selectedAmbienteId, setSelectedAmbienteId] = useState('');
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 10;
  const [selectedCarpeta, setSelectedCarpeta] = useState<Carpeta | null>(null);
  const [showDocForm, setShowDocForm] = useState(false);
  const [docCodigo, setDocCodigo] = useState('');
  const [DocTitulo, setDocTitulo] = useState('');
  const [docTipo, setDocTipo] = useState('');
  const [docPropietario, setDocPropietario] = useState('');
  const [docPropietarioId, setDocPropietarioId] = useState('');
  const [docError, setDocError] = useState('');
  const [editDescripcion, setEditDescripcion] = useState('');
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);
  const [personaResults, setPersonaResults] = useState<{ id: string; nombre: string; apellido: string; ci: string }[]>([]);
  const [showPersonaDropdown, setShowPersonaDropdown] = useState(false);
  const personaDebounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  const personaRef = useRef<HTMLDivElement>(null);

  const [buscarPersonas] = useLazyQuery<PersonasPaginatedData>(GET_ALL_PERSONAS_PAGINATED, { fetchPolicy: 'network-only' });

  const { data: carpetasData, loading, refetch } = useQuery<CarpetasPaginatedData>(GET_ALL_CARPETAS_PAGINATED, {
    variables: { page: currentPage, pageSize: itemsPerPage, ambienteId: selectedAmbienteId || undefined, search: search || undefined },
    fetchPolicy: 'network-only',
  });
  const { data: ambData } = useQuery<AmbientesData>(GET_ALL_AMBIENTES);
  const { data: prestamosData } = useQuery<PrestamosData>(GET_ALL_PRESTAMOS);
  const [showSinUbicar, setShowSinUbicar] = useState(false);
  const [pendientesPage, setPendientesPage] = useState(1);
  const [pendientesAmbienteId, setPendientesAmbienteId] = useState('');
  const [pendientesSearch, setPendientesSearch] = useState('');
  const [pendientesSelected, setPendientesSelected] = useState<Set<string>>(new Set());
  const [pendientesUbiAmbienteId, setPendientesUbiAmbienteId] = useState('');
  const [pendientesUbiEstanteId, setPendientesUbiEstanteId] = useState('');
  const [pendientesUbiPisoId, setPendientesUbiPisoId] = useState('');
  const [pendientesMensaje, setPendientesMensaje] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const pendientesItemsPerPage = 10;
  const { data: pendientesData, loading: pendientesLoading, refetch: refetchPendientes } = useQuery<TraspasosPendientesData>(GET_TRASPASOS_PENDIENTES_PAGINATED, {
    variables: { page: pendientesPage, pageSize: pendientesItemsPerPage, ambienteId: pendientesAmbienteId || undefined, search: pendientesSearch || undefined },
    fetchPolicy: 'network-only',
  });
  const { data: pisosData } = useQuery<AllPisosData>(GET_ALL_PISOS);
  const [ubicarPendientes, { loading: pendientesLoadingUbi }] = useMutation<{ ubicarCarpetas?: { success?: boolean; error?: string } }>(UBICAR_CARPETAS);
  const [editingDoc, setEditingDoc] = useState<Documento | null>(null);
  const [editDocCodigo, setEditDocCodigo] = useState('');
  const [editDocTitulo, setEditDocTitulo] = useState('');
  const [editDocTipo, setEditDocTipo] = useState('');
  const [editDocPropietario, setEditDocPropietario] = useState('');
  const [editDocPropietarioId, setEditDocPropietarioId] = useState('');
  const [editPersonaResults, setEditPersonaResults] = useState<{ id: string; nombre: string; apellido: string; ci: string }[]>([]);
  const [editShowPersonaDropdown, setEditShowPersonaDropdown] = useState(false);
  const editPersonaRef = useRef<HTMLDivElement>(null);
  const [editDocError, setEditDocError] = useState('');

  const [crearDocumento] = useMutation<{ crearDocumento?: { error?: string } }>(CREAR_DOCUMENTO);
  const [editarDocumento] = useMutation<{ editarDocumento?: { error?: string } }>(EDITAR_DOCUMENTO);
  const [editarCarpeta] = useMutation<{ editarCarpeta?: { error?: string } }>(EDITAR_CARPETA);
  const { hasPerm } = usePermission();

  const ambientes = (ambData?.allAmbientes ?? []) as Ambiente[];
  const carpetas = (carpetasData?.allCarpetasPaginated?.items ?? []) as Carpeta[];
  const totalCount = carpetasData?.allCarpetasPaginated?.totalCount ?? 0;
  const pendientesItems = pendientesData?.allTraspasosPendientesPaginated?.items ?? [];
  const pendientesTotalCount = pendientesData?.allTraspasosPendientesPaginated?.totalCount ?? 0;
  const pisos = (pisosData?.allPisos ?? []) as PisoConRel[];
  const ambientesConPisos = [...new Map(pisos.map((p) => [p.estante.ambiente.id, p.estante.ambiente])).values()];
  const itemsSeleccionados = pendientesItems.filter((i) => pendientesSelected.has(i.traspasoCarpetaId));
  const destinosDeSeleccion = [...new Map(itemsSeleccionados.map((i) => [i.traspaso.ambienteDestino.id, i.traspaso.ambienteDestino])).values()];
  const ambientesDisponibles = destinosDeSeleccion.length > 0
    ? ambientesConPisos.filter((a) => destinosDeSeleccion.some((d) => d.id === a.id))
    : ambientesConPisos;
  const estantesDelAmbiente = pendientesUbiAmbienteId
    ? [...new Map(pisos.filter((p) => p.estante.ambiente.id === pendientesUbiAmbienteId).map((p) => [p.estante.id, p.estante])).values()]
    : [];
  const pisosDelEstante = pendientesUbiEstanteId
    ? pisos.filter((p) => p.estante.id === pendientesUbiEstanteId)
    : [];
  const prestamos = (prestamosData?.allPrestamos ?? []) as {
    id: string; fechaPrest: string; fechaDevolucion: string; persona: { nombre: string; apellido: string; ci: string };
    prestamoCarpetas: { id: string; carpeta: { id: string } }[];
  }[];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (personaRef.current && !personaRef.current.contains(e.target as Node)) {
        setShowPersonaDropdown(false);
      }
      if (editPersonaRef.current && !editPersonaRef.current.contains(e.target as Node)) {
        setEditShowPersonaDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (ambientesDisponibles.length === 1 && !pendientesUbiAmbienteId) {
      setPendientesUbiAmbienteId(ambientesDisponibles[0].id);
    }
    if (ambientesDisponibles.length > 0 && pendientesUbiAmbienteId && !ambientesDisponibles.some((a) => a.id === pendientesUbiAmbienteId)) {
      setPendientesUbiAmbienteId('');
      setPendientesUbiEstanteId('');
      setPendientesUbiPisoId('');
    }
  }, [pendientesSelected, ambientesDisponibles]);

  const handlePersonaSearch = (value: string) => {
    setDocPropietario(value);
    setDocPropietarioId('');
    if (personaDebounce.current) clearTimeout(personaDebounce.current);
    if (value.trim().length < 2) { setPersonaResults([]); setShowPersonaDropdown(false); return; }
    personaDebounce.current = setTimeout(async () => {
      try {
        const { data } = await buscarPersonas({ variables: { page: 1, pageSize: 8, search: value.trim() } });
        const items = data?.allPersonasPaginated?.items ?? [];
        setPersonaResults(items);
        setShowPersonaDropdown(items.length > 0);
      } catch { setPersonaResults([]); }
    }, 350);
  };

  const handleEditPersonaSearch = (value: string) => {
    setEditDocPropietario(value);
    setEditDocPropietarioId('');
    if (personaDebounce.current) clearTimeout(personaDebounce.current);
    if (value.trim().length < 2) { setEditPersonaResults([]); setEditShowPersonaDropdown(false); return; }
    personaDebounce.current = setTimeout(async () => {
      try {
        const { data } = await buscarPersonas({ variables: { page: 1, pageSize: 8, search: value.trim() } });
        const items = data?.allPersonasPaginated?.items ?? [];
        setEditPersonaResults(items);
        setEditShowPersonaDropdown(items.length > 0);
      } catch { setEditPersonaResults([]); }
    }, 350);
  };

  const selectEditPersona = (p: { id: string; nombre: string; apellido: string }) => {
    setEditDocPropietario(`${p.nombre} ${p.apellido}`);
    setEditDocPropietarioId(p.id);
    setEditPersonaResults([]);
    setEditShowPersonaDropdown(false);
  };

  const selectPersona = (p: { id: string; nombre: string; apellido: string }) => {
    setDocPropietario(`${p.nombre} ${p.apellido}`);
    setDocPropietarioId(p.id);
    setPersonaResults([]);
    setShowPersonaDropdown(false);
  };

  const historialCarpeta = selectedCarpeta
    ? prestamos.filter((p) =>
        p.prestamoCarpetas?.some((pc) => pc.carpeta.id === selectedCarpeta.id)
      )
    : [];

  const openEditDoc = (doc: Documento) => {
    setEditingDoc(doc);
    setEditDocCodigo(doc.codigoDoc);
    setEditDocTitulo(doc.titulo);
    setEditDocTipo(doc.tipoDoc);
    setEditDocPropietario(doc.propietario ? `${doc.propietario.nombre} ${doc.propietario.apellido}` : '');
    setEditDocPropietarioId(doc.propietario?.id ?? '');
    setEditDocError('');
  };

  const closeEditDoc = () => {
    setEditingDoc(null);
    setEditDocError('');
    setEditDocPropietarioId('');
    setEditPersonaResults([]);
    setEditShowPersonaDropdown(false);
  };

  const handleEditDoc = async () => {
    setEditDocError('');
    if (!editDocCodigo || !editDocTitulo || !editDocTipo) {
      setEditDocError('Código, título y tipo son obligatorios');
      return;
    }
    try {
      const vars: Record<string, unknown> = { id: editingDoc!.id, codigoDoc: editDocCodigo, titulo: editDocTitulo, tipoDoc: editDocTipo };
      if (editDocPropietarioId) vars.idPropietario = editDocPropietarioId;
      const { data } = await editarDocumento({ variables: vars });
      if (data?.editarDocumento?.error) throw new Error(data.editarDocumento.error);
      closeEditDoc();
      const { data: newEditData } = await refetch();
      const updatedEdit = newEditData?.allCarpetasPaginated?.items?.find((c: Carpeta) => c.id === selectedCarpeta!.id);
      if (updatedEdit) setSelectedCarpeta(updatedEdit);
    } catch (err: unknown) {
      setEditDocError(err instanceof Error ? err.message : 'Error al editar documento');
    }
  };

  const handleCrearDocumento = async () => {
    setDocError('');
    if (!DocTitulo || !docTipo) {
      setDocError('Título y tipo son obligatorios');
      return;
    }
    if (!docCodigo && !window.confirm('El documento no tiene código. ¿Está seguro de guardarlo?')) {
      return;
    }
    try {
      const { data } = await crearDocumento({
        variables: { codigoDoc: docCodigo || undefined, titulo: DocTitulo, tipoDoc: docTipo, idCarpeta: selectedCarpeta!.id, idPropietario: docPropietarioId || undefined },
      });
      if (data?.crearDocumento?.error) throw new Error(data.crearDocumento.error);
      setShowDocForm(false);
      setDocCodigo('');
      setDocTitulo('');
      setDocTipo('');
      setDocPropietario('');
      setDocPropietarioId('');
      const { data: newDocData } = await refetch();
      const updatedCarpeta = newDocData?.allCarpetasPaginated?.items?.find((c: Carpeta) => c.id === selectedCarpeta!.id);
      if (updatedCarpeta) setSelectedCarpeta(updatedCarpeta);
    } catch (err: unknown) {
      setDocError(err instanceof Error ? err.message : 'Error al crear documento');
    }
  };

  const openDocForm = () => {
    setDocCodigo('');
    setDocTitulo('');
    setDocTipo('');
    setDocPropietario('');
    setDocError('');
    setShowDocForm(true);
  };

  const handleGuardarEdicion = async () => {
    setEditError('');
    setSaving(true);
    try {
      const { data } = await editarCarpeta({
        variables: { id: selectedCarpeta!.id, descripcion: editDescripcion },
      });
      if (data?.editarCarpeta?.error) throw new Error(data.editarCarpeta.error);
      const { data: newEditCarpData } = await refetch();
      const updatedCarp = newEditCarpData?.allCarpetasPaginated?.items?.find((c: Carpeta) => c.id === selectedCarpeta!.id);
      if (updatedCarp) setSelectedCarpeta(updatedCarp);
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const cerrarModal = () => {
    setSelectedCarpeta(null);
    setShowDocForm(false);
    setEditError('');
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-surface-800 dark:text-navy-200">Carpetas</h2>
        <button onClick={() => { setShowSinUbicar(true); setPendientesPage(1); setPendientesUbiAmbienteId(pendientesAmbienteId || ''); }}
          className="relative flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-amber-300/60 dark:border-amber-600/40 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:border-amber-400 dark:hover:border-amber-500/60 transition-all text-sm font-medium shadow-sm"
        >
          <MapPin size={16} />
          <span>Sin ubicar</span>
          {pendientesTotalCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[11px] font-bold leading-none">
              {pendientesTotalCount}
            </span>
          )}
        </button>
      </div>

      <div className="glass-panel rounded-2xl p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex items-center gap-3 flex-1">
            <Filter size={16} className="text-surface-500 dark:text-navy-500 shrink-0" />
            <select value={selectedAmbienteId} onChange={(e) => { setSelectedAmbienteId(e.target.value); setCurrentPage(1); }}
              className="w-full max-w-xs px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400/50 dark:focus:ring-brand-dark-500/50 transition-all text-sm"
            >
              <option value="">Todos los ambientes</option>
              {ambientes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500 dark:text-navy-500" size={16} />
            <input type="text" placeholder="Buscar carpeta por descripción..." value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 placeholder:text-surface-500 dark:placeholder:text-navy-500 focus:outline-none focus:ring-2 focus:ring-brand-400/50 dark:focus:ring-brand-dark-500/50 transition-all text-sm"
            />
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-2xl flex flex-col" style={{ maxHeight: 'calc(100vh - 210px)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/20 dark:border-navy-700/30 shrink-0">
          <h3 className="text-lg font-bold text-surface-800 dark:text-navy-200">Todas las Carpetas</h3>
          <span className="text-sm text-surface-600 dark:text-navy-500">{totalCount} resultado(s)</span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-surface-500 dark:text-navy-500">
            <p className="text-lg font-medium">Cargando...</p>
          </div>
        ) : <>
          <div className="overflow-auto flex-1">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/20 dark:border-navy-700/30">
                  <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase sticky top-0 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm z-10">Descripción</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase sticky top-0 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm z-10">Ubicación</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase sticky top-0 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm z-10">Estado</th>
                  <th className="text-center px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase sticky top-0 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm z-10">Documentos</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase sticky top-0 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm z-10">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 dark:divide-navy-700/20">
                {carpetas.map((c) => (
                  <tr key={c.id} className="hover:bg-white/30 dark:hover:bg-navy-800/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-semibold text-surface-800 dark:text-navy-200">{c.descripcion}</td>
                    <td className="px-6 py-4 text-sm text-surface-600 dark:text-navy-400">
                      {c.piso.estante.ambiente.nombre} / {c.piso.estante.codigo} / Fila {c.piso.nroFila}
                    </td>
                    <td className="px-6 py-4">
<span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                     c.estado === 'disponible'
                       ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                       : c.estado === 'retirado'
                       ? 'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300'
                       : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                   }`}>
                     {c.estado === 'disponible' ? 'Disponible' : c.estado === 'retirado' ? 'Retirado' : 'Prestado'}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center gap-1 text-sm text-surface-600 dark:text-navy-400">
                        <FileText size={14} />
                        {c.documentos?.length ?? 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {hasPerm('gestionar_carpetas') && (
                        <button onClick={() => {
                          setSelectedCarpeta(c);
                          setEditDescripcion(c.descripcion);
                          setEditError('');
                          setShowDocForm(false);
                        }}
                          className="p-2 rounded-lg text-surface-500 dark:text-navy-500 hover:text-brand-600 dark:hover:text-brand-dark-400 hover:bg-brand-50 dark:hover:bg-brand-dark-600/20 transition-colors"
                          title="Editar carpeta"
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalCount === 0 && (
              <div className="text-center py-12 text-surface-500 dark:text-navy-500">
                <FolderOpen size={40} className="mx-auto mb-2 opacity-40 dark:opacity-60" />
                <p className="text-sm font-medium">No hay carpetas</p>
              </div>
            )}
          </div>
          <div className="shrink-0 border-t border-white/20 dark:border-navy-700/30">
            <Pagination currentPage={currentPage} totalItems={totalCount} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />
          </div>
        </>}
      </div>

      {selectedCarpeta && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 dark:bg-black/70 backdrop-blur-sm p-4 pt-12">
          <div className="glass-panel rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-surface-800 dark:text-navy-200">Editar Carpeta</h3>
              <button onClick={cerrarModal}
                className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-300 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-4 pb-4 border-b border-white/10 dark:border-navy-700/20">
              <div className="flex items-center gap-2">
                <span className="text-xs text-surface-500 dark:text-navy-500">Estado:</span>
<span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                   selectedCarpeta.estado === 'disponible'
                     ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                     : selectedCarpeta.estado === 'retirado'
                     ? 'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300'
                     : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                 }`}>
                   {selectedCarpeta.estado === 'disponible' ? 'Disponible' : selectedCarpeta.estado === 'retirado' ? 'Retirado' : 'Prestado'}
                 </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-surface-500 dark:text-navy-500">Creada:</span>
                <span className="text-sm font-medium text-surface-700 dark:text-navy-300">{formatDate(selectedCarpeta.fechaCrea)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-surface-500 dark:text-navy-500">Ubicación:</span>
                <span className="text-sm font-medium text-surface-700 dark:text-navy-300">
                  {selectedCarpeta.piso.estante.ambiente.nombre} / {selectedCarpeta.piso.estante.codigo} / Fila {selectedCarpeta.piso.nroFila}
                </span>
              </div>
            </div>

            {selectedCarpeta.estado === 'prestado' ? (
              <div className="mb-5 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-sm">
                Carpeta prestada — no se puede editar ni agregar documentos.
              </div>
            ) : (
              <div className="flex items-start gap-3 mb-5">
                <div className="flex-1">
                  <textarea value={editDescripcion} onChange={(e) => setEditDescripcion(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 placeholder:text-surface-500 dark:placeholder:text-navy-500 focus:outline-none focus:ring-2 focus:ring-brand-400/50 dark:focus:ring-brand-dark-500/50 transition-all text-sm resize-none"
                    rows={1}
                  />
                  {editError && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{editError}</p>}
                </div>
                <button onClick={handleGuardarEdicion} disabled={saving}
                  className="shrink-0 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 dark:from-brand-dark-500 dark:to-blue-500 text-white font-medium shadow-md text-xs hover:from-red-700 hover:to-blue-700 dark:hover:from-red-800 dark:hover:to-blue-800 transition-all disabled:opacity-50"
                >
                  {saving ? '...' : 'Guardar'}
                </button>
              </div>
            )}

            <div className="glass-card rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-surface-600 dark:text-navy-500">Documentos ({selectedCarpeta.documentos?.length ?? 0})</p>
                {selectedCarpeta.estado !== 'prestado' && hasPerm('gestionar_documentos') && (
                  <button onClick={openDocForm}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 dark:from-brand-dark-500 dark:to-blue-500 text-white font-medium shadow-md text-xs hover:from-red-700 hover:to-blue-700 dark:hover:from-red-800 dark:hover:to-blue-800 transition-all"
                  >
                    <Plus size={14} />
                    Nuevo Documento
                  </button>
                )}
              </div>

              {showDocForm && (
                <div className="mb-4 p-4 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-brand-200 dark:border-brand-dark-600/30 space-y-3">
                  <input type="text" placeholder="Código del documento *" value={docCodigo}
                    onChange={(e) => setDocCodigo(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 placeholder:text-surface-500 dark:placeholder:text-navy-500 focus:outline-none focus:ring-2 focus:ring-brand-400/50 dark:focus:ring-brand-dark-500/50 transition-all text-sm"
                  />
                  <input type="text" placeholder="Título del documento *" value={DocTitulo}
                    onChange={(e) => setDocTitulo(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 placeholder:text-surface-500 dark:placeholder:text-navy-500 focus:outline-none focus:ring-2 focus:ring-brand-400/50 dark:focus:ring-brand-dark-500/50 transition-all text-sm"
                  />
                  <input type="text" placeholder="Tipo de documento (ej. Informe, Contrato, Carta) *" value={docTipo}
                    onChange={(e) => setDocTipo(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 placeholder:text-surface-500 dark:placeholder:text-navy-500 focus:outline-none focus:ring-2 focus:ring-brand-400/50 dark:focus:ring-brand-dark-500/50 transition-all text-sm"
                  />
                  <div ref={personaRef} className="relative">
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 focus-within:ring-2 focus-within:ring-brand-400/50 dark:focus-within:ring-brand-dark-500/50 transition-all">
                      <UserCheck size={16} className="text-surface-500 dark:text-navy-500 shrink-0" />
                      <input type="text" placeholder="Propietario (persona o institución)" value={docPropietario}
                        onChange={(e) => handlePersonaSearch(e.target.value)}
                        className="flex-1 bg-transparent text-surface-800 dark:text-navy-200 placeholder:text-surface-500 dark:placeholder:text-navy-500 focus:outline-none text-sm" />
                    </div>
                    {showPersonaDropdown && (
                      <div className="absolute z-50 mt-1 w-full rounded-xl bg-white dark:bg-navy-800 border border-white/40 dark:border-navy-700/40 shadow-lg overflow-hidden">
                        {personaResults.map((p) => (
                          <button key={p.id} type="button" onClick={() => selectPersona(p)}
                            className="w-full text-left px-4 py-2.5 text-sm text-surface-800 dark:text-navy-200 hover:bg-brand-50 dark:hover:bg-brand-dark-600/20 transition-colors border-b border-white/10 dark:border-navy-700/20 last:border-b-0"
                          >
                            <span className="font-medium">{p.nombre} {p.apellido}</span>
                            <span className="text-surface-500 dark:text-navy-500 ml-2 text-xs">CI: {p.ci}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {docError && <p className="text-xs text-red-600 dark:text-red-400">{docError}</p>}
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowDocForm(false)}
                      className="px-4 py-2 rounded-xl text-surface-600 dark:text-navy-400 bg-white/60 dark:bg-navy-800/60 border border-white/80 dark:border-navy-700/60 hover:bg-white dark:hover:bg-navy-800 transition-colors text-xs font-medium"
                    >
                      Cancelar
                    </button>
                    <button onClick={handleCrearDocumento}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 dark:from-brand-dark-500 dark:to-blue-500 text-white font-medium shadow-md text-xs"
                    >
                      Guardar
                    </button>
                  </div>
                </div>
              )}

              {selectedCarpeta.documentos && selectedCarpeta.documentos.length > 0 ? (
                <div className="space-y-2">
                  {selectedCarpeta.documentos.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 rounded-xl bg-white/50 dark:bg-navy-800/50 border border-white/40 dark:border-navy-700/40">
                      <div className="min-w-0 flex-1 mr-3">
                        <p className="font-semibold text-surface-800 dark:text-navy-200 text-sm truncate">{doc.titulo}</p>
                        <p className="text-xs text-surface-500 dark:text-navy-500 mt-0.5">
                          {doc.tipoDoc} · {doc.codigoDoc}
                          {doc.propietario && (
                            <span className="ml-2 inline-flex items-center gap-1">
                              <span className="text-brand-600 dark:text-brand-dark-400">· {doc.propietario.nombre} {doc.propietario.apellido}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                doc.propietario.tipoEntidad === 'empresa' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' :
                                doc.propietario.tipoEntidad === 'institucion' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                                'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                              }`}>
                                {doc.propietario.tipoEntidad === 'empresa' ? 'Empresa' : doc.propietario.tipoEntidad === 'institucion' ? 'Inst.' : 'Persona'}
                              </span>
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {selectedCarpeta.estado !== 'prestado' && hasPerm('gestionar_documentos') && (
                          <button onClick={() => openEditDoc(doc)}
                            className="p-1.5 rounded-lg text-surface-500 dark:text-navy-500 hover:text-brand-600 dark:hover:text-brand-dark-400 hover:bg-brand-50 dark:hover:bg-brand-dark-600/20 transition-colors"
                            title="Editar documento"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        <span className="text-xs text-surface-500 dark:text-navy-500">{formatDate(doc.fechaIngre)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-surface-500 dark:text-navy-500 text-center py-4">Sin documentos</p>
              )}
            </div>

            {historialCarpeta.length > 0 && (
              <div className="glass-card rounded-xl p-4">
                <p className="text-xs font-semibold text-surface-600 dark:text-navy-500 mb-3">Historial de préstamos</p>
                <div className="space-y-2">
                  {historialCarpeta.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-white/50 dark:bg-navy-800/50 border border-white/40 dark:border-navy-700/40">
                      <div>
                        <p className="font-semibold text-surface-800 dark:text-navy-200 text-sm">
                          {p.persona.nombre} {p.persona.apellido}
                        </p>
                        <p className="text-xs text-surface-500 dark:text-navy-500">{p.persona.ci}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-surface-600 dark:text-navy-500">Hasta: {formatDate(p.fechaDevolucion)}</p>
                        <p className="text-xs text-surface-500 dark:text-navy-500">{formatDate(p.fechaPrest)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showSinUbicar && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowSinUbicar(false)}>
          <div className="glass-panel rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/20 dark:border-navy-700/30 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                  <MapPin size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-surface-800 dark:text-navy-200">Carpetas Pendientes de Ubicación</h3>
                  <p className="text-sm text-surface-500 dark:text-navy-500 mt-0.5">
                    {pendientesTotalCount} carpeta(s) pendientes
                  </p>
                </div>
              </div>
              <button onClick={() => { setShowSinUbicar(false); setPendientesMensaje(null); }}
                className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-300 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-3 border-b border-white/10 dark:border-navy-700/20 shrink-0">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <Filter size={14} className="text-surface-500 dark:text-navy-500 shrink-0" />
                  <select value={pendientesAmbienteId} onChange={(e) => { const v = e.target.value; setPendientesAmbienteId(v); setPendientesUbiAmbienteId(v || ''); setPendientesUbiEstanteId(''); setPendientesUbiPisoId(''); setPendientesPage(1); setPendientesSelected(new Set()); setPendientesMensaje(null); }}
                    className="w-full max-w-xs px-3 py-2 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400/50 dark:focus:ring-brand-dark-500/50 transition-all text-sm"
                  >
                    <option value="">Todos los ambientes</option>
                    {ambientes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </select>
                </div>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500 dark:text-navy-500" size={14} />
                  <input type="text" placeholder="Buscar carpeta..." value={pendientesSearch}
                    onChange={(e) => { setPendientesSearch(e.target.value); setPendientesPage(1); setPendientesSelected(new Set()); setPendientesMensaje(null); }}
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 placeholder:text-surface-500 dark:placeholder:text-navy-500 focus:outline-none focus:ring-2 focus:ring-brand-400/50 dark:focus:ring-brand-dark-500/50 transition-all text-sm"
                  />
                </div>
              </div>
            </div>

            {pendientesLoading ? (
              <div className="flex-1 flex items-center justify-center py-12 text-surface-500 dark:text-navy-500">
                <Loader2 size={24} className="animate-spin" />
              </div>
            ) : pendientesItems.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-surface-500 dark:text-navy-500">
                <MapPin size={40} className="mb-2 opacity-30" />
                <p className="text-sm font-medium">No hay carpetas pendientes de ubicación</p>
              </div>
            ) : (
              <div className="overflow-auto flex-1">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/20 dark:border-navy-700/30">
                      <th className="w-12 px-4 py-3 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase sticky top-0 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm z-10">
                        <input type="checkbox" checked={pendientesSelected.size === pendientesItems.length && pendientesItems.length > 0}
                          onChange={() => {
                            if (pendientesSelected.size === pendientesItems.length) setPendientesSelected(new Set());
                            else setPendientesSelected(new Set(pendientesItems.map((i) => i.traspasoCarpetaId)));
                          }}
                          className="w-4 h-4 rounded border-surface-300 text-brand-600 dark:text-brand-dark-400 focus:ring-brand-400 dark:focus:ring-brand-dark-500"
                        />
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase sticky top-0 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm z-10">Carpeta</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase sticky top-0 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm z-10">Traspaso</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase sticky top-0 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm z-10">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 dark:divide-navy-700/20">
                    {pendientesItems.map((item) => (
                      <tr key={item.traspasoCarpetaId}
                        onClick={() => {
                          setPendientesSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(item.traspasoCarpetaId)) next.delete(item.traspasoCarpetaId);
                            else next.add(item.traspasoCarpetaId);
                            return next;
                          });
                        }}
                        className={`hover:bg-white/30 dark:hover:bg-navy-800/50 cursor-pointer transition-colors ${pendientesSelected.has(item.traspasoCarpetaId) ? 'bg-brand-50/70 dark:bg-brand-dark-600/15' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={pendientesSelected.has(item.traspasoCarpetaId)} onChange={() => {}}
                            className="w-4 h-4 rounded border-surface-300 text-brand-600 dark:text-brand-dark-400 focus:ring-brand-400 dark:focus:ring-brand-dark-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-surface-800 dark:text-navy-200">{item.carpeta.descripcion}</td>
                        <td className="px-4 py-3 text-sm text-surface-600 dark:text-navy-400">
                          <span className="font-medium text-surface-700 dark:text-navy-300">{item.traspaso.ambienteOrigen.nombre}</span>
                          <span className="mx-1 text-surface-400 dark:text-navy-500">→</span>
                          <span className="font-medium text-surface-700 dark:text-navy-300">{item.traspaso.ambienteDestino.nombre}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-surface-500 dark:text-navy-500">{new Date(item.traspaso.fecha).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="shrink-0 border-t border-white/20 dark:border-navy-700/30">
              <Pagination currentPage={pendientesPage} totalItems={pendientesTotalCount} itemsPerPage={pendientesItemsPerPage} onPageChange={(p) => { setPendientesPage(p); setPendientesSelected(new Set()); setPendientesMensaje(null); }} />
            </div>

            {pendientesItems.length > 0 && (
              <div className="shrink-0 px-6 py-4 border-t border-white/10 dark:border-navy-700/20">
                {pendientesMensaje && (
                  <div className={`mb-3 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium ${
                    pendientesMensaje.type === 'ok' ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                  }`}>
                    {pendientesMensaje.type === 'ok' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    {pendientesMensaje.text}
                  </div>
                )}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <select value={ambientesDisponibles.length === 1 ? ambientesDisponibles[0].id : pendientesUbiAmbienteId}
                      onChange={(e) => { setPendientesUbiAmbienteId(e.target.value); setPendientesUbiEstanteId(''); setPendientesUbiPisoId(''); setPendientesMensaje(null); }}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400/50 dark:focus:ring-brand-dark-500/50 transition-all text-sm"
                    >
                      <option value="">Ambiente destino...</option>
                      {ambientesDisponibles.map((a) => (
                        <option key={a.id} value={a.id}>{a.nombre}</option>
                      ))}
                    </select>
                    <select value={pendientesUbiEstanteId} onChange={(e) => { setPendientesUbiEstanteId(e.target.value); setPendientesUbiPisoId(''); setPendientesMensaje(null); }}
                      disabled={!pendientesUbiAmbienteId}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400/50 dark:focus:ring-brand-dark-500/50 transition-all text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <option value="">Estante...</option>
                      {estantesDelAmbiente.sort((a, b) => a.codigo.localeCompare(b.codigo)).map((e) => (
                        <option key={e.id} value={e.id}>{e.codigo}</option>
                      ))}
                    </select>
                    <select value={pendientesUbiPisoId} onChange={(e) => { setPendientesUbiPisoId(e.target.value); setPendientesMensaje(null); }}
                      disabled={!pendientesUbiEstanteId}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400/50 dark:focus:ring-brand-dark-500/50 transition-all text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <option value="">Fila...</option>
                      {pisosDelEstante.sort((a, b) => a.nroFila - b.nroFila).map((p) => (
                        <option key={p.id} value={p.id}>Fila {p.nroFila}{p.descripcion ? ` (${p.descripcion})` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <button onClick={async () => {
                    setPendientesMensaje(null);
                    if (pendientesSelected.size === 0) { setPendientesMensaje({ type: 'err', text: 'Selecciona al menos una carpeta.' }); return; }
                    if (!pendientesUbiPisoId) { setPendientesMensaje({ type: 'err', text: 'Selecciona ambiente, estante y fila destino.' }); return; }
                    try {
                      const { data } = await ubicarPendientes({
                        variables: { idsTraspasoCarpeta: Array.from(pendientesSelected), idPiso: pendientesUbiPisoId },
                      });
                      if (data?.ubicarCarpetas?.success) {
                        setPendientesMensaje({ type: 'ok', text: `✅ ${pendientesSelected.size} carpeta(s) ubicada(s) correctamente.` });
                        setPendientesSelected(new Set());
                        setPendientesUbiAmbienteId('');
                        setPendientesUbiEstanteId('');
                        setPendientesUbiPisoId('');
                        refetchPendientes();
                        refetch();
                      } else {
                        setPendientesMensaje({ type: 'err', text: data?.ubicarCarpetas?.error || 'Error al ubicar.' });
                      }
                    } catch { setPendientesMensaje({ type: 'err', text: 'Error de conexión.' }); }
                  }}
                    disabled={pendientesLoadingUbi || pendientesSelected.size === 0 || !pendientesUbiPisoId}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 dark:from-brand-dark-500 dark:to-blue-500 text-white font-medium shadow-md hover:shadow-lg transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    {pendientesLoadingUbi ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
                    Ubicar ({pendientesSelected.size})
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {editingDoc && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 dark:bg-black/50 backdrop-blur-sm p-4">
          <div className="glass-panel rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-surface-800 dark:text-navy-200">Editar Documento</p>
              <button onClick={closeEditDoc}
                className="p-1 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              ><X size={14} /></button>
            </div>
            <div className="space-y-3">
              <input type="text" placeholder="Código del documento *" value={editDocCodigo}
                onChange={(e) => setEditDocCodigo(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 placeholder:text-surface-500 dark:placeholder:text-navy-500 focus:outline-none focus:ring-2 focus:ring-brand-400/50 dark:focus:ring-brand-dark-500/50 transition-all text-sm"
              />
              <input type="text" placeholder="Título del documento *" value={editDocTitulo}
                onChange={(e) => setEditDocTitulo(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 placeholder:text-surface-500 dark:placeholder:text-navy-500 focus:outline-none focus:ring-2 focus:ring-brand-400/50 dark:focus:ring-brand-dark-500/50 transition-all text-sm"
              />
              <input type="text" placeholder="Tipo de documento (ej. Informe, Contrato, Carta) *" value={editDocTipo}
                onChange={(e) => setEditDocTipo(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 placeholder:text-surface-500 dark:placeholder:text-navy-500 focus:outline-none focus:ring-2 focus:ring-brand-400/50 dark:focus:ring-brand-dark-500/50 transition-all text-sm"
              />
              <div ref={editPersonaRef} className="relative">
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 focus-within:ring-2 focus-within:ring-brand-400/50 dark:focus-within:ring-brand-dark-500/50 transition-all">
                  <UserCheck size={16} className="text-surface-500 dark:text-navy-500 shrink-0" />
                  <input type="text" placeholder="Propietario (persona o institución)" value={editDocPropietario}
                    onChange={(e) => handleEditPersonaSearch(e.target.value)}
                    className="flex-1 bg-transparent text-surface-800 dark:text-navy-200 placeholder:text-surface-500 dark:placeholder:text-navy-500 focus:outline-none text-sm" />
                </div>
                {editShowPersonaDropdown && (
                  <div className="absolute z-50 mt-1 w-full rounded-xl bg-white dark:bg-navy-800 border border-white/40 dark:border-navy-700/40 shadow-lg overflow-hidden">
                    {editPersonaResults.map((p) => (
                      <button key={p.id} type="button" onClick={() => selectEditPersona(p)}
                        className="w-full text-left px-4 py-2.5 text-sm text-surface-800 dark:text-navy-200 hover:bg-brand-50 dark:hover:bg-brand-dark-600/20 transition-colors border-b border-white/10 dark:border-navy-700/20 last:border-b-0"
                      >
                        <span className="font-medium">{p.nombre} {p.apellido}</span>
                        <span className="text-surface-500 dark:text-navy-500 ml-2 text-xs">CI: {p.ci}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {editDocError && <p className="text-xs text-red-600 dark:text-red-400">{editDocError}</p>}
              <div className="flex justify-end gap-2">
                <button onClick={closeEditDoc}
                  className="px-4 py-2 rounded-xl text-surface-600 dark:text-navy-400 bg-white/60 dark:bg-navy-800/60 border border-white/80 dark:border-navy-700/60 hover:bg-white dark:hover:bg-navy-800 transition-colors text-xs font-medium"
                >Cancelar</button>
                <button onClick={handleEditDoc}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 dark:from-brand-dark-500 dark:to-blue-500 text-white font-medium shadow-md text-xs"
                >Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
