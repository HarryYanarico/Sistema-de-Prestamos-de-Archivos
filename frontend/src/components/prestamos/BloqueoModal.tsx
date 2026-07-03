import { useState } from 'react';
import { Ban, X, Phone, Mail, AlertTriangle } from 'lucide-react';
import { formatDate } from '../../utils/formatDate';

export interface ItemVencido {
  descripcion: string;
  ubicacion?: string;
}

export interface BloqueoInfo {
  persona: { nombre: string; apellido: string; ci: string; telefono?: string; email?: string };
  fechaPrest: string;
  fechaDevolucion: string;
  diasRetraso: number;
  itemsVencidos: ItemVencido[];
}

interface Props {
  personaNombre: string;
  info?: BloqueoInfo;
  onClose: () => void;
  onBloquear: (motivo: string) => Promise<string>;
}

function calcularRetrasoTexto(dias: number): string {
  if (dias <= 0) return '';
  if (dias === 1) return '1 día de retraso';
  return `${dias} días de retraso`;
}

export default function BloqueoModal({ personaNombre, info, onClose, onBloquear }: Props) {
  const [motivo, setMotivo] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setMsg('');
    if (!motivo.trim()) { setMsg('El motivo es obligatorio'); return; }
    setSaving(true);
    const res = await onBloquear(motivo.trim());
    setMsg(res);
    setSaving(false);
    if (res.startsWith('✅')) {
      setTimeout(onClose, 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 dark:bg-black/70 backdrop-blur-sm p-4">
      <div className="glass-panel rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-surface-800 dark:text-navy-200 flex items-center gap-2">
            <Ban size={20} className="text-red-500" />
            Bloquear Persona
          </h3>
          <button onClick={onClose}
            className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-400 transition-colors"
          ><X size={20} /></button>
        </div>

        {info && (
          <div className="space-y-3 mb-5">
            <div className="glass-card rounded-xl p-4 border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} className="text-red-500" />
                <span className="text-sm font-bold text-red-600 dark:text-red-400">
                  {calcularRetrasoTexto(info.diasRetraso)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <div>
                  <span className="text-xs text-surface-500 dark:text-navy-500">Préstamo</span>
                  <p className="font-semibold text-surface-800 dark:text-navy-200">{formatDate(info.fechaPrest)}</p>
                </div>
                <div>
                  <span className="text-xs text-surface-500 dark:text-navy-500">Devolución</span>
                  <p className="font-semibold text-surface-800 dark:text-navy-200">{formatDate(info.fechaDevolucion)}</p>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-xl p-4">
              <p className="text-xs text-surface-500 dark:text-navy-500 mb-1.5 uppercase tracking-wide font-semibold">Contacto</p>
              <p className="font-semibold text-surface-800 dark:text-navy-200">{info.persona.nombre} {info.persona.apellido}</p>
              <p className="text-xs text-surface-500 dark:text-navy-500">CI: {info.persona.ci}</p>
              <div className="flex flex-wrap gap-3 mt-1.5">
                {info.persona.telefono && (
                  <span className="flex items-center gap-1 text-xs text-surface-600 dark:text-navy-400">
                    <Phone size={12} /> {info.persona.telefono}
                  </span>
                )}
                {info.persona.email && (
                  <span className="flex items-center gap-1 text-xs text-surface-600 dark:text-navy-400">
                    <Mail size={12} /> {info.persona.email}
                  </span>
                )}
              </div>
            </div>

          </div>
        )}

        <p className="text-sm text-surface-700 dark:text-navy-300 mb-4">
          Vas a bloquear a <strong>{personaNombre}</strong> por no haber devuelto:{' '}
          {info && info.itemsVencidos.length > 0
            ? <strong>{info.itemsVencidos.map(i => i.descripcion).join(', ')}</strong>
            : <strong>préstamos vencidos</strong>}
          .
        </p>
        {msg && (
          <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm font-medium ${
            msg.startsWith('✅')
              ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
          }`}>{msg}</div>
        )}
        <div className="mb-4">
          <label className="block text-sm font-medium text-surface-700 dark:text-navy-300 mb-1.5">Motivo del bloqueo *</label>
          <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)}
            rows={3} placeholder="Ej: Préstamo vencido desde el 15/01/2024 - no ha devuelto las carpetas..."
            className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 placeholder:text-surface-600 dark:placeholder:text-navy-500 focus:outline-none focus:ring-2 focus:ring-brand-400/50 dark:focus:ring-brand-dark-500/50 transition-all resize-none"
          />
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-surface-600 dark:text-navy-400 bg-white/60 dark:bg-navy-800/60 border border-white/80 dark:border-navy-700/60 hover:bg-white dark:hover:bg-navy-800 transition-colors text-sm font-medium"
          >Cancelar</button>
          <button onClick={handleSubmit} disabled={saving || !motivo.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-500 dark:from-red-500 dark:to-red-600 text-white font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
          ><Ban size={16} /> {saving ? 'Bloqueando...' : 'Bloquear Persona'}</button>
        </div>
      </div>
    </div>
  );
}
