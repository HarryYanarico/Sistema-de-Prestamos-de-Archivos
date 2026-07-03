import { useState } from 'react';
import { X, Calendar } from 'lucide-react';

interface PrestamoOption {
  id: string;
  label: string;
  personaId: string;
  personaNombre: string;
}

interface Props {
  prestamos: PrestamoOption[];
  prestamoPreseleccionado?: string;
  onClose: () => void;
  onSolicitar: (vars: { prestamoId: string; diasSolicit: number; motivo?: string }) => Promise<string>;
}

export default function SolicitarProrrogaModal({ prestamos, prestamoPreseleccionado, onClose, onSolicitar }: Props) {
  const [selectedPrestamo, setSelectedPrestamo] = useState(prestamoPreseleccionado ?? '');
  const [dias, setDias] = useState(15);
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const handleSubmit = async () => {
    if (!selectedPrestamo) { setMsg('Selecciona un préstamo'); return; }
    if (dias < 1) { setMsg('Los días deben ser mayor a 0'); return; }
    setSaving(true);
    const res = await onSolicitar({ prestamoId: selectedPrestamo, diasSolicit: dias, motivo: motivo || undefined });
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
            Solicitar Prórroga
          </h3>
          <button onClick={onClose}
            className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-100 transition-colors"
          ><X size={20} /></button>
        </div>

        {msg && (
          <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm font-medium ${
            msg.startsWith('✅')
              ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 text-green-700 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-900/30 border border-red-200 text-red-700 dark:text-red-300'
          }`}>{msg}</div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-surface-600 dark:text-navy-500 mb-1">Préstamo</label>
            {prestamoPreseleccionado ? (
              <p className="text-sm font-medium text-surface-800 dark:text-navy-200 px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40">
                {prestamos.find((p) => p.id === prestamoPreseleccionado)?.label ?? '—'}
              </p>
            ) : (
              <select value={selectedPrestamo} onChange={(e) => setSelectedPrestamo(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400/50 transition-all text-sm"
              >
                <option value="">Seleccionar préstamo...</option>
                {prestamos.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-surface-600 dark:text-navy-500 mb-1">Días solicitados</label>
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
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 dark:from-brand-dark-500 dark:to-blue-500 text-white font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
          ><Calendar size={16} /> {saving ? 'Solicitando...' : 'Solicitar Prórroga'}</button>
        </div>
      </div>
    </div>
  );
}
