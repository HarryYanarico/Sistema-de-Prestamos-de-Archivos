import { X, Eye, Printer } from 'lucide-react';
import { useState } from 'react';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

interface Props {
  devolucion: any;
  onClose: () => void;
}

export default function DetalleDevolucionModal({ devolucion, onClose }: Props) {
  const [firmaPreview, setFirmaPreview] = useState<string | null>(null);
  const pc = devolucion.prestamoCarpeta;
  const prestamo = pc?.prestamo;
  const persona = prestamo?.persona;
  const carpeta = pc?.carpeta;
  const ubicacion = carpeta?.piso;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/70 backdrop-blur-sm p-4">
      <div className="glass-panel rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-surface-800 dark:text-navy-200">Detalle de la Devolución</h3>
          <button onClick={onClose}
            className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-400 transition-colors"
          ><X size={20} /></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="glass-card rounded-xl p-4">
            <p className="text-xs text-surface-600 dark:text-navy-500 mb-1">Fecha de devolución</p>
            <p className="font-semibold text-surface-800 dark:text-navy-200">{formatDate(devolucion.fechaDevol)}</p>
          </div>
          <div className="glass-card rounded-xl p-4">
            <p className="text-xs text-surface-600 dark:text-navy-500 mb-1">Estado</p>
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
              devolucion.estadoDevolucion === 'buen_estado'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                : devolucion.estadoDevolucion === 'mal_estado'
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
            }`}>
              {devolucion.estadoDevolucion === 'buen_estado' ? 'Buen estado' : devolucion.estadoDevolucion === 'mal_estado' ? 'Mal estado' : 'Dañado'}
            </span>
          </div>
        </div>

        <div className="glass-card rounded-xl p-4 mb-4">
          <p className="text-xs text-surface-600 dark:text-navy-500 mb-2">Carpeta</p>
          <p className="font-semibold text-surface-800 dark:text-navy-200">{carpeta?.descripcion ?? '—'}</p>
          {ubicacion && (
            <p className="text-sm text-surface-500 dark:text-navy-500 mt-1">
              {ubicacion.estante?.ambiente?.nombre} / {ubicacion.estante?.codigo} / Fila {ubicacion.nroFila}
            </p>
          )}
        </div>

        <div className="glass-card rounded-xl p-4 mb-4">
          <p className="text-xs text-surface-600 dark:text-navy-500 mb-2">Persona que tenía el préstamo</p>
          <p className="font-semibold text-surface-800 dark:text-navy-200 text-lg">
            {persona ? `${persona.nombre} ${persona.apellido}` : '—'}
          </p>
          {persona && (
            <div className="text-sm text-surface-600 dark:text-navy-500 space-y-0.5 mt-1">
              <p>CI: {persona.ci}</p>
              <p>Tel: {persona.telefono || '—'}</p>
              <p>Email: {persona.email || '—'}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="glass-card rounded-xl p-4">
            <p className="text-xs text-surface-600 dark:text-navy-500 mb-1">Fecha de préstamo</p>
            <p className="font-semibold text-surface-800 dark:text-navy-200">{prestamo ? formatDate(prestamo.fechaPrest) : '—'}</p>
          </div>
          <div className="glass-card rounded-xl p-4">
            <p className="text-xs text-surface-600 dark:text-navy-500 mb-1">Fecha de devolución</p>
            <p className="font-semibold text-surface-800 dark:text-navy-200">{prestamo ? formatDate(prestamo.fechaDevolucion) : '—'}</p>
          </div>
        </div>

        {prestamo?.autorizadoPor && (
          <div className="glass-card rounded-xl p-4 mb-4 border border-amber-100 dark:border-amber-800">
            <p className="text-xs text-surface-600 dark:text-navy-500 mb-2">Préstamo autorizado por</p>
            <p className="font-semibold text-surface-800 dark:text-navy-200">{prestamo.autorizadoPor.nombre} {prestamo.autorizadoPor.apellido}</p>
            <span className="mt-1 inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">{prestamo.autorizadoPor.cargo}</span>
          </div>
        )}

        <div className="glass-card rounded-xl p-4 mb-4">
          <p className="text-xs text-surface-600 dark:text-navy-500 mb-2">Registró la devolución</p>
          <p className="font-semibold text-surface-800 dark:text-navy-200">
            {devolucion.usuario ? `${devolucion.usuario.firstName} ${devolucion.usuario.lastName} (@${devolucion.usuario.username})` : '—'}
          </p>
        </div>

        {prestamo?.usuario && (
          <div className="glass-card rounded-xl p-4 mb-4">
            <p className="text-xs text-surface-600 dark:text-navy-500 mb-2">Registró el préstamo</p>
            <p className="font-semibold text-surface-800 dark:text-navy-200">
              {prestamo.usuario.firstName} {prestamo.usuario.lastName} (@{prestamo.usuario.username})
            </p>
          </div>
        )}

        {devolucion.observaciones && (
          <div className="glass-card rounded-xl p-4 mb-4">
            <p className="text-xs text-surface-600 dark:text-navy-500 mb-2">Observaciones de la devolución</p>
            <p className="text-surface-700 dark:text-navy-300">{devolucion.observaciones}</p>
          </div>
        )}

          {prestamo?.observaciones && (
          <div className="glass-card rounded-xl p-4">
            <p className="text-xs text-surface-600 dark:text-navy-500 mb-2">Observaciones del préstamo</p>
            <p className="text-surface-700 dark:text-navy-300">{prestamo.observaciones}</p>
          </div>
        )}

        {devolucion.tokenFirma && (
          <div className="glass-card rounded-xl p-4">
            <p className="text-xs text-surface-600 dark:text-navy-500 mb-2">Foto Firma</p>
            <button
              onClick={() => setFirmaPreview(devolucion.tokenFirma)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-100 dark:bg-brand-dark-600/30 text-brand-600 dark:text-brand-dark-400 hover:bg-brand-200 dark:hover:bg-brand-dark-600/50 transition-colors text-sm font-medium"
            >
              <Eye size={16} />
              Ver foto firma
            </button>
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
                alt="Foto Firma"
                className="w-full h-auto rounded-xl bg-white"
                style={{ maxHeight: '70vh', objectFit: 'contain' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
