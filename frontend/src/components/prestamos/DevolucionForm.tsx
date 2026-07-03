import { useState } from 'react';
import { Undo2, X, CheckCircle2, AlertCircle, Loader2, Printer } from 'lucide-react';
import type { BulkItem } from './DevolucionModal';
import { generarComprobanteDevolucionMultiple } from '../../utils/comprobanteDevolucionMultiplePdf';
import { useAuth } from '../../context/AuthContext';

interface Props {
  items: BulkItem[];
  onClose: () => void;
  formatDate: (d: string) => string;
  onDevolver: (vars: {
    idPrestamoCarpeta: string;
    estadoDevolucion: string;
    observaciones: string;
    bloquearPersona?: boolean;
  }) => Promise<string>;
}

interface ProgressState {
  current: number;
  total: number;
}

export default function DevolucionForm({ items, onClose, formatDate, onDevolver }: Props) {
  const { user } = useAuth();
  const [estado, setEstado] = useState('buen_estado');
  const [obs, setObs] = useState('');
  const [bloquear, setBloquear] = useState(false);
  const [msg, setMsg] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [results, setResults] = useState<{ ok: number; fail: number } | null>(null);
  const [pdfGenerated, setPdfGenerated] = useState(false);

  const isMulti = items.length > 1;

  const handleSubmit = async () => {
    setMsg('');
    setErrors([]);
    setResults(null);
    setSaving(true);

    let ok = 0;
    let fail = 0;
    const errList: string[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      setProgress({ current: i + 1, total: items.length });

      const vars: Record<string, unknown> = {
        idPrestamoCarpeta: item.pcId,
        estadoDevolucion: estado,
        observaciones: obs,
      };
      if (bloquear) vars.bloquearPersona = true;

      const res = await onDevolver(vars as any);
      if (res.startsWith('✅')) {
        ok++;
      } else {
        fail++;
        errList.push(`${item.carpetaDesc}: ${res}`);
      }
    }

    setProgress(null);
    setSaving(false);
    setResults({ ok, fail });
    setErrors(errList);

    if (fail === 0) {
      setMsg(isMulti
        ? `✅ Todas las carpetas devueltas correctamente (${ok}/${items.length}).`
        : '✅ Devolución registrada correctamente.'
      );
      generarComprobanteDevolucionMultiple({
        personaNombre: items[0].personaNombre,
        usuarioNombre: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
        formatDate,
        items: items.map((item) => ({
          carpetaDesc: item.carpetaDesc,
          fechaPrest: item.fechaPrest,
          fechaDevolucion: item.fechaDevolucion,
          estado,
        })),
        observaciones: obs || undefined,
      });
      setPdfGenerated(true);
      setTimeout(onClose, 3000);
    } else {
      setMsg(`⚠️ ${ok} devuelta(s), ${fail} fallaron. Revisa los detalles.`);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 dark:bg-black/70 backdrop-blur-sm p-4">
      <div className="glass-panel rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-surface-800 dark:text-navy-200 flex items-center gap-2">
            <Undo2 size={20} className="text-brand-600" />
            {isMulti ? `Devolver ${items.length} carpetas` : 'Registrar Devolución'}
          </h3>
          <button onClick={onClose}
            className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-400 transition-colors"
          ><X size={20} /></button>
        </div>

        {!isMulti && (
          <p className="text-sm text-surface-700 dark:text-navy-300 mb-4">
            Devolviendo carpeta: <strong>{items[0].carpetaDesc}</strong>
            <br />
            Persona: <strong>{items[0].personaNombre}</strong>
          </p>
        )}

        {isMulti && (
          <div className="mb-4">
            <p className="text-sm text-surface-700 dark:text-navy-300 mb-2">
              Persona: <strong>{items[0].personaNombre}</strong>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {items.map((item) => (
                <span key={item.pcId}
                  className="px-2 py-1 rounded-md text-xs bg-surface-100 dark:bg-navy-800 text-surface-600 dark:text-navy-400 border border-surface-200 dark:border-navy-700"
                >{item.carpetaDesc}</span>
              ))}
            </div>
          </div>
        )}

        {msg && (
          <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm font-medium ${
            msg.startsWith('✅')
              ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
          }`}>
            <div className="flex items-center gap-2">
              {msg.startsWith('✅') ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              {msg}
            </div>
            {pdfGenerated && (
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-green-200 dark:border-green-800">
                <Printer size={14} />
                <span className="text-xs">Comprobante PDF generado</span>
              </div>
            )}
          </div>
        )}

        {errors.length > 0 && (
          <div className="mb-4 px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-sm">
            <p className="font-semibold text-red-700 dark:text-red-300 mb-1">Detalles de errores:</p>
            <ul className="list-disc list-inside text-red-600 dark:text-red-400 space-y-0.5">
              {errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}

        {progress && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-brand-50 dark:bg-brand-dark-600/20 border border-brand-200 dark:border-brand-dark-500/30">
            <div className="flex items-center gap-2 text-sm text-brand-700 dark:text-brand-dark-400">
              <Loader2 size={16} className="animate-spin" />
              Devolviendo carpeta {progress.current} de {progress.total}...
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-brand-200 dark:bg-brand-dark-600/30">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-600 to-blue-600 dark:from-brand-dark-500 dark:to-blue-500 transition-all"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-surface-700 dark:text-navy-300 mb-1.5">Estado de devolución</label>
          <select value={estado} onChange={(e) => {
            setEstado(e.target.value);
            if (e.target.value === 'buen_estado') setBloquear(false);
          }}
            className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400/50 dark:focus:ring-brand-dark-500/50 transition-all"
          >
            <option value="buen_estado">Buen estado</option>
            <option value="mal_estado">Mal estado</option>
            <option value="dañado">Dañado</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-surface-700 dark:text-navy-300 mb-1.5">Observaciones</label>
          <textarea value={obs} onChange={(e) => setObs(e.target.value)}
            rows={3} placeholder="Ej: carpeta con esquinas dobladas..."
            disabled={saving}
            className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 placeholder:text-surface-600 dark:placeholder:text-navy-500 focus:outline-none focus:ring-2 focus:ring-brand-400/50 dark:focus:ring-brand-dark-500/50 transition-all resize-none disabled:opacity-50"
          />
        </div>

        {(estado === 'mal_estado' || estado === 'dañado') && (
          <label className="flex items-start gap-3 p-3 mb-4 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 cursor-pointer">
            <input type="checkbox" checked={bloquear} onChange={(e) => setBloquear(e.target.checked)}
              disabled={saving}
              className="mt-0.5 w-4 h-4 rounded border-surface-300 text-red-600 focus:ring-red-400"
            />
            <div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-300">Bloquear a {items[0].personaNombre}</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">No podrá recibir nuevos préstamos hasta que un administrador lo desbloquee.</p>
            </div>
          </label>
        )}

        <div className="flex justify-end gap-1">
          <button onClick={onClose} disabled={saving}
            className="px-5 py-2 rounded-xl text-surface-600 dark:text-navy-400 bg-white/60 dark:bg-navy-800/60 border border-white/80 dark:border-navy-700/60 hover:bg-white dark:hover:bg-navy-800 transition-colors text-sm font-medium disabled:opacity-50"
          >Cancelar</button>
          <button onClick={handleSubmit} disabled={saving || results !== null}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 dark:from-brand-dark-500 dark:to-blue-500 text-white font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
          ><Undo2 size={16} /> {saving ? 'Devolviendo...' : results ? 'Completado' : 'Confirmar Devolución'}</button>
        </div>
      </div>
    </div>
  );
}
