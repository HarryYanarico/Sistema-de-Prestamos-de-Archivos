import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { useSearchParams } from 'react-router-dom';
import { GET_ALL_PERSONAS, GET_ALL_PERSONAS_PAGINATED, CREAR_PERSONA, ACTUALIZAR_PERSONA } from '../lib/queries';
import { UserPlus, Pencil, X, Search } from 'lucide-react';
import Pagination from '../components/Pagination';

interface FormData {
  ci: string;
  nombre: string;
  apellido: string;
  telefono: string;
  email: string;
  direccion: string;
  cargo: string;
  tipoEntidad: string;
}

const emptyForm: FormData = {
  ci: '', nombre: '', apellido: '', telefono: '', email: '', direccion: '', cargo: '', tipoEntidad: 'persona',
};

interface PersonaItem {
  id: string; ci: string; nombre: string; apellido: string;
  telefono?: string; email?: string; direccion?: string; cargo?: string; tipoEntidad?: string;
}
interface PersonasPaginatedData { allPersonasPaginated: { items: PersonaItem[]; totalCount: number }; }
interface MutationPersonaData { crearPersona?: { error?: string }; actualizarPersona?: { error?: string }; }

export default function PersonasPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [searchParams] = useSearchParams();
  const urlQ = searchParams.get('q') || '';
  const [searchInput, setSearchInput] = useState(urlQ);
  const [searchQuery, setSearchQuery] = useState(urlQ);
  const [prevUrlQ, setPrevUrlQ] = useState(urlQ);
  if (urlQ !== prevUrlQ) {
    setPrevUrlQ(urlQ);
    setSearchInput(urlQ);
    setSearchQuery(urlQ);
    setCurrentPage(1);
  }
  const { data, loading, refetch } = useQuery<PersonasPaginatedData>(GET_ALL_PERSONAS_PAGINATED, {
    variables: { page: currentPage, pageSize: itemsPerPage, search: searchQuery || undefined },
    fetchPolicy: 'network-only',
  });
  const [crearPersona] = useMutation<MutationPersonaData>(CREAR_PERSONA, {
    refetchQueries: [{ query: GET_ALL_PERSONAS }],
  });
  const [actualizarPersona] = useMutation<MutationPersonaData>(ACTUALIZAR_PERSONA, {
    refetchQueries: [{ query: GET_ALL_PERSONAS }],
  });

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [formError, setFormError] = useState('');

  const rawItems = (data?.allPersonasPaginated?.items ?? []) as PersonaItem[];

  const items = [...rawItems].sort((a, b) => b.id.localeCompare(a.id));

  const totalCount = data?.allPersonasPaginated?.totalCount ?? 0;

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setFormError('');
  };

  const openEdit = (p: typeof items[0]) => {
    setEditingId(p.id);
    setForm({
      ci: p.ci,
      nombre: p.nombre,
      apellido: p.apellido,
      telefono: p.telefono ?? '',
      email: p.email ?? '',
      direccion: p.direccion ?? '',
      cargo: p.cargo ?? '',
      tipoEntidad: p.tipoEntidad ?? 'persona',
    });
    setShowForm(true);
    setFormError('');
  };

  const handleSave = async () => {
    setFormError('');
    if (!form.ci || !form.nombre || !form.apellido) {
      setFormError('CI, nombre y apellido son obligatorios');
      return;
    }
    try {
      const vars: Record<string, unknown> = {
        ci: form.ci,
        nombre: form.nombre,
        apellido: form.apellido,
      };
      if (form.telefono) vars.telefono = form.telefono;
      if (form.email) vars.email = form.email;
      if (form.direccion) vars.direccion = form.direccion;
      if (form.cargo) vars.cargo = form.cargo;
      if (form.tipoEntidad) vars.tipoEntidad = form.tipoEntidad;

      if (editingId) {
        vars.id = editingId;
        const { data: res } = await actualizarPersona({ variables: vars });
        if (res?.actualizarPersona?.error) throw new Error(res.actualizarPersona.error);
      } else {
        const { data: res } = await crearPersona({ variables: vars });
        if (res?.crearPersona?.error) throw new Error(res.crearPersona.error);
      }
      setShowForm(false);
      setEditingId(null);
      refetch();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar');
    }
  };

  if (loading) {
    return <div className="glass-panel rounded-2xl p-8 text-center text-surface-600 dark:text-navy-500">Cargando personas...</div>;
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-surface-800 dark:text-navy-200">Registro de Personas</h2>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 text-white font-medium shadow-md shadow-brand-500/30 dark:from-brand-dark-500 dark:to-blue-500 dark:shadow-brand-dark-600/20 hover:shadow-lg transition-all text-sm"
        >
          <UserPlus size={16} />
          Registrar Persona
        </button>
      </div>

      <div className="relative mb-6">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500 dark:text-navy-500 cursor-pointer"
          size={18}
          onClick={() => { setSearchQuery(searchInput); setCurrentPage(1); }}
        />
        <input
          type="text"
          placeholder="Buscar por CI, nombre o apellido... (Enter para buscar)"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { setSearchQuery(searchInput); setCurrentPage(1); } }}
          className="w-full pl-11 pr-4 py-3 rounded-xl glass-panel bg-white/60 dark:bg-navy-800/60 text-surface-800 dark:text-navy-200 placeholder:text-surface-500 dark:placeholder:text-navy-500 focus:outline-none focus:ring-2 focus:ring-brand-400/50 transition-all"
        />
      </div>

      <div className="glass-panel rounded-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/20 dark:border-navy-700/30">
          <h3 className="text-lg font-bold text-surface-800 dark:text-navy-200">Personas</h3>
          <span className="text-sm text-surface-600 dark:text-navy-500">{totalCount} resultado(s)</span>
        </div>
        <div className="overflow-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/20 dark:border-navy-700/30">
                <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase tracking-wider">CI</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase tracking-wider">Nombre</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase tracking-wider">Teléfono</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase tracking-wider">Email</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase tracking-wider">Cargo</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase tracking-wider">Tipo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 dark:divide-navy-700/20">
              {items.map((p) => (
                <tr key={p.id} onClick={() => openEdit(p)}
                  className="hover:bg-white/30 dark:hover:bg-navy-800/50 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4 text-sm font-medium text-surface-800 dark:text-navy-200">{p.ci}</td>
                  <td className="px-6 py-4 text-sm text-surface-700 dark:text-navy-300">{p.nombre} {p.apellido}</td>
                  <td className="px-6 py-4 text-sm text-surface-600 dark:text-navy-400">{p.telefono || '—'}</td>
                  <td className="px-6 py-4 text-sm text-surface-600 dark:text-navy-400">{p.email || '—'}</td>
                  <td className="px-6 py-4">
                    {p.cargo ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-100 text-brand-700 dark:bg-brand-dark-600/20 dark:text-brand-dark-400">
                        {p.cargo}
                      </span>
                    ) : (
                      <span className="text-xs text-surface-500 dark:text-navy-500">Sin cargo</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      p.tipoEntidad === 'empresa' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' :
                      p.tipoEntidad === 'institucion' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                      'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                    }`}>
                      {p.tipoEntidad === 'empresa' ? 'Empresa' : p.tipoEntidad === 'institucion' ? 'Institución' : 'Persona Natural'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalCount === 0 && (
            <div className="text-center py-12 text-surface-500 dark:text-navy-500">
              <p className="text-lg font-medium">No se encontraron personas</p>
            </div>
          )}
        </div>
        <Pagination currentPage={currentPage} totalItems={totalCount} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-panel rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-surface-800 dark:text-navy-200 flex items-center gap-2">
                {editingId ? <Pencil size={20} /> : <UserPlus size={20} />}
                {editingId ? 'Editar Persona' : 'Registrar Persona'}
              </h3>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-400 transition-colors">
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300 text-sm rounded-xl px-4 py-2.5">{formError}</div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <Field label="CI *" value={form.ci} onChange={(v) => setForm({ ...form, ci: v })} />
              <Field label="Nombre *" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} />
              <Field label="Apellido *" value={form.apellido} onChange={(v) => setForm({ ...form, apellido: v })} />
              <Field label="Teléfono" value={form.telefono} onChange={(v) => setForm({ ...form, telefono: v })} />
              <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              <Field label="Dirección" value={form.direccion} onChange={(v) => setForm({ ...form, direccion: v })} />
              <Field label="Cargo" value={form.cargo} onChange={(v) => setForm({ ...form, cargo: v })} />
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-navy-300 mb-1.5">Tipo de Entidad</label>
                <select value={form.tipoEntidad} onChange={(e) => setForm({ ...form, tipoEntidad: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400/50 transition-all"
                >
                  <option value="persona">Persona Natural</option>
                  <option value="institucion">Institución</option>
                  <option value="empresa">Empresa</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 rounded-xl text-surface-600 dark:text-navy-400 bg-white/60 dark:bg-navy-800/60 border border-white/80 dark:border-navy-700/60 hover:bg-white dark:hover:bg-navy-800 transition-colors text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 text-white font-medium shadow-md shadow-brand-500/30 dark:from-brand-dark-500 dark:to-blue-500 dark:shadow-brand-dark-600/20 hover:shadow-lg transition-all text-sm"
              >
                {editingId ? 'Actualizar Persona' : 'Registrar Persona'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-surface-700 dark:text-navy-300 mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400/50 transition-all"
      />
    </div>
  );
}
