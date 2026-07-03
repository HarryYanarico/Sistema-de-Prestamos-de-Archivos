import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { GET_ALL_CARPETAS, GET_ALL_PERSONAS, REGISTRAR_RETIRO } from '../lib/queries';
import { Search, CheckCircle2, AlertTriangle, Loader2, Printer, Archive } from 'lucide-react';
import ModalExitoRetiro from '../components/retiros/ModalExitoRetiro';
import type { RetiroData } from '../utils/comprobanteRetiroPdf';

interface Carpeta {
  id: string; descripcion: string; estado: string;
  piso: { nroFila: number; estante: { codigo: string; ambiente: { nombre: string } } };
}

interface Persona {
  id: string; ci: string; nombre: string; apellido: string; cargo?: string;
}

interface RetiroResponse {
  carpeta: { descripcion: string; piso?: { estante?: { codigo?: string; ambiente?: { nombre?: string } }; nroFila?: number } };
  persona: { nombre: string; apellido: string; ci?: string };
  autorizadoPor: { nombre: string; apellido: string; ci?: string };
  fechaRetiro: string; motivo: string; motivoOtro?: string; observaciones?: string;
  usuario: { firstName: string; lastName: string };
}

export default function RetirosPage() {
  const { data: carpetasData, refetch: refetchCarpetas } = useQuery(GET_ALL_CARPETAS);
  const { data: personasData, refetch: refetchPersonas } = useQuery(GET_ALL_PERSONAS);
  const [registrar, { loading: regLoading }] = useMutation(REGISTRAR_RETIRO);

  const carpetas = useMemo(() => (carpetasData?.allCarpetas ?? []) as Carpeta[], [carpetasData]);
  const disponibles = useMemo(() => carpetas.filter((c) => c.estado !== 'retirado'), [carpetas]);
  const personas = useMemo(() => (personasData?.allPersonas ?? []) as Persona[], [personasData]);

  const [carpetaQuery, setCarpetaQuery] = useState('');
  const [selectedCarpeta, setSelectedCarpeta] = useState<Carpeta | null>(null);
  const [carpetaResultados, setCarpetaResultados] = useState<Carpeta[]>([]);
  const [carpetaBuscado, setCarpetaBuscado] = useState(false);

  const [searchAutoriza, setSearchAutoriza] = useState('');
  const [selectedAutoriza, setSelectedAutoriza] = useState<Persona | null>(null);

  const [searchPersona, setSearchPersona] = useState('');
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [personaResultados, setPersonaResultados] = useState<Persona[]>([]);
  const [personaBuscado, setPersonaBuscado] = useState(false);

  const [motivo, setMotivo] = useState('');
  const [motivoOtro, setMotivoOtro] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [mensaje, setMensaje] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [ultimoRetiro, setUltimoRetiro] = useState<RetiroResponse | null>(null);
  const [showExitoModal, setShowExitoModal] = useState(false);
  const [dummyRetiroData, setDummyRetiroData] = useState<RetiroData | null>(null);

  const esPrestada = selectedCarpeta?.estado === 'prestada';

  const autorizasFiltradas = useMemo(() => {
    if (!searchAutoriza) return [];
    const q = searchAutoriza.toLowerCase();
    return personas.filter((p) =>
      p.cargo && (
        p.nombre.toLowerCase().includes(q) ||
        p.apellido.toLowerCase().includes(q) ||
        p.ci?.toLowerCase().includes(q)
      )
    );
  }, [personas, searchAutoriza]);

  const abrirConstancia = (retiro: RetiroResponse) => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html>
<head><title>Constancia de Retiro</title>
<style>
  body { font-family: Arial, sans-serif; padding: 40px; }
  h1 { text-align: center; margin-bottom: 40px; color: #1e293b; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
  td { padding: 10px 8px; border-bottom: 1px solid #e2e8f0; }
  .label { font-weight: bold; width: 220px; color: #475569; }
  .value { color: #1e293b; }
  .footer { margin-top: 60px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
</style></head>
<body>
  <h1>Constancia de Retiro</h1>
  <table>
    <tr><td class="label">Carpeta:</td><td class="value">${retiro.carpeta.descripcion}</td></tr>
    <tr><td class="label">Ubicaci\u00f3n:</td><td class="value">${retiro.carpeta.piso?.estante?.ambiente?.nombre ?? '-'} &mdash; Est. ${retiro.carpeta.piso?.estante?.codigo ?? '-'} &mdash; Fila ${retiro.carpeta.piso?.nroFila ?? '-'}</td></tr>
    <tr><td class="label">Persona que retira:</td><td class="value">${retiro.persona.nombre} ${retiro.persona.apellido}${retiro.persona.ci ? ' (CI: ' + retiro.persona.ci + ')' : ''}</td></tr>
    <tr><td class="label">Autorizado por:</td><td class="value">${retiro.autorizadoPor.nombre} ${retiro.autorizadoPor.apellido}${retiro.autorizadoPor.ci ? ' (CI: ' + retiro.autorizadoPor.ci + ')' : ''}</td></tr>
    <tr><td class="label">Fecha de retiro:</td><td class="value">${new Date(retiro.fechaRetiro).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td></tr>
    <tr><td class="label">Motivo:</td><td class="value">${retiro.motivo === 'traslado' ? 'Traslado' : retiro.motivo === 'retiro_indefinido' ? 'Retiro Indefinido' : 'Otro'}${retiro.motivoOtro ? ': ' + retiro.motivoOtro : ''}</td></tr>
    ${retiro.observaciones ? `<tr><td class="label">Observaciones:</td><td class="value">${retiro.observaciones}</td></tr>` : ''}
    <tr><td class="label">Registrado por:</td><td class="value">${retiro.usuario.firstName} ${retiro.usuario.lastName}</td></tr>
  </table>
  <div class="footer">--- Documento generado por el sistema ---</div>
  <script>window.onload = function() { window.print(); }<\\/script>
</body></html>`);
    w.document.close();
  };

  const formatMotivo = (m: string, otro: string) => {
    if (m === 'traslado') return 'Traslado';
    if (m === 'retiro_indefinido') return 'Retiro Indefinido';
    if (m === 'otro') return otro.trim();
    return m;
  };

  const handleSubmit = async () => {
    setMensaje(null);
    if (!selectedCarpeta) { setMensaje({ type: 'err', text: 'Selecciona una carpeta.' }); return; }
    if (esPrestada) { setMensaje({ type: 'err', text: 'La carpeta está actualmente en préstamo y no puede retirarse.' }); return; }
    if (!selectedPersona) { setMensaje({ type: 'err', text: 'Selecciona la persona que retira.' }); return; }
    if (!selectedAutoriza) { setMensaje({ type: 'err', text: 'Selecciona quién autoriza.' }); return; }
    if (!motivo) { setMensaje({ type: 'err', text: 'Selecciona un motivo.' }); return; }
    if (motivo === 'otro' && !motivoOtro.trim()) { setMensaje({ type: 'err', text: 'Escribe el motivo personalizado.' }); return; }

    try {
      const { data } = await registrar({
        variables: {
          idCarpeta: selectedCarpeta.id,
          idPersona: selectedPersona.id,
          idAutorizadoPor: selectedAutoriza.id,
          motivo,
          motivoOtro: motivo === 'otro' ? motivoOtro : null,
          observaciones: observaciones.trim() || null,
        },
      });

      const result = data?.registrarRetiro;
      if (result?.error) throw new Error(result.error);

      const retiro = result!.retiro;

      const piso = retiro.carpeta.piso;
      const ubicacion = (piso?.estante?.ambiente?.nombre ?? '-')
        + ' \u2014 Est. ' + (piso?.estante?.codigo ?? '-')
        + ' \u2014 Fila ' + (piso?.nroFila ?? '-');

      const retiroData: RetiroData = {
        carpeta: { descripcion: retiro.carpeta.descripcion, ubicacion },
        persona: {
          nombre: retiro.persona.nombre,
          apellido: retiro.persona.apellido,
          ci: retiro.persona.ci,
        },
        autorizadoPor: {
          nombre: retiro.autorizadoPor.nombre,
          apellido: retiro.autorizadoPor.apellido,
          ci: retiro.autorizadoPor.ci,
        },
        fechaRetiro: new Date(retiro.fechaRetiro).toLocaleString('es-ES'),
        motivo: formatMotivo(retiro.motivo, retiro.motivoOtro ?? ''),
        observaciones: retiro.observaciones || undefined,
      };

      setUltimoRetiro(retiro as RetiroResponse);
      setDummyRetiroData(retiroData);
      setShowExitoModal(true);
      refetchCarpetas();
      refetchPersonas();

      setSelectedCarpeta(null); setCarpetaQuery(''); setCarpetaResultados([]); setCarpetaBuscado(false);
      setSelectedPersona(null); setSearchPersona(''); setPersonaResultados([]); setPersonaBuscado(false);
      setSelectedAutoriza(null); setSearchAutoriza('');
      setMotivo(''); setMotivoOtro(''); setObservaciones('');
    } catch (err: unknown) {
      setMensaje({ type: 'err', text: err instanceof Error ? err.message : 'Error al registrar retiro.' });
    }
  };

  return (
    <>
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-800 dark:text-navy-200">Registrar Retiro</h1>
        <p className="text-surface-500 dark:text-navy-400 text-sm mt-1">
          Registre el retiro definitivo de una carpeta del sistema.
        </p>
      </div>

      {mensaje && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
          mensaje.type === 'ok'
            ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
        }`}>
          {mensaje.type === 'ok' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          {mensaje.text}
        </div>
      )}

      <div className="glass-panel rounded-2xl p-6 space-y-5">
        {/* Carpeta — full width */}
        <div>
          <label className="block text-sm font-medium text-surface-700 dark:text-navy-300 mb-1.5">Carpeta</label>
          {selectedCarpeta ? (
            <div>
              <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-brand-50 dark:bg-brand-dark-600/20 border border-brand-200 dark:border-brand-dark-500/30">
                <div>
                  <span className="font-medium text-surface-800 dark:text-navy-200">{selectedCarpeta.descripcion}</span>
                  <span className="ml-2 text-xs text-surface-500 dark:text-navy-400">
                    {selectedCarpeta.piso?.estante?.ambiente?.nombre} &mdash; Est. {selectedCarpeta.piso?.estante?.codigo} &mdash; Fila {selectedCarpeta.piso?.nroFila}
                  </span>
                </div>
                <button
                  onClick={() => { setSelectedCarpeta(null); setCarpetaQuery(''); setCarpetaResultados([]); setCarpetaBuscado(false); }}
                  className="text-red-500 hover:text-red-700 text-sm font-medium"
                >
                  Cambiar
                </button>
              </div>
              {esPrestada && (
                <div className="flex items-center gap-2 mt-2 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 text-amber-700 dark:text-amber-300 text-sm">
                  <AlertTriangle size={16} className="shrink-0" />
                  Esta carpeta se encuentra actualmente en préstamo. No puede retirarse hasta que sea devuelta.
                </div>
              )}
            </div>
          ) : (
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
              <input
                type="text"
                value={carpetaQuery}
                onChange={(e) => { setCarpetaQuery(e.target.value); setCarpetaBuscado(false); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const q = e.currentTarget.value.toLowerCase().trim();
                    if (!q) return;
                    const resultados = disponibles.filter((c) =>
                      c.descripcion?.toLowerCase().includes(q) || String(c.id).includes(q)
                    );
                    setCarpetaResultados(resultados);
                    setCarpetaBuscado(true);
                  }
                }}
                placeholder="Buscar carpeta por descripción o ID..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-surface-300/80 dark:border-navy-600/50 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:focus:ring-brand-dark-500/50 transition-all"
              />
              {carpetaBuscado && carpetaResultados.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-navy-800 border border-surface-200 dark:border-navy-700 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {carpetaResultados.slice(0, 1).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedCarpeta(c); setCarpetaResultados([]); setCarpetaBuscado(false); setCarpetaQuery(''); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-brand-50 dark:hover:bg-brand-dark-600/20 text-sm text-surface-700 dark:text-navy-300 border-b border-surface-100 dark:border-navy-700/30 last:border-0"
                    >
                      <span className="font-medium">{c.descripcion}</span>
                      <span className="ml-2 text-xs text-surface-500 dark:text-navy-400">
                        {c.piso?.estante?.ambiente?.nombre} &mdash; Est. {c.piso?.estante?.codigo} &mdash; Fila {c.piso?.nroFila}
                      </span>
                      {c.estado === 'prestada' && (
                        <span className="ml-2 text-xs text-amber-600 dark:text-amber-400 font-medium">(en préstamo)</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {carpetaBuscado && carpetaResultados.length === 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-navy-800 border border-surface-200 dark:border-navy-700 rounded-xl shadow-lg p-3 text-sm text-surface-500 dark:text-navy-400 text-center">
                  Sin resultados
                </div>
              )}
            </div>
          )}
        </div>

        {/* Two-column grid for the rest */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Autorizado por */}
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-navy-300 mb-1.5">Autorizado por</label>
            {selectedAutoriza ? (
              <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-brand-50 dark:bg-brand-dark-600/20 border border-brand-200 dark:border-brand-dark-500/30">
                <div className="truncate">
                  <span className="font-medium text-surface-800 dark:text-navy-200 text-sm">{selectedAutoriza.nombre} {selectedAutoriza.apellido}{selectedAutoriza.ci ? ` (${selectedAutoriza.ci})` : ''}</span>
                  {selectedAutoriza.cargo && <span className="block text-xs text-surface-400 dark:text-navy-500">{selectedAutoriza.cargo}</span>}
                </div>
                <button
                  onClick={() => { setSelectedAutoriza(null); setSearchAutoriza(''); }}
                  className="text-red-500 hover:text-red-700 text-sm font-medium shrink-0 ml-2"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                <input
                  type="text"
                  value={searchAutoriza}
                  onChange={(e) => setSearchAutoriza(e.target.value)}
                  placeholder="Buscar persona que autoriza..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-surface-300/80 dark:border-navy-600/50 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:focus:ring-brand-dark-500/50 transition-all"
                />
                {searchAutoriza && autorizasFiltradas.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-navy-800 border border-surface-200 dark:border-navy-700 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {autorizasFiltradas.slice(0, 10).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedAutoriza(p)}
                        className="w-full text-left px-4 py-2.5 hover:bg-brand-50 dark:hover:bg-brand-dark-600/20 text-sm text-surface-700 dark:text-navy-300 border-b border-surface-100 dark:border-navy-700/30 last:border-0"
                      >
                        <div>
                          <span>{p.nombre} {p.apellido}{p.ci ? ` (${p.ci})` : ''}</span>
                          {p.cargo && <span className="block text-xs text-surface-400 dark:text-navy-500">{p.cargo}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {searchAutoriza && autorizasFiltradas.length === 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-navy-800 border border-surface-200 dark:border-navy-700 rounded-xl shadow-lg p-3 text-sm text-surface-500 dark:text-navy-400 text-center">
                    Sin resultados
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Persona que retira */}
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-navy-300 mb-1.5">Persona que retira</label>
            {selectedPersona ? (
              <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-brand-50 dark:bg-brand-dark-600/20 border border-brand-200 dark:border-brand-dark-500/30">
                <span className="font-medium text-surface-800 dark:text-navy-200 text-sm truncate">{selectedPersona.nombre} {selectedPersona.apellido}{selectedPersona.ci ? ` (${selectedPersona.ci})` : ''}</span>
                <button
                  onClick={() => { setSelectedPersona(null); setSearchPersona(''); setPersonaResultados([]); setPersonaBuscado(false); }}
                  className="text-red-500 hover:text-red-700 text-sm font-medium shrink-0 ml-2"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                <input
                  type="text"
                  value={searchPersona}
                  onChange={(e) => { setSearchPersona(e.target.value); setPersonaBuscado(false); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const q = e.currentTarget.value.toLowerCase().trim();
                      if (!q) return;
                      const resultados = personas.filter((p) =>
                        p.nombre.toLowerCase().includes(q) ||
                        p.apellido.toLowerCase().includes(q) ||
                        p.ci?.toLowerCase().includes(q)
                      );
                      setPersonaResultados(resultados);
                      setPersonaBuscado(true);
                    }
                  }}
                  placeholder="Buscar persona que retira..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-surface-300/80 dark:border-navy-600/50 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:focus:ring-brand-dark-500/50 transition-all"
                />
                {personaBuscado && personaResultados.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-navy-800 border border-surface-200 dark:border-navy-700 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {personaResultados.slice(0, 1).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { setSelectedPersona(p); setPersonaResultados([]); setPersonaBuscado(false); setSearchPersona(''); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-brand-50 dark:hover:bg-brand-dark-600/20 text-sm text-surface-700 dark:text-navy-300 border-b border-surface-100 dark:border-navy-700/30 last:border-0"
                      >
                        {p.nombre} {p.apellido} {p.ci ? <span className="text-xs text-surface-500">({p.ci})</span> : ''}
                      </button>
                    ))}
                  </div>
                )}
                {personaBuscado && personaResultados.length === 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-navy-800 border border-surface-200 dark:border-navy-700 rounded-xl shadow-lg p-3 text-sm text-surface-500 dark:text-navy-400 text-center">
                    Sin resultados
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Two-column grid: Motivo + Observaciones */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Motivo */}
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-navy-300 mb-1.5">Motivo</label>
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-surface-300/80 dark:border-navy-600/50 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:focus:ring-brand-dark-500/50 transition-all"
            >
              <option value="">Seleccionar...</option>
              <option value="traslado">Traslado</option>
              <option value="retiro_indefinido">Retiro Indefinido</option>
              <option value="otro">Otro</option>
            </select>
            {motivo === 'otro' && (
              <input
                type="text"
                value={motivoOtro}
                onChange={(e) => setMotivoOtro(e.target.value)}
                placeholder="Especifique el motivo..."
                className="w-full mt-2 px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-surface-300/80 dark:border-navy-600/50 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:focus:ring-brand-dark-500/50 transition-all"
              />
            )}
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-navy-300 mb-1.5">Observaciones <span className="text-surface-400 dark:text-navy-500 font-normal">(opcional)</span></label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={1}
              placeholder="Observaciones adicionales..."
              className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-surface-300/80 dark:border-navy-600/50 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:focus:ring-brand-dark-500/50 transition-all resize-none min-h-[42px]"
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = el.scrollHeight + 'px';
              }}
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSubmit}
            disabled={regLoading}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 dark:from-brand-dark-500 dark:to-blue-500 text-white font-medium shadow-md shadow-brand-500/30 dark:shadow-brand-dark-600/20 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {regLoading ? <Loader2 size={18} className="animate-spin" /> : <Archive size={18} />}
            {regLoading ? 'Registrando...' : 'Registrar Retiro'}
          </button>

          {ultimoRetiro && (
            <button
              onClick={() => abrirConstancia(ultimoRetiro)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-surface-300/80 dark:border-navy-600/50 text-surface-700 dark:text-navy-300 hover:bg-white/80 dark:hover:bg-navy-800/80 transition-all text-sm font-medium"
            >
              <Printer size={18} />
              Imprimir constancia
            </button>
          )}
        </div>
      </div>

      {dummyRetiroData && (
        <ModalExitoRetiro
          isOpen={showExitoModal}
          onClose={() => setShowExitoModal(false)}
          data={dummyRetiroData}
        />
      )}
    </div>
    </>
  );
}
