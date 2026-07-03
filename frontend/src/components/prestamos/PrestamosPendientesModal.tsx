import { useState } from 'react';
import { X, AlertTriangle, Ban } from 'lucide-react';
import BloqueoModal from './BloqueoModal';
import type { BloqueoInfo } from './BloqueoModal';
import { formatDate } from '../../utils/formatDate';

interface PendingItem {
  descripcion: string;
  fechaPrest: string;
  fechaDevolucion: string;
  diasRetraso: number;
}

interface Props {
  persona: {
    id: string;
    nombre: string;
    apellido: string;
    ci: string;
    telefono?: string;
    email?: string;
  };
  items: PendingItem[];
  type: 'carpetas' | 'documentos';
  onClose: () => void;
  onBloquear?: (personaId: string, motivo: string) => Promise<string>;
}

export default function PrestamosPendientesModal({ persona, items, type, onClose, onBloquear }: Props) {
  const [showBloqueo, setShowBloqueo] = useState(false);

  const bloqueoInfo: BloqueoInfo = {
    persona: {
      nombre: persona.nombre,
      apellido: persona.apellido,
      ci: persona.ci,
      telefono: persona.telefono,
      email: persona.email,
    },
    fechaPrest: items.reduce((a, b) => a < b.fechaPrest ? a : b.fechaPrest, items[0]?.fechaPrest || ''),
    fechaDevolucion: items.reduce((a, b) => a < b.fechaDevolucion ? a : b.fechaDevolucion, items[0]?.fechaDevolucion || ''),
    diasRetraso: Math.max(...items.map(i => i.diasRetraso), 0),
    itemsVencidos: items.map(i => ({ descripcion: i.descripcion })),
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/70 backdrop-blur-sm p-4">
        <div className="glass-panel rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-surface-800 dark:text-navy-200">
              {type === 'carpetas' ? 'Carpetas' : 'Documentos'} sin devolver de {persona.nombre} {persona.apellido}
            </h3>
            <button onClick={onClose}
              className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-400 transition-colors"
            ><X size={20} /></button>
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-surface-500 dark:text-navy-500 py-6 text-center">No hay {type} pendientes.</p>
          ) : (
            <div className="space-y-3 mb-6">
              {items.map((item, i) => (
                <div key={i} className="glass-card rounded-xl p-4">
                  <p className="font-semibold text-surface-800 dark:text-navy-200 text-sm">{item.descripcion}</p>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-surface-500 dark:text-navy-500">
                    <span>Préstamo: {formatDate(item.fechaPrest)}</span>
                    <span>Devolución: {formatDate(item.fechaDevolucion)}</span>
                    {item.diasRetraso > 0 && (
                      <span className="text-red-600 dark:text-red-400 font-semibold">{item.diasRetraso} día(s) vencido</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {items.length > 0 && onBloquear && (
            <button onClick={() => setShowBloqueo(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-500 dark:from-red-500 dark:to-red-600 text-white font-medium shadow-md hover:shadow-lg transition-all text-sm"
            ><Ban size={16} /> Bloquear a {persona.nombre} {persona.apellido}</button>
          )}

          <div className="flex justify-end mt-4">
            <button onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-surface-600 dark:text-navy-400 bg-white/60 dark:bg-navy-800/60 border border-white/80 dark:border-navy-700/60 hover:bg-white dark:hover:bg-navy-800 transition-colors text-sm font-medium"
            >Cerrar</button>
          </div>
        </div>
      </div>

      {showBloqueo && (
        <BloqueoModal
          personaNombre={`${persona.nombre} ${persona.apellido}`}
          info={bloqueoInfo}
          onClose={() => setShowBloqueo(false)}
          onBloquear={async (motivo) => {
            const res = await onBloquear(persona.id, motivo);
            if (res.startsWith('✅')) setShowBloqueo(false);
            return res;
          }}
        />
      )}
    </>
  );
}