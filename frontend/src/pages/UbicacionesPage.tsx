import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  GET_ALL_AMBIENTES, CREAR_AMBIENTE, EDITAR_AMBIENTE,
  GET_ALL_ESTANTES, CREAR_ESTANTE, EDITAR_ESTANTE,
  GET_ALL_PISOS, CREAR_PISO, EDITAR_PISO,
  GET_ALL_CARPETAS_SIMPLE_PAGINATED, CREAR_CARPETA, EDITAR_CARPETA,
} from '../lib/queries';
import { Plus, X, Building2, Archive, Layers, FolderOpen, Filter, Pencil } from 'lucide-react';
import Pagination from '../components/Pagination';
import { usePermission } from '../context/AuthContext';

const tabs = [
  { key: 'ambientes', label: 'Ambientes', icon: Building2 },
  { key: 'estantes', label: 'Estantes', icon: Archive },
  { key: 'pisos', label: 'Pisos', icon: Layers },
  { key: 'carpetas', label: 'Carpetas', icon: FolderOpen },
];

export default function UbicacionesPage() {
  const [activeTab, setActiveTab] = useState('ambientes');
  const [selectedAmbienteId, setSelectedAmbienteId] = useState('');
  const { data: ambData } = useQuery(GET_ALL_AMBIENTES);
  const ambientes = (ambData?.allAmbientes ?? []) as { id: string; nombre: string }[];

  return (
    <>
      <h2 className="text-2xl font-bold text-surface-800 dark:text-navy-200 mb-6">Gestión de Ubicaciones</h2>

      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === t.key
                ? 'bg-brand-600 dark:bg-brand-dark-500 text-white shadow-md shadow-brand-500/30 dark:shadow-brand-dark-600/20'
                : 'bg-white/60 dark:bg-navy-800/60 text-surface-600 dark:text-navy-400 hover:bg-white/80 dark:hover:bg-navy-800/80 border border-white/40 dark:border-navy-700/40'
            }`}
          >
            <t.icon size={18} />
            {t.label}
          </button>
        ))}
      </div>

      {activeTab !== 'ambientes' && (
        <div className="flex items-center gap-3 mb-6">
          <Filter size={16} className="text-surface-500 dark:text-navy-500" />
          <select value={selectedAmbienteId} onChange={(e) => setSelectedAmbienteId(e.target.value)}
            className="w-full max-w-xs px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400/50 transition-all text-sm"
          >
            <option value="">Todos los ambientes</option>
            {ambientes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </div>
      )}

      {activeTab === 'ambientes' && <AmbientesSection />}
      {activeTab === 'estantes' && <EstantesSection selectedAmbienteId={selectedAmbienteId} />}
      {activeTab === 'pisos' && <PisosSection selectedAmbienteId={selectedAmbienteId} />}
      {activeTab === 'carpetas' && <CarpetasSection selectedAmbienteId={selectedAmbienteId} />}
    </>
  );
}

function AmbientesSection() {
  const { hasPerm } = usePermission();
  const { data, loading, refetch } = useQuery(GET_ALL_AMBIENTES);
  const [crear] = useMutation(CREAR_AMBIENTE);
  const [editar] = useMutation(EDITAR_AMBIENTE);
  const [show, setShow] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [error, setError] = useState('');

  const openCreate = () => {
    setEditingId(null); setNombre(''); setUbicacion(''); setDescripcion(''); setError(''); setShow(true);
  };

  const openEdit = (a: { id: string; nombre: string; ubicacion?: string; descripcion?: string }) => {
    setEditingId(a.id); setNombre(a.nombre); setUbicacion(a.ubicacion || ''); setDescripcion(a.descripcion || ''); setError(''); setShow(true);
  };

  const handleSave = async () => {
    setError('');
    if (!nombre) { setError('Nombre es obligatorio'); return; }
    try {
      if (editingId) {
        const vars: Record<string, unknown> = { id: editingId, nombre };
        if (ubicacion) vars.ubicacion = ubicacion; else vars.ubicacion = '';
        if (descripcion) vars.descripcion = descripcion; else vars.descripcion = '';
        const { data: res } = await editar({ variables: vars });
        if (res?.editarAmbiente?.error) throw new Error(res.editarAmbiente.error);
      } else {
        const vars: Record<string, unknown> = { nombre };
        if (ubicacion) vars.ubicacion = ubicacion;
        if (descripcion) vars.descripcion = descripcion;
        const { data: res } = await crear({ variables: vars });
        if (res?.crearAmbiente?.error) throw new Error(res.crearAmbiente.error);
      }
      setShow(false);
      refetch();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  };

  if (loading) return <div className="glass-panel rounded-2xl p-8 text-center text-surface-600 dark:text-navy-500">Cargando...</div>;

  return (
    <SectionShell title="Ambientes" onAdd={hasPerm('gestionar_ubicaciones') ? openCreate : undefined}>
      <table className="w-full">
        <thead><tr className="border-b border-white/20 dark:border-navy-700/30">
          <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase sticky top-0 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm z-10">Nombre</th>
          <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase sticky top-0 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm z-10">Ubicación</th>
          <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase sticky top-0 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm z-10">Descripción</th>
          <th className="text-right px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase sticky top-0 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm z-10">Acción</th>
        </tr></thead>
        <tbody className="divide-y divide-white/10 dark:divide-navy-700/20">
          {(data?.allAmbientes ?? []).map((a: { id: string; nombre: string; ubicacion?: string; descripcion?: string }) => (
            <tr key={a.id} className="hover:bg-white/30 dark:hover:bg-navy-800/50 transition-colors">
              <td className="px-6 py-4 text-sm font-semibold text-surface-800 dark:text-navy-200">{a.nombre}</td>
              <td className="px-6 py-4 text-sm text-surface-600 dark:text-navy-400">{a.ubicacion || '—'}</td>
              <td className="px-6 py-4 text-sm text-surface-600 dark:text-navy-400">{a.descripcion || '—'}</td>
              <td className="px-6 py-4 text-right">
                {hasPerm('gestionar_ubicaciones') && (
                  <button onClick={() => openEdit(a)}
                    className="p-2 rounded-lg text-surface-500 dark:text-navy-500 hover:text-brand-600 dark:hover:text-brand-dark-400 hover:bg-brand-50 dark:hover:bg-brand-dark-600/20 transition-colors"
                  >
                    <Pencil size={16} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {(data?.allAmbientes ?? []).length === 0 && <EmptyState />}
      <Modal show={show} title={editingId ? 'Editar Ambiente' : 'Nuevo Ambiente'} onClose={() => setShow(false)} error={error} onSave={handleSave}>
        <Field label="Nombre *" value={nombre} onChange={setNombre} />
        <Field label="Ubicación" value={ubicacion} onChange={setUbicacion} />
        <Field label="Descripción" value={descripcion} onChange={setDescripcion} />
      </Modal>
    </SectionShell>
  );
}

function EstantesSection({ selectedAmbienteId }: { selectedAmbienteId: string }) {
  const { hasPerm } = usePermission();
  const { data, loading, refetch } = useQuery(GET_ALL_ESTANTES);
  const { data: ambData } = useQuery(GET_ALL_AMBIENTES);
  const [crear] = useMutation(CREAR_ESTANTE);
  const [editar] = useMutation(EDITAR_ESTANTE);
  const [show, setShow] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [codigo, setCodigo] = useState('');
  const [numero, setNumero] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [estado, setEstado] = useState('');
  const [limitePisos, setLimitePisos] = useState('');
  const [idAmbiente, setIdAmbiente] = useState('');
  const [error, setError] = useState('');

  const openCreate = () => {
    setEditingId(null); setCodigo(''); setNumero(''); setDescripcion(''); setEstado(''); setLimitePisos('1'); setIdAmbiente(''); setError(''); setShow(true);
  };

  const openEdit = (e: { id: string; codigo: string; numero?: number; descripcion?: string; estado?: string; limitePisos?: number; ambiente: { id: string } }) => {
    setEditingId(e.id); setCodigo(e.codigo); setNumero(e.numero?.toString() ?? ''); setDescripcion(e.descripcion || ''); setEstado(e.estado || ''); setLimitePisos(e.limitePisos?.toString() ?? ''); setIdAmbiente(e.ambiente.id); setError(''); setShow(true);
  };

  const handleSave = async () => {
    setError('');
    if (!codigo || !idAmbiente) { setError('Código y Ambiente son obligatorios'); return; }
    try {
      if (editingId) {
        const vars: Record<string, unknown> = { id: editingId, codigo };
        if (numero) vars.numero = parseInt(numero); else vars.numero = null;
        if (descripcion) vars.descripcion = descripcion; else vars.descripcion = '';
        if (estado) vars.estado = estado; else vars.estado = '';
        if (limitePisos) vars.limitePisos = parseInt(limitePisos); else vars.limitePisos = null;
        const { data: res } = await editar({ variables: vars });
        if (res?.editarEstante?.error) throw new Error(res.editarEstante.error);
      } else {
        const vars: Record<string, unknown> = { codigo, idAmbiente };
        if (numero) vars.numero = parseInt(numero);
        if (descripcion) vars.descripcion = descripcion;
        if (estado) vars.estado = estado;
        if (limitePisos) vars.limitePisos = parseInt(limitePisos);
        const { data: res } = await crear({ variables: vars });
        if (res?.crearEstante?.error) throw new Error(res.crearEstante.error);
      }
      setShow(false); setCodigo(''); setNumero(''); setDescripcion(''); setEstado(''); setLimitePisos(''); setIdAmbiente('');
      refetch();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  };

  if (loading) return <div className="glass-panel rounded-2xl p-8 text-center text-surface-600 dark:text-navy-500">Cargando...</div>;

  const filtrados = selectedAmbienteId
    ? (data?.allEstantes ?? []).filter((e: { ambiente: { id: string } }) => e.ambiente.id === selectedAmbienteId)
    : (data?.allEstantes ?? []);

  return (
    <SectionShell title="Estantes" onAdd={hasPerm('gestionar_ubicaciones') ? openCreate : undefined}>
      <table className="w-full">
        <thead><tr className="border-b border-white/20 dark:border-navy-700/30">
          <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase sticky top-0 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm z-10">Código</th>
          <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase sticky top-0 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm z-10">Número</th>
          <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase sticky top-0 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm z-10">Ambiente</th>
          <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase sticky top-0 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm z-10">Lím. Pisos</th>
          <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase sticky top-0 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm z-10">Estado</th>
          <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase sticky top-0 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm z-10">Descripción</th>
          <th className="text-right px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase sticky top-0 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm z-10">Acción</th>
        </tr></thead>
        <tbody className="divide-y divide-white/10 dark:divide-navy-700/20">
          {filtrados.map((e: { id: string; codigo: string; numero?: number; descripcion?: string; estado?: string; limitePisos?: number; ambiente: { id: string; nombre: string } }) => (
            <tr key={e.id} className="hover:bg-white/30 dark:hover:bg-navy-800/50 transition-colors">
              <td className="px-6 py-4 text-sm font-semibold text-surface-800 dark:text-navy-200">{e.codigo}</td>
              <td className="px-6 py-4 text-sm text-surface-600 dark:text-navy-400">{e.numero ?? '—'}</td>
              <td className="px-6 py-4 text-sm text-surface-600 dark:text-navy-400">{e.ambiente.nombre}</td>
              <td className="px-6 py-4 text-sm text-surface-600 dark:text-navy-400">{e.limitePisos ?? '∞'}</td>
              <td className="px-6 py-4 text-sm text-surface-600 dark:text-navy-400">{e.estado || '—'}</td>
              <td className="px-6 py-4 text-sm text-surface-600 dark:text-navy-400">{e.descripcion || '—'}</td>
              <td className="px-6 py-4 text-right">
                {hasPerm('gestionar_ubicaciones') && (
                  <button onClick={() => openEdit(e)}
                    className="p-2 rounded-lg text-surface-500 dark:text-navy-500 hover:text-brand-600 dark:hover:text-brand-dark-400 hover:bg-brand-50 dark:hover:bg-brand-dark-600/20 transition-colors"
                  >
                    <Pencil size={16} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtrados.length === 0 && <EmptyState />}
      <Modal show={show} title={editingId ? 'Editar Estante' : 'Nuevo Estante'} onClose={() => setShow(false)} error={error} onSave={handleSave}>
        <Field label="Código *" value={codigo} onChange={setCodigo} />
        <Field label="Número" value={numero} onChange={setNumero} type="number" />
        <Field label="Descripción" value={descripcion} onChange={setDescripcion} />
        <Field label="Estado" value={estado} onChange={setEstado} />
        <Field label="Límite de Pisos" value={limitePisos} onChange={setLimitePisos} type="number" />
        <Select label="Ambiente *" value={idAmbiente} onChange={setIdAmbiente}
          options={(ambData?.allAmbientes ?? []).map((a: { id: string; nombre: string }) => ({ value: a.id, label: a.nombre }))}
        />
      </Modal>
    </SectionShell>
  );
}

function PisosSection({ selectedAmbienteId }: { selectedAmbienteId: string }) {
  const { hasPerm } = usePermission();
  const { data, loading, refetch } = useQuery(GET_ALL_PISOS);
  const { data: estData } = useQuery(GET_ALL_ESTANTES);
  const [crear] = useMutation(CREAR_PISO);
  const [editar] = useMutation(EDITAR_PISO);
  const [show, setShow] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nroFila, setNroFila] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [idEstante, setIdEstante] = useState('');
  const [error, setError] = useState('');

  const openCreate = () => {
    setEditingId(null); setNroFila(''); setDescripcion(''); setIdEstante(''); setError(''); setShow(true);
  };

  const openEdit = (p: { id: string; nroFila: number; descripcion?: string; estante: { id: string } }) => {
    setEditingId(p.id); setNroFila(p.nroFila.toString()); setDescripcion(p.descripcion || ''); setIdEstante(p.estante.id); setError(''); setShow(true);
  };

  const handleSave = async () => {
    setError('');
    if (!nroFila || !idEstante) { setError('N° de fila y Estante son obligatorios'); return; }
    try {
      if (!editingId) {
        const estanteSel = (estData?.allEstantes ?? []).find((e: { id: string; limitePisos?: number }) => e.id === idEstante);
        if (estanteSel?.limitePisos) {
          const pisosExistentes = (data?.allPisos ?? []).filter((p: { estante: { id: string } }) => p.estante.id === idEstante).length;
          if (pisosExistentes >= estanteSel.limitePisos) {
            setError(`Límite de ${estanteSel.limitePisos} pisos alcanzado para este estante.`);
            return;
          }
        }
      }
      if (editingId) {
        const vars: Record<string, unknown> = { id: editingId, nroFila: parseInt(nroFila) };
        if (descripcion) vars.descripcion = descripcion; else vars.descripcion = '';
        const { data: res } = await editar({ variables: vars });
        if (res?.editarPiso?.error) throw new Error(res.editarPiso.error);
      } else {
        const vars: Record<string, unknown> = { nroFila: parseInt(nroFila), idEstante };
        if (descripcion) vars.descripcion = descripcion;
        const { data: res } = await crear({ variables: vars });
        if (res?.crearPiso?.error) throw new Error(res.crearPiso.error);
      }
      setShow(false); setNroFila(''); setDescripcion(''); setIdEstante('');
      refetch();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  };

  if (loading) return <div className="glass-panel rounded-2xl p-8 text-center text-surface-600 dark:text-navy-500">Cargando...</div>;

  const filtrados = selectedAmbienteId
    ? (data?.allPisos ?? []).filter((p: { estante: { ambiente: { id: string } } }) => p.estante.ambiente.id === selectedAmbienteId)
    : (data?.allPisos ?? []);

  const estantesFiltrados = selectedAmbienteId
    ? (estData?.allEstantes ?? []).filter((e: { ambiente: { id: string } }) => e.ambiente.id === selectedAmbienteId)
    : (estData?.allEstantes ?? []);

  return (
    <SectionShell title="Pisos" onAdd={hasPerm('gestionar_ubicaciones') ? openCreate : undefined}>
      <table className="w-full">
        <thead><tr className="border-b border-white/20 dark:border-navy-700/30">
          <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase sticky top-0 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm z-10">N° Fila</th>
          <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase sticky top-0 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm z-10">Estante</th>
          <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase sticky top-0 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm z-10">Descripción</th>
          <th className="text-right px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase sticky top-0 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm z-10">Acción</th>
        </tr></thead>
        <tbody className="divide-y divide-white/10 dark:divide-navy-700/20">
          {filtrados.map((p: { id: string; nroFila: number; descripcion?: string; estante: { id: string; codigo: string } }) => (
            <tr key={p.id} className="hover:bg-white/30 dark:hover:bg-navy-800/50 transition-colors">
              <td className="px-6 py-4 text-sm font-semibold text-surface-800 dark:text-navy-200">{p.nroFila}</td>
              <td className="px-6 py-4 text-sm text-surface-600 dark:text-navy-400">{p.estante.codigo}</td>
              <td className="px-6 py-4 text-sm text-surface-600 dark:text-navy-400">{p.descripcion || '—'}</td>
              <td className="px-6 py-4 text-right">
                {hasPerm('gestionar_ubicaciones') && (
                  <button onClick={() => openEdit(p)}
                    className="p-2 rounded-lg text-surface-500 dark:text-navy-500 hover:text-brand-600 dark:hover:text-brand-dark-400 hover:bg-brand-50 dark:hover:bg-brand-dark-600/20 transition-colors"
                  >
                    <Pencil size={16} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtrados.length === 0 && <EmptyState />}
      <Modal show={show} title={editingId ? 'Editar Piso' : 'Nuevo Piso'} onClose={() => setShow(false)} error={error} onSave={handleSave}>
        <Field label="N° Fila *" value={nroFila} onChange={setNroFila} type="number" />
        <Field label="Descripción" value={descripcion} onChange={setDescripcion} />
        <Select label="Estante *" value={idEstante} onChange={setIdEstante}
          options={estantesFiltrados.map((e: { id: string; codigo: string; limitePisos?: number }) => {
            const pisosExistentes = (data?.allPisos ?? []).filter((p: { estante: { id: string } }) => p.estante.id === e.id).length;
            const disabled = !!e.limitePisos && pisosExistentes >= e.limitePisos;
            return { value: e.id, label: `${e.codigo}${disabled ? ' (lleno)' : ''}`, disabled };
          })}
        />
      </Modal>
    </SectionShell>
  );
}

function CarpetasSection({ selectedAmbienteId }: { selectedAmbienteId: string }) {
  const { hasPerm } = usePermission();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { data, loading, refetch } = useQuery(GET_ALL_CARPETAS_SIMPLE_PAGINATED, {
    variables: { page: currentPage, pageSize: itemsPerPage, ambienteId: selectedAmbienteId || undefined },
    fetchPolicy: 'network-only',
  });
  const { data: pisoData } = useQuery(GET_ALL_PISOS);
  const { data: ambFormData } = useQuery(GET_ALL_AMBIENTES);
  const { data: estFormData } = useQuery(GET_ALL_ESTANTES);
  const [crear] = useMutation(CREAR_CARPETA);
  const [editar] = useMutation(EDITAR_CARPETA);
  const [show, setShow] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [formAmbienteId, setFormAmbienteId] = useState('');
  const [formEstanteId, setFormEstanteId] = useState('');
  const [idPiso, setIdPiso] = useState('');
  const [error, setError] = useState('');

  const openCreate = () => {
    setEditingId(null); setDescripcion(''); setFormAmbienteId(''); setFormEstanteId(''); setIdPiso(''); setError(''); setShow(true);
  };

  const openEdit = (c: { id: string; descripcion: string; piso: { id: string; estante: { id: string; ambiente: { id: string } } } }) => {
    setEditingId(c.id); setDescripcion(c.descripcion || ''); setFormAmbienteId(c.piso.estante.ambiente.id); setFormEstanteId(c.piso.estante.id); setIdPiso(c.piso.id); setError(''); setShow(true);
  };

  const handleSave = async () => {
    setError('');
    if (!descripcion) { setError('Debe ingresar una descripción'); return; }
    if (!formAmbienteId) { setError('Debe seleccionar un Ambiente'); return; }
    if (!formEstanteId) { setError('Debe seleccionar un Estante'); return; }
    if (!idPiso) { setError('Debe seleccionar un Piso'); return; }
    try {
      if (editingId) {
        const vars: Record<string, unknown> = { id: editingId, descripcion };
        const { data: res } = await editar({ variables: vars });
        if (res?.editarCarpeta?.error) throw new Error(res.editarCarpeta.error);
      } else {
        const { data: res } = await crear({ variables: { descripcion, idPiso } });
        if (res?.crearCarpeta?.error) throw new Error(res.crearCarpeta.error);
      }
      setShow(false); setDescripcion(''); setIdPiso('');
      refetch();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  };

  if (loading) return <div className="glass-panel rounded-2xl p-8 text-center text-surface-600 dark:text-navy-500">Cargando...</div>;

  const filtrados = (data?.allCarpetasPaginated?.items ?? []) as {
    id: string; descripcion: string; estado: string;
    piso: { id: string; nroFila: number; estante: { codigo: string; ambiente: { id: string; nombre: string } } }
  }[];
  const totalCount = data?.allCarpetasPaginated?.totalCount ?? 0;

  return (
    <SectionShell title="Carpetas" onAdd={hasPerm('gestionar_ubicaciones') ? openCreate : undefined}
      footer={<div className="shrink-0 border-t border-white/20 dark:border-navy-700/30"><Pagination currentPage={currentPage} totalItems={totalCount} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} /></div>}
    >
      <table className="w-full">
        <thead><tr className="border-b border-white/20 dark:border-navy-700/30">
          <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase sticky top-0 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm z-10">Descripción</th>
          <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase sticky top-0 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm z-10">Piso</th>
          <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase sticky top-0 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm z-10">Estante</th>
          <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase sticky top-0 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm z-10">Ambiente</th>
          <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase sticky top-0 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm z-10">Estado</th>
          <th className="text-right px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase sticky top-0 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm z-10">Acción</th>
        </tr></thead>
        <tbody className="divide-y divide-white/10 dark:divide-navy-700/20">
          {filtrados.map((c: {
            id: string; descripcion: string; estado: string;
            piso: { id: string; nroFila: number; estante: { codigo: string; ambiente: { id: string; nombre: string } } }
          }) => (
            <tr key={c.id} className="hover:bg-white/30 dark:hover:bg-navy-800/50 transition-colors">
              <td className="px-6 py-4 text-sm font-semibold text-surface-800 dark:text-navy-200">{c.descripcion}</td>
              <td className="px-6 py-4 text-sm text-surface-600 dark:text-navy-400">{c.piso.nroFila}</td>
              <td className="px-6 py-4 text-sm text-surface-600 dark:text-navy-400">{c.piso.estante.codigo}</td>
              <td className="px-6 py-4 text-sm text-surface-600 dark:text-navy-400">{c.piso.estante.ambiente.nombre}</td>
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
              <td className="px-6 py-4 text-right">
                {hasPerm('gestionar_ubicaciones') && (
                  <button onClick={() => openEdit(c)}
                    className="p-2 rounded-lg text-surface-500 dark:text-navy-500 hover:text-brand-600 dark:hover:text-brand-dark-400 hover:bg-brand-50 dark:hover:bg-brand-dark-600/20 transition-colors"
                  >
                    <Pencil size={16} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {totalCount === 0 && <EmptyState />}
      <Modal show={show} title={editingId ? 'Editar Carpeta' : 'Nueva Carpeta'} onClose={() => setShow(false)} error={error} onSave={handleSave}>
        <Field label="Descripción *" value={descripcion} onChange={setDescripcion} />
        <Select label="Ambiente *" value={formAmbienteId} onChange={(v) => { setFormAmbienteId(v); setFormEstanteId(''); setIdPiso(''); }}
          options={(ambFormData?.allAmbientes ?? []).map((a: { id: string; nombre: string }) => ({ value: a.id, label: a.nombre }))}
        />
        {formAmbienteId && (
          <Select label="Estante *" value={formEstanteId} onChange={(v) => { setFormEstanteId(v); setIdPiso(''); }}
            options={(estFormData?.allEstantes ?? [])
              .filter((e: { ambiente: { id: string } }) => e.ambiente.id === formAmbienteId)
              .map((e: { id: string; codigo: string }) => ({ value: e.id, label: e.codigo }))}
          />
        )}
        {formEstanteId && (
          <Select label="Piso *" value={idPiso} onChange={setIdPiso}
            options={(pisoData?.allPisos ?? [])
              .filter((p: { estante: { id: string } }) => p.estante.id === formEstanteId)
              .map((p: { id: string; nroFila: number }) => ({ value: p.id, label: `Fila ${p.nroFila}` }))}
          />
        )}
      </Modal>
    </SectionShell>
  );
}

function SectionShell({ title, onAdd, footer, children }: { title: string; onAdd?: () => void; footer?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="glass-panel rounded-2xl flex flex-col" style={{ maxHeight: 'calc(100vh - 250px)' }}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/20 dark:border-navy-700/30 shrink-0">
        <h3 className="text-lg font-bold text-surface-800 dark:text-navy-200">{title}</h3>
        {onAdd && (
          <button onClick={onAdd} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 dark:from-brand-dark-500 dark:to-blue-500 text-white font-medium shadow-md shadow-brand-500/30 dark:shadow-brand-dark-600/20 hover:shadow-lg transition-all text-xs">
            <Plus size={14} /> Nuevo
          </button>
        )}
      </div>
      <div className="overflow-auto flex-1">{children}</div>
      {footer}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-10 text-surface-500 dark:text-navy-500">
      <p className="text-sm font-medium">No hay registros</p>
    </div>
  );
}

function Modal({ show, title, onClose, error, onSave, children }: {
  show: boolean; title: string; onClose: () => void; error: string; onSave: () => void; children: React.ReactNode;
}) {
  if (!show) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/70 backdrop-blur-sm p-4">
      <div className="glass-panel rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-surface-800 dark:text-navy-200">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-700 dark:text-red-300 dark:hover:text-red-400 transition-colors">
            <X size={20} />
          </button>
        </div>
        {error && <div className="mb-4 bg-red-50 dark:bg-red-900/30 border border-red-200 text-red-700 dark:text-red-300 text-sm rounded-xl px-4 py-2.5">{error}</div>}
        <div className="grid grid-cols-1 gap-4 mb-6">{children}</div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-surface-600 dark:text-navy-400 bg-white/60 dark:bg-navy-800/60 border border-white/80 dark:border-navy-700/60 hover:bg-white dark:hover:bg-navy-800 transition-colors text-sm font-medium">Cancelar</button>
          <button onClick={onSave} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 dark:from-brand-dark-500 dark:to-blue-500 text-white font-medium shadow-md shadow-brand-500/30 dark:shadow-brand-dark-600/20 hover:shadow-lg transition-all text-sm">Guardar</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-surface-700 dark:text-navy-300 mb-1.5">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400/50 transition-all"
      />
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string; disabled?: boolean }[] }) {
  return (
    <div>
      <label className="block text-sm font-medium text-surface-700 dark:text-navy-300 mb-1.5">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400/50 transition-all"
      >
        <option value="">Seleccionar...</option>
        {options.map((o) => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
      </select>
    </div>
  );
}
