import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { createPortal } from 'react-dom';
import {
  GET_ALL_CARPETAS, GET_ALL_AMBIENTES,
  GET_MIS_AMBIENTES, GET_ALL_TRASPASOS,
  REGISTRAR_TRASPASO,
} from '../lib/queries';
import { usePermission } from '../context/AuthContext';
import { X, ArrowRight, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import Pagination from '../components/Pagination';

export default function TraspasosPage() {
  const { hasPerm, isAdmin } = usePermission();

  const ambQ = isAdmin ? GET_ALL_AMBIENTES : GET_MIS_AMBIENTES;
  const { data: ambData } = useQuery(ambQ);
  const { data: carpData, loading: carpLoading, refetch: refetchCarp } = useQuery(GET_ALL_CARPETAS);
  const { data: trasData, loading: trasLoading, refetch: refetchTras } = useQuery(GET_ALL_TRASPASOS);
  const [registrar, { loading: regLoading }] = useMutation(REGISTRAR_TRASPASO);

  const [tab, setTab] = useState<'registrar' | 'historial'>('registrar');
  const [historialPage, setHistorialPage] = useState(1);
  const switchTab = (t: 'registrar' | 'historial') => { setTab(t); setHistorialPage(1); };
  const historialItemsPerPage = 10;

  // Registrar form
  const [idOrigen, setIdOrigen] = useState('');
  const [idDestino, setIdDestino] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mensaje, setMensaje] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Detalle modal
  const [detalleModal, setDetalleModal] = useState<typeof traspasos[0] | null>(null);



  const ambientes = (ambData?.misAmbientes ?? ambData?.allAmbientes ?? []) as { id: string; nombre: string }[];

  const mismoAmbiente = idOrigen && idDestino && idOrigen === idDestino;
  const ambientesOrigen = idDestino ? ambientes.filter(a => a.id !== idDestino) : ambientes;
  const ambientesDestino = idOrigen ? ambientes.filter(a => a.id !== idOrigen) : ambientes;

  const carpetas = useMemo(() => (carpData?.allCarpetas ?? []) as {
    id: string; descripcion: string; estado: string;
    piso: { nroFila: number; estante: { codigo: string; ambiente: { id: string; nombre: string } } }
  }[], [carpData]);
  const traspasos = (trasData?.allTraspasos ?? []) as {
    id: string; fecha: string; observaciones?: string; ubicado: boolean;
    usuario: { id: string; username: string; firstName: string; lastName: string };
    ambienteOrigen: { id: string; nombre: string };
    ambienteDestino: { id: string; nombre: string };
    items: { id: string; ubicado: boolean; pisoAsignado?: { id: string; nroFila: number; estante: { codigo: string } }; carpeta: { id: string; descripcion: string } }[];
  }[];

  const carpetasOrigen = useMemo(() => idOrigen
    ? carpetas.filter((c) => c.piso?.estante?.ambiente?.id === idOrigen && c.estado === 'disponible')
    : [],
  [carpetas, idOrigen]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleRegistrar = async () => {
    setMensaje(null);
    if (!idOrigen || !idDestino) { setMensaje({ type: 'err', text: 'Selecciona ambiente origen y destino.' }); return; }
    if (idOrigen === idDestino) { setMensaje({ type: 'err', text: 'El origen y destino deben ser diferentes.' }); return; }
    if (selected.size === 0) { setMensaje({ type: 'err', text: 'Selecciona al menos una carpeta.' }); return; }
    try {
      const { data } = await registrar({
        variables: { idsCarpetas: Array.from(selected), idAmbienteOrigen: idOrigen, idAmbienteDestino: idDestino, observaciones: observaciones || undefined },
      });
      if (data?.registrarTraspaso?.success) {
        setMensaje({ type: 'ok', text: `✅ Traspaso registrado con ${selected.size} carpeta(s).` });
        setSelected(new Set()); setObservaciones('');
        refetchCarp(); refetchTras();
      } else {
        setMensaje({ type: 'err', text: data?.registrarTraspaso?.error || 'Error al registrar.' });
      }
    } catch { setMensaje({ type: 'err', text: 'Error de conexión.' }); }
  };

  return (
    <>
      <h2 className="text-2xl font-bold text-surface-800 dark:text-navy-200 mb-6">Traspaso de Carpetas</h2>

      <div className="flex gap-2 mb-6">
          {hasPerm('gestionar_traspasos') && (
          <button onClick={() => switchTab('registrar')}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${tab === 'registrar' ? 'bg-brand-600 text-white shadow-md dark:bg-brand-dark-500 dark:shadow-brand-dark-600/20' : 'bg-white/60 dark:bg-navy-800/60 text-surface-600 dark:text-navy-400 hover:bg-white/80 dark:hover:bg-navy-800/80 border border-white/40 dark:border-navy-700/40'}`}
          >Registrar Traspaso</button>
        )}
        <button onClick={() => switchTab('historial')}
          className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${tab === 'historial' ? 'bg-brand-600 text-white shadow-md dark:bg-brand-dark-500 dark:shadow-brand-dark-600/20' : 'bg-white/60 dark:bg-navy-800/60 text-surface-600 dark:text-navy-400 hover:bg-white/80 dark:hover:bg-navy-800/80 border border-white/40 dark:border-navy-700/40'}`}
        >Historial</button>
      </div>

      {tab === 'registrar' && (
        <div className="glass-panel rounded-2xl max-h-[calc(100vh-220px)] overflow-y-auto">
          <div className="p-6">
            {mensaje && (
              <div className={`mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium ${
                mensaje.type === 'ok' ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
              }`}>
                {mensaje.type === 'ok' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                {mensaje.text}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-navy-300 mb-1.5">Desde (Origen)</label>
                <select value={idOrigen} onChange={(e) => { setIdOrigen(e.target.value); setSelected(new Set()); }}
                  className={`w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border-2 ${mismoAmbiente ? 'border-red-400 dark:border-red-500' : 'border-surface-300/80 dark:border-navy-600/50'} text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:focus:ring-brand-dark-500/50 transition-all`}
                >
                  <option value="">Seleccionar...</option>
                  {ambientesOrigen.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-navy-300 mb-1.5">Hacia (Destino)</label>
                <select value={idDestino} onChange={(e) => setIdDestino(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border-2 ${mismoAmbiente ? 'border-red-400 dark:border-red-500' : 'border-surface-300/80 dark:border-navy-600/50'} text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:focus:ring-brand-dark-500/50 transition-all`}
                >
                  <option value="">Seleccionar...</option>
                  {ambientesDestino.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </div>
            </div>

            {mismoAmbiente && (
              <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                <AlertCircle size={16} />
                El ambiente de origen y destino deben ser diferentes.
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-surface-700 dark:text-navy-300 mb-1.5">Observaciones</label>
              <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border-2 border-surface-400 dark:border-navy-600/50 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:focus:ring-brand-dark-500/50 transition-all resize-none h-20"
                placeholder="Motivo del traspaso..."
              />
            </div>

            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-surface-700 dark:text-navy-300">
                Carpetas Disponibles {idOrigen && <span className="text-surface-500 dark:text-navy-500 font-normal">({carpetasOrigen.length})</span>}
              </label>
              {carpetasOrigen.length > 0 && (
                <button onClick={() => {
                  if (selected.size === carpetasOrigen.length) setSelected(new Set());
                  else setSelected(new Set(carpetasOrigen.map((c) => c.id)));
                }} className="text-xs text-brand-600 dark:text-brand-dark-400 hover:text-brand-700 dark:hover:text-brand-dark-400 font-medium">
                  {selected.size === carpetasOrigen.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
                </button>
              )}
            </div>
            {(() => {
              if (carpLoading) return <div className="flex justify-center py-8 text-surface-500 dark:text-navy-500"><Loader2 size={24} className="animate-spin" /></div>;
              if (!idOrigen) return <div className="text-center py-8 text-surface-500 dark:text-navy-500 text-sm">Selecciona un origen para ver sus carpetas.</div>;
              if (carpetas.length === 0) return <div className="text-center py-8 text-surface-500 dark:text-navy-500 text-sm">No se encontraron carpetas en el sistema.</div>;
              if (carpetasOrigen.length === 0) return <div className="text-center py-8 text-surface-500 dark:text-navy-500 text-sm">No hay carpetas disponibles en este ambiente.</div>;
              return (
                <div className="border border-white/20 dark:border-navy-700/30 rounded-xl overflow-auto">
                  <table className="w-full">
                    <thead><tr className="border-b border-white/20 dark:border-navy-700/30 bg-white/30 dark:bg-navy-800/30">
                      <th className="w-12 px-4 py-3"></th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Descripción</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Estante</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Piso</th>
                    </tr></thead>
                    <tbody className="divide-y divide-white/10 dark:divide-navy-700/20">
                      {carpetasOrigen.map((c) => (
                        <tr key={c.id} onClick={() => toggle(c.id)} className={`group hover:bg-brand-50/60 dark:hover:bg-brand-dark-600/20 cursor-pointer ${selected.has(c.id) ? 'bg-brand-50/70 dark:bg-brand-dark-600/15' : ''}`}
                          >
                          <td className={`px-4 py-3 border-l-4 border-transparent group-hover:border-l-brand-500 dark:group-hover:border-l-brand-400 ${selected.has(c.id) ? 'border-l-brand-600 dark:border-l-brand-400' : ''}`}><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)}
                            className="w-4 h-4 rounded border-surface-300 text-brand-600 dark:text-brand-dark-400 focus:ring-brand-400 dark:focus:ring-brand-dark-500" /></td>
                          <td className="px-4 py-3 text-sm font-semibold text-surface-800 dark:text-navy-200">{c.descripcion}</td>
                          <td className="px-4 py-3 text-sm text-surface-600 dark:text-navy-400">{c.piso?.estante?.codigo ?? '—'}</td>
                          <td className="px-4 py-3 text-sm text-surface-600 dark:text-navy-400">{c.piso ? `Fila ${c.piso.nroFila}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            <div className="flex justify-end mt-6">
              <button onClick={handleRegistrar} disabled={regLoading || selected.size === 0 || mismoAmbiente}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 dark:from-brand-dark-500 dark:to-blue-500 text-white font-medium shadow-md shadow-brand-500/30 dark:shadow-brand-dark-600/20 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {regLoading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                {regLoading ? 'Registrando...' : `Registrar Traspaso (${selected.size})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'historial' && (
          <div className="glass-panel rounded-2xl max-h-[calc(100vh-220px)] overflow-y-auto">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/20 dark:border-navy-700/30">
            <h3 className="text-lg font-bold text-surface-800 dark:text-navy-200">Historial</h3>
            <span className="text-sm text-surface-600 dark:text-navy-500">{traspasos.length} resultado(s)</span>
          </div>
          <div className="overflow-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/20 dark:border-navy-700/30">
                  <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Fecha</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Usuario</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Origen</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Destino</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Carpetas</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 dark:divide-navy-700/20">
                {trasLoading ? (
                  <tr><td colSpan={6} className="text-center py-8 text-surface-500 dark:text-navy-500"><Loader2 size={24} className="animate-spin inline" /></td></tr>
                ) : traspasos.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-surface-500 dark:text-navy-500 text-sm">No hay traspasos registrados.</td></tr>
                ) : traspasos.slice((historialPage - 1) * historialItemsPerPage, historialPage * historialItemsPerPage).map((t) => {
                  const total = t.items.length;
                  const ubicadas = t.items.filter((i) => i.ubicado).length;
                  return (
                    <tr key={t.id} onClick={() => setDetalleModal(t)}
                      className="hover:bg-white/30 dark:hover:bg-navy-800/50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4 text-sm text-surface-700 dark:text-navy-300">{new Date(t.fecha).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-sm text-surface-600 dark:text-navy-400">{t.usuario.firstName} {t.usuario.lastName}</td>
                      <td className="px-6 py-4 text-sm font-medium text-surface-700 dark:text-navy-300">{t.ambienteOrigen.nombre}</td>
                      <td className="px-6 py-4 text-sm font-medium text-surface-700 dark:text-navy-300">{t.ambienteDestino.nombre}</td>
                      <td className="px-6 py-4 text-sm text-surface-600 dark:text-navy-400">{total}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          ubicadas === total ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                        }`}>
                          {ubicadas === total ? 'Completado' : `${ubicadas}/${total} ubicadas`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination currentPage={historialPage} totalItems={traspasos.length} itemsPerPage={historialItemsPerPage} onPageChange={setHistorialPage} />
          </div>
        </div>
      )}

      {detalleModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-panel rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-surface-800 dark:text-navy-200">Detalle del Traspaso</h3>
              <button onClick={() => setDetalleModal(null)} className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-100 hover:text-red-700 dark:hover:text-red-400 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-white/40 dark:bg-navy-800/40 border border-white/20 dark:border-navy-700/30">
                <p className="text-xs text-surface-600 dark:text-navy-500 uppercase font-semibold mb-1">Fecha</p>
                <p className="text-sm font-medium text-surface-800 dark:text-navy-200">{new Date(detalleModal.fecha).toLocaleString()}</p>
              </div>
              <div className="p-4 rounded-xl bg-white/40 dark:bg-navy-800/40 border border-white/20 dark:border-navy-700/30">
                <p className="text-xs text-surface-600 dark:text-navy-500 uppercase font-semibold mb-1">Registrado por</p>
                <p className="text-sm font-medium text-surface-800 dark:text-navy-200">{detalleModal.usuario.firstName} {detalleModal.usuario.lastName}</p>
              </div>
              <div className="p-4 rounded-xl bg-white/40 dark:bg-navy-800/40 border border-white/20 dark:border-navy-700/30">
                <p className="text-xs text-surface-600 dark:text-navy-500 uppercase font-semibold mb-1">Ambiente Origen</p>
                <p className="text-sm font-medium text-surface-800 dark:text-navy-200">{detalleModal.ambienteOrigen.nombre}</p>
              </div>
              <div className="p-4 rounded-xl bg-white/40 dark:bg-navy-800/40 border border-white/20 dark:border-navy-700/30">
                <p className="text-xs text-surface-600 dark:text-navy-500 uppercase font-semibold mb-1">Ambiente Destino</p>
                <p className="text-sm font-medium text-surface-800 dark:text-navy-200">{detalleModal.ambienteDestino.nombre}</p>
              </div>
              {detalleModal.observaciones && (
                <div className="col-span-2 p-4 rounded-xl bg-white/40 dark:bg-navy-800/40 border border-white/20 dark:border-navy-700/30">
                  <p className="text-xs text-surface-600 dark:text-navy-500 uppercase font-semibold mb-1">Observaciones</p>
                  <p className="text-sm text-surface-700 dark:text-navy-300">{detalleModal.observaciones}</p>
                </div>
              )}
              <div className="col-span-2 p-4 rounded-xl bg-white/40 dark:bg-navy-800/40 border border-white/20 dark:border-navy-700/30">
                <p className="text-xs text-surface-600 dark:text-navy-500 uppercase font-semibold mb-1">Estado</p>
                <p className="text-sm font-medium">
                  {detalleModal.ubicado ? (
                    <span className="text-green-700 dark:text-green-300">Completado — todas las carpetas ubicadas</span>
                  ) : (
                    <span className="text-amber-700 dark:text-amber-300">{detalleModal.items.filter((i) => i.ubicado).length}/{detalleModal.items.length} carpetas ubicadas</span>
                  )}
                </p>
              </div>
            </div>

            <h4 className="text-sm font-semibold text-surface-700 dark:text-navy-300 mb-3">Carpetas ({detalleModal.items.length})</h4>
            <div className="border border-white/20 dark:border-navy-700/30 rounded-xl overflow-auto max-h-60">
              <table className="w-full">
                <thead><tr className="border-b border-white/20 dark:border-navy-700/30 bg-white/30 dark:bg-navy-800/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Descripción</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-600 dark:text-navy-500 uppercase">Ubicación</th>
                </tr></thead>
                <tbody className="divide-y divide-white/10 dark:divide-navy-700/20">
                  {detalleModal.items.map((item) => (
                    <tr key={item.id} className="hover:bg-white/30 dark:hover:bg-navy-800/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-surface-800 dark:text-navy-200">{item.carpeta.descripcion}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          item.ubicado ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                        }`}>
                          {item.ubicado ? 'Ubicada' : 'Pendiente'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-surface-600 dark:text-navy-400">
                        {item.pisoAsignado ? `Estante ${item.pisoAsignado.estante.codigo} — Fila ${item.pisoAsignado.nroFila}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
