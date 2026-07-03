import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation } from "@apollo/client/react";
import {
  X, Printer, Camera, CheckCircle2, Loader2,
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { REGISTRAR_DEVOLUCION_DOC } from "../../lib/queries";
import { generarComprobanteDevolucionDoc } from "../../utils/comprobanteDevolucionDocPdf";
import { useAuth } from "../../context/AuthContext";

interface DocItem {
  id: string;
  codigoDoc?: string;
  titulo?: string;
  tipoDoc?: string;
}

interface Props {
  prestamoId: string;
  item: DocItem;
  personaNombre: string;
  personaId: string;
  fechaPrest: string;
  formatDate: (d: string) => string;
  observacionesIniciales?: string;
  selectedItems?: DocItem[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function DevolverDocModal({
  prestamoId, item, personaNombre, personaId,
  fechaPrest, formatDate, observacionesIniciales, selectedItems,
  onClose, onSuccess,
}: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<"form" | "success">("form");
  const [observaciones, setObservaciones] = useState(observacionesIniciales || "");
  const [estado, setEstado] = useState("buen_estado");
  const [bloquear, setBloquear] = useState(false);
  const [error, setError] = useState("");
  const [devolucionData, setDevolucionData] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [qrBaseUrl, setQrBaseUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [registrarDevolucion, { loading: saving }] = useMutation(
    REGISTRAR_DEVOLUCION_DOC,
  );

  const handleClose = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    onClose();
  }, [previewUrl, onClose]);

  useEffect(() => {
    if (step === "success") {
      setPolling(true);
      const envUrl = (import.meta.env.VITE_QR_BASE_URL as string || '').replace(/\/+$/, '');
      setQrBaseUrl(envUrl);
    } else {
      setPolling(false);
    }
  }, [step]);

  useEffect(() => {
    if (!polling || !devolucionData?.tokenFirma || !qrBaseUrl) return;
    const checkUrl = `${qrBaseUrl}/api/upload-firma/${devolucionData.tokenFirma}/`;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(checkUrl, { method: 'GET' });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.url) {
            setPreviewUrl(data.url);
            setPolling(false);
          }
        }
      } catch {
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [polling, devolucionData, qrBaseUrl]);

  const handleConfirm = async () => {
    setError("");
    try {
      const { data } = await registrarDevolucion({
        variables: {
          idPrestamoDocItem: prestamoId,
          observaciones: observaciones || undefined,
          estadoDevolucion: estado,
          bloquearPersona: bloquear || undefined,
        },
      });
      if (data?.registrarDevolucionDoc?.error) throw new Error(data.registrarDevolucionDoc.error);
      setDevolucionData(data.registrarDevolucionDoc.devolucion);
      setStep("success");
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al devolver");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !devolucionData?.tokenFirma) return;
    setUploading(true);
    setUploadMsg("");
    try {
      const formData = new FormData();
      formData.append("foto", file);
      const res = await fetch(`/api/upload-firma/${devolucionData.tokenFirma}/`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al subir foto");
      setPreviewUrl(data.url);
      setPolling(false);
      setUploadMsg("Foto subida correctamente");
    } catch (err: unknown) {
      setUploadMsg(err instanceof Error ? err.message : "Error al subir foto");
    } finally {
      setUploading(false);
    }
  };

  const firmaUrl = devolucionData?.tokenFirma && qrBaseUrl
    ? `${qrBaseUrl}/firma/${devolucionData.tokenFirma}`
    : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={handleClose}>
      <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        {step === "form" && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-surface-800 dark:text-navy-200">
                Devolver Documento
              </h3>
              <button onClick={handleClose} className="p-1.5 rounded-lg text-surface-400 hover:text-surface-600 dark:hover:text-navy-300 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              {selectedItems && selectedItems.length > 0 && (
                <div className="px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-1">
                    Documentos seleccionados:
                  </p>
                  {selectedItems.map(doc => (
                    <p key={doc.id} className="text-xs text-blue-600 dark:text-blue-400">
                      {doc.codigoDoc} — {doc.titulo}{doc.tipoDoc ? ` (${doc.tipoDoc})` : ''}
                    </p>
                  ))}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-surface-600 dark:text-navy-500 mb-1">Estado de Devolución</label>
                <select
                  value={estado}
                  onChange={(e) => { setEstado(e.target.value); if (e.target.value === 'buen_estado') setBloquear(false); }}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400/50 transition-all text-sm"
                >
                  <option value="buen_estado">Buen Estado</option>
                  <option value="dañado">Dañado</option>
                  <option value="perdido">Perdido</option>
                  <option value="incompleto">Incompleto</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-600 dark:text-navy-500 mb-1">Observaciones</label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400/50 transition-all text-sm"
                  rows={3}
                  placeholder="Observaciones sobre la devolución..."
                />
              </div>

              {(estado === 'dañado' || estado === 'perdido' || estado === 'incompleto') && (
                <label className="flex items-start gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 cursor-pointer">
                  <input type="checkbox" checked={bloquear} onChange={(e) => setBloquear(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-surface-300 text-red-600 focus:ring-red-400"
                  />
                  <div>
                    <p className="text-sm font-semibold text-red-700 dark:text-red-300">Bloquear a {personaNombre}</p>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">No podrá recibir nuevos préstamos hasta que un administrador lo desbloquee.</p>
                  </div>
                </label>
              )}

              {error && <p className="text-xs text-red-600">{error}</p>}

              <div className="flex justify-end gap-2">
                <button onClick={handleClose}
                  className="px-4 py-2 rounded-xl text-surface-600 bg-white/60 border border-white/80 hover:bg-white transition-colors text-xs font-medium"
                >Cancelar</button>
                <button onClick={handleConfirm} disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 text-white font-medium shadow-md text-xs disabled:opacity-50"
                >{saving ? 'Devolviendo...' : 'Confirmar Devolución'}</button>
              </div>
            </div>
          </>
        )}

        {step === "success" && devolucionData && (
          <>
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="text-green-600 dark:text-green-400" size={32} />
              </div>
              <h3 className="text-lg font-bold text-surface-800 dark:text-navy-200">
                Devoluci\u00F3n registrada
              </h3>
              <p className="text-sm text-surface-500">
                Escanea el c\u00F3digo QR para firmar desde tu m\u00F3vil
              </p>

              {firmaUrl && (
                <div className="flex justify-center">
                  <div className="bg-white p-3 rounded-xl shadow-md inline-block">
                    <QRCodeCanvas value={firmaUrl} size={160} />
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs text-surface-400 mb-1">O sube la foto directamente:</p>
                <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-dashed border-brand-300 dark:border-brand-dark-600/30 text-brand-600 dark:text-brand-dark-400 cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-dark-600/20 transition-colors text-sm font-medium">
                  <Camera size={18} />
                  {uploading ? "Subiendo..." : "Seleccionar foto"}
                  <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
                </label>
              </div>

              {uploadMsg && (
                <p className={`text-xs ${uploadMsg.includes("correctamente") ? "text-green-600" : "text-red-600"}`}>
                  {uploadMsg}
                </p>
              )}

              {polling && (
                <div className="flex items-center justify-center gap-2 text-sm text-surface-500">
                  <Loader2 size={16} className="animate-spin" />
                  Esperando foto desde el m\u00F3vil...
                </div>
              )}

              {previewUrl && (
                <div className="mt-2">
                  <p className="text-xs font-semibold text-green-600 mb-1">Foto recibida:</p>
                  <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                    <img src={previewUrl} alt="Firma" className="mx-auto max-h-40 rounded-xl shadow-md" />
                  </a>
                </div>
              )}

              <div className="flex justify-center gap-2 pt-2">
                <button onClick={handleClose}
                  className="px-4 py-2 rounded-xl text-surface-600 bg-white/60 border border-white/80 hover:bg-white transition-colors text-xs font-medium"
                >Cerrar</button>
                <button
                  onClick={() => generarComprobanteDevolucionDoc({
                    personaNombre,
                    usuarioNombre: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
                    formatDate,
                    fechaPrest,
                    fechaDevolucion: devolucionData.fechaDevol,
                    observaciones,
                    estadoDevolucion: estado,
                    documento: item,
                  })}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 text-white font-medium shadow-md text-xs"
                >
                  <Printer size={14} />
                  Imprimir comprobante
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
