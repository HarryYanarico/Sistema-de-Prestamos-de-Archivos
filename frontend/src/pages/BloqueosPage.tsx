import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useLazyQuery } from '@apollo/client/react';
import { createPortal } from 'react-dom';
import {
  GET_ALL_BLOQUEOS_PAGINATED, GET_ALL_PERSONAS_PAGINATED,
  CREAR_BLOQUEO, DESBLOQUEAR_PERSONA,
} from '../lib/queries';
import {
  Ban, CheckCircle2, Search, X, AlertTriangle, Phone, Mail,
  Briefcase, Loader2, Shield, ShieldOff,
} from 'lucide-react';

interface UsuarioMini {
  id: string; username: string; firstName: string; lastName: string;
}

interface PersonaMini {
  id: string; ci: string; nombre: string; apellido: string;
  telefono?: string; email?: string; cargo?: string;
}

interface Bloqueo {
  id: string; fechaBloq: string; motivoBloq: string;
  fechaDesbloq?: string | null; motivoDesbloq?: string | null;
  usuario?: UsuarioMini | null; usuarioDesbloqueo?: UsuarioMini | null;
  persona?: PersonaMini | null;
}

interface PersonaSearchResult extends PersonaMini {
  direccion?: string; tipoEntidad: string;
  bloqueoActivo?: { id: string; fechaBloq: string; motivoBloq: string } | null;
}

interface BloqueosPaginatedData {
  allBloqueosPaginated: { items: Bloqueo[]; totalCount: number };
}
interface PersonasPaginatedData {
  allPersonasPaginated: { items: PersonaSearchResult[]; totalCount: number };
}
interface CrearBloqueoData {
  crearBloqueo?: { bloqueo?: { id: string }; success?: boolean; error?: string };
}
interface DesbloquearData {
  desbloquearPersona?: { bloqueo?: { id: string }; success?: boolean; error?: string };
}

