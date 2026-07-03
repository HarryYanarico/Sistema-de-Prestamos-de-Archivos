import { useState } from 'react';
import { X, Eye, Printer, FileText } from 'lucide-react';
import { formatDate } from '../../utils/formatDate';

interface Props {
  prestamo: any;
  onClose: () => void;
}

export default function DetallePrestamoDocModal({ prestamo, onClose }: Props) {
  const [firmaPreview, setFirmaPreview] = useState<string | null>(null);

  const items = prestamo.items || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/70 backdrop-blur-sm p-4">
      <div className="glass-panel rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-surface-800 dark:text-navy-200">Detalle del Préstamo</h3>
          <button onClick={onClose}
            className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-400 transition-colors"
          ><X size={20} /></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="glass-card rounded-xl p-4">
            <p className="text-xs text-surface-600 dark:text-navy-500 mb-1">Fecha de préstamo</p>
            <p className="font-semibold text-surface-800 dark:text-navy-200">{formatDate(prestamo.fechaPrest)}</p>
          </div>
          <div className="glass-card rounded-xl p-4">
            <p className="text-xs text-surface-600 dark:text-navy-500 mb-1">Fecha de devolución</p>
            <p className="font-semibold text-surface-800 dark:text-navy-200">{formatDate(prestamo.fechaDevolucion)}</p>
          </div>
        </div>

        <div className="glass-card rounded-xl p-4 mb-4">
          <p className="text-xs text-surface-600 dark:text-navy-500 mb-2">Persona que recibe</p>
          <p className="font-semibold text-surface-800 dark:text-navy-200 text-lg">{prestamo.persona.nombre} {prestamo.persona.apellido}</p>
          <div className="text-sm text-surface-600 dark:text-navy-500 space-y-0.5 mt-1">
            <p>CI: {prestamo.persona.ci}</p>
            {prestamo.persona.telefono && <p>Tel: {prestamo.persona.telefono}</p>}
            {prestamo.persona.email && <p>Email: {prestamo.persona.email}</p>}
          </div>
        </div>

        {prestamo.autorizadoPor && (
          <div className="glass-card rounded-xl p-4 mb-4 border border-amber-100 dark:border-amber-800">
            <p className="text-xs text-surface-600 dark:text-navy-500 mb-2">Autorizado por</p>
            <p className="font-semibold text-surface-800 dark:text-navy-200">{prestamo.autorizadoPor.nombre} {prestamo.autorizadoPor.apellido}</p>
            <span className="mt-1 inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">{prestamo.autorizadoPor.cargo}</span>
          </div>
        )}

        {prestamo.usuario && (
          <div className="glass-card rounded-xl p-4 mb-4">
            <p className="text-xs text-surface-600 dark:text-navy-500 mb-2">Registrado por</p>
            <p className="font-semibold text-surface-800 dark:text-navy-200">
              {prestamo.usuario.firstName} {prestamo.usuario.lastName} (@{prestamo.usuario.username})
            </p>
          </div>
        )}

        {prestamo.observaciones && (
          <div className="glass-card rounded-xl p-4 mb-4">
            <p className="text-xs text-surface-600 dark:text-navy-500 mb-2">Observaciones</p>
            <p className="text-surface-700 dark:text-navy-300">{prestamo.observaciones}</p>
          </div>
        )}

        <div className="glass-card rounded-xl p-4 mb-4">
          <p className="text-xs text-surface-600 dark:text-navy-500 mb-3">Documentos ({items.length})</p>
          <div className="space-y-1">
            {items.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white/50 dark:bg-navy-800/50 border border-white/40 dark:border-navy-700/40">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-surface-400" />
                  <span className="font-mono text-xs text-surface-500 dark:text-navy-400">{item.documento?.codigoDoc}</span>
                  <span className="text-sm text-surface-800 dark:text-navy-200">{item.documento?.titulo || item.documento?.tipoDoc}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  item.estado === 'devuelto'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                }`}>
                  {item.estado === 'devuelto' ? 'Devuelto' : 'Prestado'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {prestamo.fotoFirma && (
          <div className="glass-card rounded-xl p-4">
            <p className="text-xs text-surface-600 dark:text-navy-500 mb-2">Foto Firma</p>
            <button
              onClick={() => setFirmaPreview(prestamo.tokenFirma)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-100 dark:bg-brand-dark-600/30 text-brand-600 dark:text-brand-dark-400 hover:bg-brand-200 dark:hover:bg-brand-dark-600/50 transition-colors text-sm font-medium"
            >
              <Eye size={16} />
              Ver foto firma
            </button>
          </div>
        )}

        {prestamo.tokenFirma && !prestamo.fotoFirma && (
          <div className="glass-card rounded-xl p-4">
            <p className="text-xs text-surface-600 dark:text-navy-500 mb-2">Foto Firma</p>
            <p className="text-sm text-surface-500 dark:text-navy-400 italic">Pendiente de firma</p>
          </div>
        )}
      </div>

      {firmaPreview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setFirmaPreview(null)}>
          <div className="relative max-w-3xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="glass-panel rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-surface-800 dark:text-navy-200">Foto Firma</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const printWin = window.open('', '_blank');
                      if (printWin) {
                        printWin.document.write(`
                          <html><head><title>Foto Firma</title>
                          <style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh}img{max-width:100%;height:auto}</style>
                          </head><body>
                          <img src="/api/firma/imagen/${firmaPreview}/" onload="window.print();window.close()" />
                          </body></html>
                        `);
                        printWin.document.close();
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-colors"
                  >
                    <Printer size={16} />
                    Imprimir
                  </button>
                  <button
                    onClick={() => setFirmaPreview(null)}
                    className="flex items-center justify-center w-8 h-8 rounded-lg bg-surface-200 dark:bg-navy-700 text-surface-600 dark:text-navy-300 hover:bg-surface-300 dark:hover:bg-navy-600 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              <img
                src={`/api/firma/imagen/${firmaPreview}/`}
                alt="Foto de firma"
                className="w-full rounded-xl border border-surface-300 dark:border-navy-600"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
