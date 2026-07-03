import { useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { X, Calendar, Search, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { GET_ALL_PRESTAMOS_ACTIVOS_PAGINATED } from '../../lib/queries';

interface Props {
  onClose: () => void;
  onRegistrar: (vars: { prestamoId: string; personaSolicitaId: string; diasOtorgados: number; motivo?: string }) => Promise<string>;
}

export default function RegistrarProrrogaModal({ onClose, onRegistrar }: Props) {
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPrestamo, setSelectedPrestamo] = useState<{
    id: string; personaId: string; label: string;
  } | null>(null);
  const [dias, setDias] = useState(15);
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const { data: prestamosData, loading: loadingPrestamos } = useQuery(
    GET_ALL_PRESTAMOS_ACTIVOS_PAGINATED,
    {
      variables: { page: 1, pageSize: 5, search: searchQuery },
      skip: !searchQuery,
      fetchPolicy: 'network-only',
    },
  );

  const resultados = prestamosData?.allPrestamosActivosPaginated?.items ?? [];

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setSearchQuery(searchInput.trim());
      setSelectedPrestamo(null);
    }
  };

  const handleSelectPrestamo = (p: { id: string; personaId: string; personaNombre: string; personaApellido: string; fechaPrest: string }) => {
    setSelectedPrestamo({
      id: p.id,
      personaId: p.personaId,
      label: `${p.personaNombre} ${p.personaApellido} — ${new Date(p.fechaPrest).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}`,
    });
  };

  const handleSubmit = async () => {
    if (!selectedPrestamo) { setMsg('Selecciona un préstamo'); return; }
    if (dias < 1) { setMsg('Los días deben ser mayor a 0'); return; }
    setSaving(true);
    const res = await onRegistrar({
      prestamoId: selectedPrestamo.id,
      personaSolicitaId: selectedPrestamo.personaId,
      diasOtorgados: dias,
      motivo: motivo || undefined,
    });
    setMsg(res);
    setSaving(false);
    if (res.startsWith('✅')) {
      setTimeout(() => onClose(), 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/70 backdrop-blur-sm p-4">
      <div className="glass-panel rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-surface-800 dark:text-navy-200 flex items-center gap-2">
            <Calendar size={20} className="text-brand-600" />
            Registrar Prórroga
          </h3>
          <button onClick={onClose}
            className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-100 transition-colors"
          ><X size={20} /></button>
        </div>

        {msg && (
          <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm font-medium ${
            msg.startsWith('✅')
              ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
          }`}>{msg}</div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-surface-600 dark:text-navy-500 mb-1">
              Préstamo activo
            </label>

            {selectedPrestamo ? (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-50 dark:bg-brand-dark-600/20 border border-brand-200 dark:border-brand-dark-600/30">
                <CheckCircle2 size={18} className="text-brand-600 dark:text-brand-dark-400 shrink-0" />
                <span className="flex-1 text-sm font-semibold text-surface-800 dark:text-navy-200">
                  {selectedPrestamo.label}
                </span>
                <button onClick={() => { setSelectedPrestamo(null); setSearchQuery(''); setSearchInput(''); }}
                  className="text-xs text-brand-600 dark:text-brand-dark-400 underline hover:no-underline shrink-0"
                >Cambiar</button>
              </div>
            ) : (
              <div>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500 dark:text-navy-500" size={16} />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o apellido..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={handleSearch}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 placeholder:text-surface-600 dark:placeholder:text-navy-500 focus:outline-none focus:ring-2 focus:ring-brand-400/50 transition-all text-sm"
                  />
                </div>

                {searchQuery && (
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                    {loadingPrestamos ? (
                      <div className="flex justify-center py-4">
                        <Loader2 size={20} className="animate-spin text-brand-600" />
                      </div>
                    ) : resultados.length === 0 ? (
                      <p className="text-sm text-surface-500 dark:text-navy-500 text-center py-4">
                        Sin resultados para "{searchQuery}"
                      </p>
                    ) : (
                      resultados.map((p: any) => (
                        <button key={p.id} onClick={() => handleSelectPrestamo({
                          id: p.id,
                          personaId: p.persona.id,
                          personaNombre: p.persona.nombre,
                          personaApellido: p.persona.apellido,
                          fechaPrest: p.fechaPrest,
                        })}
                          className="w-full text-left px-4 py-3 rounded-xl bg-white/40 dark:bg-navy-800/40 border border-transparent hover:bg-white/60 dark:hover:bg-navy-800/60 text-surface-700 dark:text-navy-300 transition-all text-sm flex items-center gap-3"
                        >
                          <Circle size={18} className="text-surface-400 shrink-0" />
                          <span className="font-semibold">{p.persona.nombre} {p.persona.apellido}</span>
                          <span className="ml-auto text-xs text-surface-500 dark:text-navy-500">
                            {new Date(p.fechaPrest).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}

                {!searchQuery && (
                  <p className="text-xs text-surface-500 dark:text-navy-500 text-center py-3">
                    Escribe un nombre y presiona Enter para buscar
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-surface-600 dark:text-navy-500 mb-1">Días a extender</label>
            <input type="number" value={dias} min={1} max={90}
              onChange={(e) => setDias(parseInt(e.target.value) || 0)}
              className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400/50 transition-all text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-surface-600 dark:text-navy-500 mb-1">Motivo (opcional)</label>
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)}
              rows={3} placeholder="Ej: necesita más tiempo para revisión..."
              className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 placeholder:text-surface-600 focus:outline-none focus:ring-2 focus:ring-brand-400/50 transition-all resize-none text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/20 dark:border-navy-700/30">
          <button onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-surface-600 dark:text-navy-400 bg-white/60 dark:bg-navy-800/60 border border-white/80 dark:border-navy-700/60 hover:bg-white dark:hover:bg-navy-800 transition-colors text-sm font-medium"
          >Cancelar</button>
          <button onClick={handleSubmit} disabled={saving || !selectedPrestamo}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 dark:from-brand-dark-500 dark:to-blue-500 text-white font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
          ><Calendar size={16} /> {saving ? 'Registrando...' : 'Registrar Prórroga'}</button>
        </div>
      </div>
    </div>
  );
}
