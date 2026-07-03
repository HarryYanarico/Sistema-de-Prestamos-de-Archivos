import { CheckCircle2, Printer, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { generarComprobanteRetiroPDF } from '../../utils/comprobanteRetiroPdf';
import type { RetiroData } from '../../utils/comprobanteRetiroPdf';
import { formatDate } from '../../utils/formatDate';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: RetiroData;
}

export default function ModalExitoRetiro({ isOpen, onClose, data }: Props) {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-navy-800 rounded-2xl shadow-2xl border border-white/20 dark:border-navy-700/30 overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-green-500 to-emerald-400" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-surface-400 hover:text-surface-600 dark:hover:text-navy-300 hover:bg-surface-100 dark:hover:bg-navy-700 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="px-8 pt-10 pb-6 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center mb-4">
            <CheckCircle2 size={36} className="text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-xl font-bold text-surface-800 dark:text-navy-200 mb-1">
            Retiro Registrado
          </h3>
          <p className="text-sm text-surface-500 dark:text-navy-400 mb-6">
            El retiro se ha registrado correctamente en el sistema.
          </p>
        </div>

        <div className="px-8 pb-6 space-y-3">
          <div className="rounded-xl bg-surface-50 dark:bg-navy-700/40 border border-surface-200/60 dark:border-navy-600/30 divide-y divide-surface-200/60 dark:divide-navy-600/30">
            <div className="flex justify-between px-4 py-3">
              <span className="text-sm text-surface-500 dark:text-navy-400">Carpeta</span>
              <span className="text-sm font-medium text-surface-800 dark:text-navy-200 text-right">{data.carpeta.descripcion}</span>
            </div>
            <div className="flex justify-between px-4 py-3">
              <span className="text-sm text-surface-500 dark:text-navy-400">Ubicaci&oacute;n</span>
              <span className="text-sm font-medium text-surface-800 dark:text-navy-200 text-right">{data.carpeta.ubicacion}</span>
            </div>
            <div className="flex justify-between px-4 py-3">
              <span className="text-sm text-surface-500 dark:text-navy-400">Persona que retira</span>
              <span className="text-sm font-medium text-surface-800 dark:text-navy-200 text-right">
                {data.persona.nombre} {data.persona.apellido}{data.persona.ci ? ` (${data.persona.ci})` : ''}
              </span>
            </div>
            <div className="flex justify-between px-4 py-3">
              <span className="text-sm text-surface-500 dark:text-navy-400">Autorizado por</span>
              <span className="text-sm font-medium text-surface-800 dark:text-navy-200 text-right">
                {data.autorizadoPor.nombre} {data.autorizadoPor.apellido}{data.autorizadoPor.ci ? ` (${data.autorizadoPor.ci})` : ''}
              </span>
            </div>
            <div className="flex justify-between px-4 py-3">
              <span className="text-sm text-surface-500 dark:text-navy-400">Fecha de retiro</span>
              <span className="text-sm font-medium text-surface-800 dark:text-navy-200 text-right">{formatDate(data.fechaRetiro)}</span>
            </div>
            <div className="flex justify-between px-4 py-3">
              <span className="text-sm text-surface-500 dark:text-navy-400">Motivo</span>
              <span className="text-sm font-medium text-surface-800 dark:text-navy-200 text-right">{data.motivo}</span>
            </div>
            {data.observaciones && (
              <div className="flex justify-between px-4 py-3">
                <span className="text-sm text-surface-500 dark:text-navy-400">Observaciones</span>
                <span className="text-sm font-medium text-surface-800 dark:text-navy-200 text-right max-w-[200px]">{data.observaciones}</span>
              </div>
            )}
          </div>
        </div>

        <div className="px-8 pb-8 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-surface-300/80 dark:border-navy-600/50 text-surface-700 dark:text-navy-300 hover:bg-surface-50 dark:hover:bg-navy-700/50 transition-all text-sm font-medium"
          >
            Cerrar
          </button>
          <button
            onClick={() => generarComprobanteRetiroPDF(data)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 dark:from-brand-dark-500 dark:to-blue-500 text-white font-medium shadow-md hover:shadow-lg transition-all text-sm"
          >
            <Printer size={16} />
            Imprimir constancia
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