export default function BloqueosPage() {
  // Search
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Block modal
  const [blockTarget, setBlockTarget] = useState<{ id: string; nombre: string; ci: string } | null>(null);
  const [blockMotivo, setBlockMotivo] = useState('');
  const [blockMsg, setBlockMsg] = useState('');

  // Unblock modal
  const [unblockTarget, setUnblockTarget] = useState<{ bloqueoId: string; nombre: string } | null>(null);
  const [unblockMotivo, setUnblockMotivo] = useState('');
  const [unblockMsg, setUnblockMsg] = useState('');

  // Detail modal
  const [selectedBloqueo, setSelectedBloqueo] = useState<Bloqueo | null>(null);

  const bloqueosQ = useQuery<BloqueosPaginatedData>(GET_ALL_BLOQUEOS_PAGINATED, {
    variables: { page: 1, pageSize: 5 },
    fetchPolicy: 'network-only',
  });

  const [buscarPersonas, { data: searchData, loading: searchLoading }] = useLazyQuery<PersonasPaginatedData>(GET_ALL_PERSONAS_PAGINATED, {
    fetchPolicy: 'network-only',
  });

  const [crearBloqueo, { loading: blockLoading }] = useMutation<CrearBloqueoData>(CREAR_BLOQUEO, {
    refetchQueries: [
      { query: GET_ALL_BLOQUEOS_PAGINATED, variables: { page: 1, pageSize: 5 } },
    ],
  });

  const [desbloquear, { loading: unblockLoading }] = useMutation<DesbloquearData>(DESBLOQUEAR_PERSONA, {
    refetchQueries: [
      { query: GET_ALL_BLOQUEOS_PAGINATED, variables: { page: 1, pageSize: 5 } },
    ],
  });

  const bloqueos = useMemo(
    () => (bloqueosQ.data?.allBloqueosPaginated?.items ?? []) as Bloqueo[],
    [bloqueosQ.data],
  );
  const searchResults = (searchData?.allPersonasPaginated?.items ?? []) as PersonaSearchResult[];

  const personaTieneBloqueoActivo = useCallback((personaId: string) => {
    return bloqueos.some((b: Bloqueo) => b.persona?.id === personaId && !b.fechaDesbloq);
  }, [bloqueos]);

  const handleSearch = () => {
    const q = searchInput.trim();
    setSearchQuery(q);
    if (q) {
      buscarPersonas({ variables: { page: 1, pageSize: 20, search: q } });
    }
  };

  const handleBloquear = async () => {
    if (!blockTarget) return;
    setBlockMsg('');
    try {
      const { data } = await crearBloqueo({ variables: { personaId: blockTarget.id, motivo: blockMotivo || undefined } });
      if (data?.crearBloqueo?.error) throw new Error(data.crearBloqueo.error);
      setBlockMsg('Persona bloqueada correctamente.');
      setTimeout(() => { setBlockTarget(null); setBlockMotivo(''); setBlockMsg(''); }, 1500);
    } catch (err: unknown) {
      setBlockMsg(err instanceof Error ? err.message : 'Error al bloquear');
    }
  };

  const handleDesbloquear = async () => {
    if (!unblockTarget) return;
    setUnblockMsg('');
    try {
      const { data } = await desbloquear({
        variables: { bloqueoId: unblockTarget.bloqueoId, motivoDesbloq: unblockMotivo || undefined },
      });
      if (data?.desbloquearPersona?.error) throw new Error(data.desbloquearPersona.error);
      setSelectedBloqueo(null);
      setUnblockTarget(null);
      setUnblockMotivo('');
    } catch (err: unknown) {
      setUnblockMsg(err instanceof Error ? err.message : 'Error al desbloquear');
    }
  };

  const formatDate = (d: string) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-800 dark:text-navy-200">Bloqueos</h1>
        <p className="text-surface-500 dark:text-navy-400 text-sm mt-1">Administre los bloqueos de personas.</p>
      </div>

      {/* Search */}
      <div className="glass-panel rounded-2xl p-4">
        <label className="block text-sm font-medium text-surface-700 dark:text-navy-300 mb-2">Buscar persona para bloquear</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              placeholder="Nombre, CI o apellido..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-surface-300/80 dark:border-navy-600/50 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:focus:ring-brand-dark-500/50 transition-all"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searchLoading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 dark:from-brand-dark-500 dark:to-blue-500 text-white font-medium shadow-md shadow-brand-500/30 dark:shadow-brand-dark-600/20 hover:shadow-lg transition-all disabled:opacity-50 text-sm"
          >
            {searchLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Buscar
          </button>
        </div>

        {searchQuery && (
          <div className="mt-3 border-t border-white/20 dark:border-navy-700/30 pt-3">
            {searchLoading ? (
              <div className="flex items-center gap-2 text-sm text-surface-500 dark:text-navy-400 py-2">
                <Loader2 size={14} className="animate-spin" /> Buscando...
              </div>
            ) : searchResults.length === 0 ? (
              <p className="text-sm text-surface-500 dark:text-navy-400 py-2 text-center">Sin resultados para &quot;{searchQuery}&quot;</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {searchResults.map((p: PersonaSearchResult) => {
                  const bloqueado = personaTieneBloqueoActivo(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setBlockTarget({ id: p.id, nombre: `${p.nombre} ${p.apellido}`, ci: p.ci });
                        setBlockMotivo('');
                        setBlockMsg('');
                      }}
                      className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-dark-600/20 text-sm text-surface-700 dark:text-navy-300 transition-colors"
                    >
                      <span>
                        {p.nombre} {p.apellido}
                        <span className="text-xs text-surface-500 dark:text-navy-500 ml-2">({p.ci})</span>
                      </span>
                      {bloqueado ? (
                        <span className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1"><Ban size={12} /> Bloqueado</span>
                      ) : (
                        <span className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1"><CheckCircle2 size={12} /> Activo</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recent bloqueos */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/20 dark:border-navy-700/30">
          <h2 className="text-lg font-bold text-surface-800 dark:text-navy-200 flex items-center gap-2">
            <Ban size={18} className="text-red-500" />
            Últimos bloqueos
          </h2>
          <span className="text-sm text-surface-500 dark:text-navy-400">{bloqueos.length} registro(s)</span>
        </div>

        {bloqueosQ.loading ? (
          <div className="flex items-center justify-center py-8 text-surface-500 dark:text-navy-500">
            <Loader2 size={20} className="animate-spin mr-2" /> Cargando...
          </div>
        ) : bloqueos.length === 0 ? (
          <div className="text-center py-8 text-surface-500 dark:text-navy-500">
            <Ban size={40} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">No hay bloqueos registrados</p>
          </div>
        ) : (
          <div className="divide-y divide-white/10 dark:divide-navy-700/20">
            {bloqueos.map((b: Bloqueo) => {
              const activo = !b.fechaDesbloq;
              return (
                <button
                  key={b.id}
                  onClick={() => setSelectedBloqueo(b)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/30 dark:hover:bg-navy-800/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`p-2 rounded-lg ${activo ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                      {activo ? <Ban size={16} className="text-red-600 dark:text-red-400" /> : <CheckCircle2 size={16} className="text-green-600 dark:text-green-400" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-surface-800 dark:text-navy-200 truncate">
                        {b.persona ? `${b.persona.nombre} ${b.persona.apellido}` : '—'}
                      </p>
                      <p className="text-xs text-surface-500 dark:text-navy-400 mt-0.5 truncate">
                        <span className="font-medium">{b.motivoBloq}</span>
                        {b.usuario && <span> &mdash; por {b.usuario.firstName} {b.usuario.lastName}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className="text-xs text-surface-500 dark:text-navy-500">{formatDate(b.fechaBloq)}</span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      activo
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                        : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                    }`}>
                      {activo ? 'Activo' : 'Resuelto'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedBloqueo && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-panel rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold text-surface-800 dark:text-navy-200 flex items-center gap-2">
                Detalle de Bloqueo
              </h3>
              <button onClick={() => { setSelectedBloqueo(null); setBlockTarget(null); }}
                className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              ><X size={20} /></button>
            </div>

            <div className="space-y-4">
              {/* Persona info */}
              {selectedBloqueo.persona && (
                <div className="p-4 rounded-xl bg-white/40 dark:bg-navy-800/40 border border-white/20 dark:border-navy-700/30">
                  <p className="text-xs font-semibold text-surface-500 dark:text-navy-500 uppercase mb-2">Persona</p>
                  <p className="font-semibold text-surface-800 dark:text-navy-200">
                    {selectedBloqueo.persona.nombre} {selectedBloqueo.persona.apellido}
                  </p>
                  {selectedBloqueo.persona.ci && (
                    <p className="text-sm text-surface-600 dark:text-navy-400 mt-0.5">CI: {selectedBloqueo.persona.ci}</p>
                  )}
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-surface-500 dark:text-navy-400">
                    {selectedBloqueo.persona.telefono && <span className="flex items-center gap-1"><Phone size={12} /> {selectedBloqueo.persona.telefono}</span>}
                    {selectedBloqueo.persona.email && <span className="flex items-center gap-1"><Mail size={12} /> {selectedBloqueo.persona.email}</span>}
                    {selectedBloqueo.persona.cargo && <span className="flex items-center gap-1"><Briefcase size={12} /> {selectedBloqueo.persona.cargo}</span>}
                  </div>
                </div>
              )}

              {/* Bloqueo info */}
              <div className="p-4 rounded-xl bg-white/40 dark:bg-navy-800/40 border border-white/20 dark:border-navy-700/30 space-y-3">
                <div className="flex items-center gap-2">
                  <Ban size={16} className="text-red-500 shrink-0" />
                  <div>
                    <p className="text-xs text-surface-500 dark:text-navy-500">Bloqueado el {formatDate(selectedBloqueo.fechaBloq)}</p>
                    <p className="text-sm font-medium text-surface-800 dark:text-navy-200 mt-0.5">{selectedBloqueo.motivoBloq}</p>
                    {selectedBloqueo.usuario && (
                      <p className="text-xs text-surface-500 dark:text-navy-400 mt-0.5 flex items-center gap-1">
                        <Shield size={12} /> Por: {selectedBloqueo.usuario.firstName} {selectedBloqueo.usuario.lastName}
                      </p>
                    )}
                  </div>
                </div>

                {selectedBloqueo.fechaDesbloq && (
                  <div className="border-t border-white/20 dark:border-navy-700/30 pt-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                      <div>
                        <p className="text-xs text-surface-500 dark:text-navy-500">Desbloqueado el {formatDate(selectedBloqueo.fechaDesbloq)}</p>
                        {selectedBloqueo.motivoDesbloq && (
                          <p className="text-sm font-medium text-surface-800 dark:text-navy-200 mt-0.5">{selectedBloqueo.motivoDesbloq}</p>
                        )}
                        {selectedBloqueo.usuarioDesbloqueo && (
                          <p className="text-xs text-surface-500 dark:text-navy-400 mt-0.5 flex items-center gap-1">
                            <ShieldOff size={12} /> Por: {selectedBloqueo.usuarioDesbloqueo.firstName} {selectedBloqueo.usuarioDesbloqueo.lastName}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              {(() => {
                const persona = selectedBloqueo.persona;
                return (
                  <div className="flex justify-end gap-3 pt-2">
                    {persona && !selectedBloqueo.fechaDesbloq ? (
                      <button
                        onClick={() => {
                          setUnblockTarget({
                            bloqueoId: selectedBloqueo.id,
                            nombre: `${persona.nombre} ${persona.apellido}`,
                          });
                          setUnblockMotivo('');
                          setUnblockMsg('');
                        }}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-green-600 to-green-500 dark:from-green-500 dark:to-green-600 text-white font-medium shadow-md hover:shadow-lg transition-all text-sm disabled:opacity-50"
                      >
                        <CheckCircle2 size={16} /> Desbloquear
                      </button>
                    ) : persona && (
                      <button
                        onClick={() => {
                          setBlockTarget({
                            id: persona.id,
                            nombre: `${persona.nombre} ${persona.apellido}`,
                            ci: persona.ci,
                          });
                          setBlockMotivo('');
                          setBlockMsg('');
                        }}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-500 dark:from-red-500 dark:to-red-600 text-white font-medium shadow-md hover:shadow-lg transition-all text-sm disabled:opacity-50"
                      >
                        <Ban size={16} /> Bloquear
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedBloqueo(null)}
                      className="px-5 py-2.5 rounded-xl text-surface-600 dark:text-navy-400 bg-white/60 dark:bg-navy-800/60 border border-white/80 dark:border-navy-700/60 hover:bg-white dark:hover:bg-navy-800 transition-colors text-sm font-medium"
                    >Cerrar</button>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Block Modal */}
      {blockTarget && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-panel rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-surface-800 dark:text-navy-200">Bloquear Persona</h3>
              <button onClick={() => { setBlockTarget(null); setBlockMsg(''); }}
                className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              ><X size={20} /></button>
            </div>

            <p className="text-sm text-surface-600 dark:text-navy-400 mb-4">
              ¿Bloquear a <strong>{blockTarget.nombre}</strong> ({blockTarget.ci})?
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-surface-700 dark:text-navy-300 mb-1.5">Motivo del bloqueo</label>
              <textarea
                value={blockMotivo}
                onChange={(e) => setBlockMotivo(e.target.value)}
                rows={3}
                placeholder="Razón del bloqueo..."
                className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-surface-300/80 dark:border-navy-600/50 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:focus:ring-brand-dark-500/50 transition-all resize-none"
              />
            </div>

            {blockMsg && (
              <div className={`mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium ${
                blockMsg.startsWith('✅') || blockMsg === 'Persona bloqueada correctamente.'
                  ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
              }`}>
                {blockMsg.startsWith('✅') || blockMsg === 'Persona bloqueada correctamente.' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                {blockMsg}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button onClick={() => { setBlockTarget(null); setBlockMsg(''); }}
                className="px-5 py-2.5 rounded-xl text-surface-600 dark:text-navy-400 bg-white/60 dark:bg-navy-800/60 border border-white/80 dark:border-navy-700/60 hover:bg-white dark:hover:bg-navy-800 transition-colors text-sm font-medium"
              >Cancelar</button>
              <button onClick={handleBloquear} disabled={blockLoading || !blockMotivo.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-500 dark:from-red-500 dark:to-red-600 text-white font-medium shadow-md hover:shadow-lg transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {blockLoading ? <Loader2 size={16} className="animate-spin" /> : <Ban size={16} />}
                Bloquear
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Unblock Modal */}
      {unblockTarget && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-panel rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-surface-800 dark:text-navy-200">Desbloquear Persona</h3>
              <button onClick={() => { setUnblockTarget(null); setUnblockMsg(''); }}
                className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              ><X size={20} /></button>
            </div>

            <p className="text-sm text-surface-600 dark:text-navy-400 mb-4">
              ¿Desbloquear a <strong>{unblockTarget.nombre}</strong>?
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-surface-700 dark:text-navy-300 mb-1.5">Motivo del desbloqueo</label>
              <textarea
                value={unblockMotivo}
                onChange={(e) => setUnblockMotivo(e.target.value)}
                rows={3}
                placeholder="Razón del desbloqueo..."
                className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-surface-300/80 dark:border-navy-600/50 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:focus:ring-brand-dark-500/50 transition-all resize-none"
              />
            </div>

            {unblockMsg && (
              <div className={`mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium ${
                unblockMsg.includes('correctamente') || unblockMsg.includes('✅')
                  ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
              }`}>
                {unblockMsg.includes('correctamente') || unblockMsg.includes('✅') ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                {unblockMsg}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button onClick={() => { setUnblockTarget(null); setUnblockMsg(''); }}
                className="px-5 py-2.5 rounded-xl text-surface-600 dark:text-navy-400 bg-white/60 dark:bg-navy-800/60 border border-white/80 dark:border-navy-700/60 hover:bg-white dark:hover:bg-navy-800 transition-colors text-sm font-medium"
              >Cancelar</button>
              <button onClick={handleDesbloquear} disabled={unblockLoading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-green-600 to-green-500 dark:from-green-500 dark:to-green-600 text-white font-medium shadow-md hover:shadow-lg transition-all text-sm disabled:opacity-50"
              >
                {unblockLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Desbloquear
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
