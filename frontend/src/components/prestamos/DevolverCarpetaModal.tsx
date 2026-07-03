import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import {
  X, Undo2, FileText, AlertTriangle, CheckCircle2, Loader2,
  Calendar, FileSignature, Printer, Camera, ChevronDown, ChevronUp,
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import {
  GET_CARPETAS_CON_DOCUMENTOS,
  REGISTRAR_DEVOLUCION_CON_DOCUMENTOS,
} from "../../lib/queries";
import { generarComprobanteDevolucion } from "../../utils/comprobanteDevolucionPdf";
import { generarComprobanteDevolucionMultiple } from "../../utils/comprobanteDevolucionMultiplePdf";
import { useAuth } from "../../context/AuthContext";

interface DocumentoItem {
  id: string;
  codigoDoc?: string;
  titulo: string;
  tipoDoc?: string;
  fechaIngre?: string;
  estado: string;
  isPrestadoIndividual: boolean;
}

interface BulkItem {
  pcId: string;
  carpetaDesc: string;
  carpetaId: string;
  personaNombre: string;
  personaId: string;
  prestamoId: string;
  fechaPrest: string;
  fechaDevolucion: string;
}

interface Props {
  items: BulkItem[];
  formatDate: (d: string) => string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DevolverCarpetaModal({
  items: initialItems, formatDate, onClose, onSuccess,
}: Props) {
  const { user } = useAuth();
  const [currentItems, setCurrentItems] = useState(initialItems);
  const [step, setStep] = useState<"checklist" | "prorroga" | "processing" | "success">("checklist");
  const [msg, setMsg] = useState("");
  const [checkedDocsByPcId, setCheckedDocsByPcId] = useState<Map<string, Set<string>>>(new Map());
  const [diasProrroga, setDiasProrroga] = useState(7);
  const [motivoProrroga, setMotivoProrroga] = useState("");
  const [successData, setSuccessData] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const initialPcIds = new Set(initialItems.map((i) => i.pcId));
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(initialPcIds);
  const [page, setPage] = useState(0);
  const itemsPerPage = 3;

  const isSingle = currentItems.length === 1;

  const carpetaIds = currentItems.map((i) => i.carpetaId);
  const { data: carpetasData, loading: loadingDocs } = useQuery(
    GET_CARPETAS_CON_DOCUMENTOS,
    { variables: { ids: carpetaIds }, fetchPolicy: "network-only" },
  );

  const allCarpetas = carpetasData?.allCarpetas ?? [];
  const docsByCarpetaId = new Map<string, DocumentoItem[]>();
  for (const c of allCarpetas) {
    docsByCarpetaId.set(c.id, c.documentos ?? []);
  }

  const foldersWithDocs = currentItems.map((item) => ({
    ...item,
    documentos: docsByCarpetaId.get(item.carpetaId) ?? [],
  }));

  const prorrogaNeeded = foldersWithDocs.some((f) => {
    const docs = f.documentos.filter((d) => !d.isPrestadoIndividual);
    const checked = checkedDocsByPcId.get(f.pcId) ?? new Set();
    return docs.some((d) => !checked.has(d.id));
  });

  const handleClose = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    onClose();
  }, [previewUrl, onClose]);

  const [registrarDevolucion, { loading: saving }] = useMutation(
    REGISTRAR_DEVOLUCION_CON_DOCUMENTOS,
  );

  useEffect(() => {
    if (!polling || !successData?.tokenFirma) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/upload-firma/${successData.tokenFirma}/`, { method: 'GET' });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.url) {
            setPreviewUrl(json.url);
            setUploadMsg("Foto recibida desde el celular");
          }
        }
      } catch {
        // silent retry
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [polling, successData?.tokenFirma]);

  const [qrBaseUrl, setQrBaseUrl] = useState('');

  useEffect(() => {
    if (step === "success" && successData?.tokenFirma) {
      setPolling(true);
      const envUrl = (import.meta.env.VITE_QR_BASE_URL as string || '').replace(/\/+$/, '');
      setQrBaseUrl(envUrl);
    } else {
      setPolling(false);
    }
  }, [step, successData?.tokenFirma]);

  useEffect(() => {
    if (foldersWithDocs.length > 0 && checkedDocsByPcId.size === 0) {
      const newMap = new Map<string, Set<string>>();
      for (const f of foldersWithDocs) {
        const checked = new Set<string>();
        for (const d of f.documentos) {
          if (!d.isPrestadoIndividual) checked.add(d.id);
        }
        newMap.set(f.pcId, checked);
      }
      setCheckedDocsByPcId(newMap);
    }
  }, [foldersWithDocs]);

  const faltantesByFolder = new Map<string, DocumentoItem[]>();
  for (const f of foldersWithDocs) {
    const docs = f.documentos.filter((d) => !d.isPrestadoIndividual);
    const checked = checkedDocsByPcId.get(f.pcId) ?? new Set();
    const faltantes = docs.filter((d) => !checked.has(d.id));
    if (faltantes.length > 0) faltantesByFolder.set(f.pcId, faltantes);
  }
  const hasMissingDocs = faltantesByFolder.size > 0;

  const totalPages = Math.max(1, Math.ceil(foldersWithDocs.length / itemsPerPage));
  const safePage = Math.min(page, totalPages - 1);
  const paginatedFolders = foldersWithDocs.slice(safePage * itemsPerPage, (safePage + 1) * itemsPerPage);
  const foldersSinDocs = foldersWithDocs.filter((f) => {
    const editable = f.documentos.filter((d) => !d.isPrestadoIndividual);
    const checked = checkedDocsByPcId.get(f.pcId) ?? new Set();
    return editable.length > 0 && editable.every((d) => !checked.has(d.id));
  });
  const foldersParciales = foldersWithDocs.filter((f) => {
    const editable = f.documentos.filter((d) => !d.isPrestadoIndividual);
    const checked = checkedDocsByPcId.get(f.pcId) ?? new Set();
    return editable.some((d) => checked.has(d.id)) && editable.some((d) => !checked.has(d.id));
  });

  const handleToggleDoc = (pcId: string, docId: string) => {
    setCheckedDocsByPcId((prev) => {
      const next = new Map(prev);
      const folderDocs = new Set(next.get(pcId) ?? []);
      if (folderDocs.has(docId)) folderDocs.delete(docId);
      else folderDocs.add(docId);
      next.set(pcId, folderDocs);
      return next;
    });
  };

  const toggleAllDocs = (pcId: string) => {
    const folder = foldersWithDocs.find((f) => f.pcId === pcId);
    if (!folder) return;
    const editable = folder.documentos.filter((d) => !d.isPrestadoIndividual);
    const checked = checkedDocsByPcId.get(pcId) ?? new Set();
    const allChecked = editable.every((d) => checked.has(d.id));
    setCheckedDocsByPcId((prev) => {
      const next = new Map(prev);
      const folderDocs = new Set(next.get(pcId) ?? []);
      if (allChecked) {
        for (const d of editable) folderDocs.delete(d.id);
      } else {
        for (const d of editable) folderDocs.add(d.id);
      }
      next.set(pcId, folderDocs);
      return next;
    });
  };

  useEffect(() => {
    if (safePage !== page) setPage(safePage);
  }, [safePage, page]);

  const handleRemoveItem = (pcId: string) => {
    const newItems = currentItems.filter((i) => i.pcId !== pcId);
    if (newItems.length === currentItems.length) return;
    setCurrentItems(newItems);

    setCheckedDocsByPcId((prev) => {
      const next = new Map(prev);
      next.delete(pcId);
      return next;
    });
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      next.delete(pcId);
      return next;
    });
  };

  const toggleFolder = (pcId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(pcId)) next.delete(pcId);
      else next.add(pcId);
      return next;
    });
  };

  const openProrroga = () => {
    const docsFaltantes: string[] = [];
    for (const [_, faltantes] of faltantesByFolder) {
      for (const d of faltantes) docsFaltantes.push(d.tipoDoc || d.titulo);
    }
    setDiasProrroga(7);
    setMotivoProrroga(`Documentos faltantes: ${docsFaltantes.join(', ')}`);
    setStep("prorroga");
  };

  const [showWarning, setShowWarning] = useState(false);

  const handleSubmitChecklist = () => {
    if (foldersSinDocs.length > 0) {
      setShowWarning(true);
    } else if (hasMissingDocs) {
      openProrroga();
    } else {
      setStep("processing");
      submitAll();
    }
  };

  const submitAll = async (conProrroga = false, dias = 7, motivo = "") => {
    setProgress({ current: 0, total: currentItems.length });
    const errors: string[] = [];
    let ok = 0;
    let lastToken = "";
    let totalProrrogaCreada = false;
    let allDocsFaltantes: string[] = [];

    for (let i = 0; i < currentItems.length; i++) {
      const item = currentItems[i];
      setProgress({ current: i + 1, total: currentItems.length });

      const docs = foldersWithDocs.find((f) => f.pcId === item.pcId)?.documentos ?? [];
      const idsPresentes = docs
        .filter((d) => (checkedDocsByPcId.get(item.pcId) ?? new Set()).has(d.id) && !d.isPrestadoIndividual)
        .map((d) => d.id);
      const idsFaltantes = docs
        .filter((d) => !(checkedDocsByPcId.get(item.pcId) ?? new Set()).has(d.id) && !d.isPrestadoIndividual)
        .map((d) => d);

      const faltan = idsFaltantes.length > 0;

      try {
        const { data } = await registrarDevolucion({
          variables: {
            idPrestamoCarpeta: item.pcId,
            idsDocumentosPresentes: idsPresentes,
            diasProrroga: faltan ? dias : null,
            motivoProrroga: faltan ? motivo : null,
          },
        });
        const result = data?.registrarDevolucionConDocumentos;
        if (result?.error) throw new Error(result.error);
        ok++;
        if (result?.tokenFirma) lastToken = result.tokenFirma;
        if (result?.prorrogaCreada) totalProrrogaCreada = true;
        if (result?.docsFaltantes) allDocsFaltantes = result.docsFaltantes;
      } catch (err: unknown) {
        errors.push(`${item.carpetaDesc}: ${err instanceof Error ? err.message : "Error"}`);
      }
    }

    setProgress({ current: 0, total: 0 });
    setSuccessData({
      tokenFirma: lastToken,
      estadoDevolucion: "buen_estado",
      prorrogaCreada: totalProrrogaCreada,
      docsFaltantes: allDocsFaltantes,
    });
    setMsg(`✅ ${ok} / ${currentItems.length} carpeta(s) devuelta(s) correctamente.`);
    if (errors.length > 0) setErrorsList(errors);
    setStep("success");
  };

  const [errorsList, setErrorsList] = useState<string[]>([]);

  const handleSubmitProrroga = () => {
    setStep("processing");
    submitAll(true, diasProrroga, motivoProrroga);
  };

  const handleUploadPhoto = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setUploadMsg("Solo se permiten imágenes");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setUploading(true);
    setUploadMsg("");
    try {
      const formData = new FormData();
      formData.append("foto", file);
      const res = await fetch(`/api/upload-firma/${successData?.tokenFirma}/`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      if (json.url) setPreviewUrl(json.url);
      setUploadMsg("Foto subida exitosamente");
    } catch (err: unknown) {
      setUploadMsg(err instanceof Error ? err.message : "Error al subir foto");
    } finally {
      setUploading(false);
    }
  }, [successData?.tokenFirma, previewUrl]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleUploadPhoto(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUploadPhoto(file);
  };

  const selectedCount = [...checkedDocsByPcId.values()].reduce(
    (acc, s) => acc + s.size, 0
  );
  const totalDocs = foldersWithDocs.reduce(
    (acc, f) => acc + f.documentos.length, 0
  );

  // ─── PRORROGA STEP ───
  if (step === "prorroga") {
    const allFaltantes: { carpetaDesc: string; docs: string[] }[] = [];
    for (const f of foldersWithDocs) {
      const docs = f.documentos.filter((d) => !d.isPrestadoIndividual);
      const checked = checkedDocsByPcId.get(f.pcId) ?? new Set();
      const faltantes = docs.filter((d) => !checked.has(d.id));
      if (faltantes.length > 0) {
        allFaltantes.push({
          carpetaDesc: f.carpetaDesc,
          docs: faltantes.map((d) => d.tipoDoc || d.titulo),
        });
      }
    }

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 dark:bg-black/70 backdrop-blur-sm p-4">
        <div className="glass-panel rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-surface-800 dark:text-navy-200 flex items-center gap-2">
              <AlertTriangle size={20} className="text-amber-600" />
              Devolución con documentos faltantes
            </h3>
            <button onClick={handleClose} className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 hover:bg-red-100 transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-2 mb-4">
            {allFaltantes.map((f) => (
              <div key={f.carpetaDesc} className="px-4 py-3 rounded-xl bg-red-50/60 dark:bg-red-900/15 border border-red-200/50">
                <p className="text-sm font-semibold text-surface-800 dark:text-navy-200 mb-1">{f.carpetaDesc}</p>
                <div className="flex flex-wrap gap-1">
                  {f.docs.map((d) => (
                    <span key={d} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                      <AlertTriangle size={10} /> {d}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mb-4">
            <label className="text-sm font-semibold text-surface-700 dark:text-navy-300 mb-1 block flex items-center gap-2">
              <Calendar size={14} />
              Días de prórroga
            </label>
            <input
              type="number"
              min={1}
              value={diasProrroga}
              onChange={(e) => setDiasProrroga(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-3 py-2 rounded-xl border border-surface-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-surface-800 dark:text-navy-200 text-sm"
            />
          </div>

          <div className="mb-4">
            <label className="text-sm font-semibold text-surface-700 dark:text-navy-300 mb-1 block flex items-center gap-2">
              <FileSignature size={14} />
              Motivo
            </label>
            <textarea
              value={motivoProrroga}
              onChange={(e) => setMotivoProrroga(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-surface-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-surface-800 dark:text-navy-200 text-sm resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-white/20 dark:border-navy-700/30">
            <button onClick={() => setStep("checklist")} className="px-5 py-2.5 rounded-xl text-surface-600 dark:text-navy-400 bg-white/60 dark:bg-navy-800/60 border border-white/80 dark:border-navy-700/60 hover:bg-white dark:hover:bg-navy-800 transition-colors text-sm font-medium">
              Atrás
            </button>
            <button onClick={handleSubmitProrroga} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-medium shadow-md bg-gradient-to-r from-amber-600 to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm">
              {saving ? "Guardando..." : "Confirmar Devolución"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── PROCESSING STEP ───
  if (step === "processing") {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 dark:bg-black/70 backdrop-blur-sm p-4">
        <div className="glass-panel rounded-2xl w-full max-w-md p-6">
          <div className="flex flex-col items-center py-8">
            <Loader2 size={32} className="animate-spin text-brand-600 mb-4" />
            <p className="text-lg font-semibold text-surface-800 dark:text-navy-200 mb-2">
              Procesando devoluciones...
            </p>
            {currentItems.length > 1 && (
              <>
                <p className="text-sm text-surface-600 dark:text-navy-400 mb-4">
                  Carpeta {progress.current} de {progress.total}
                </p>
                <div className="w-full h-2 rounded-full bg-surface-200 dark:bg-navy-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-green-600 to-green-500 transition-all"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── SUCCESS STEP ───
  if (step === "success" && successData) {
    const item = currentItems[0];
    const token = successData.tokenFirma;
    const qrUrl = qrBaseUrl && token ? `${qrBaseUrl}/firma/${token}` : '';

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 dark:bg-black/70 backdrop-blur-sm p-4">
        <div className="glass-panel rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mx-auto mb-3">
            <CheckCircle2 size={24} className="text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-lg font-bold text-surface-800 dark:text-navy-200 text-center mb-2">
            {currentItems.length === 1 ? "Devolución registrada exitosamente" : "Devoluciones registradas"}
          </h3>

          {msg && (
            <p className="text-sm text-green-700 dark:text-green-300 text-center mb-4">{msg}</p>
          )}

          {errorsList.length > 0 && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-sm">
              <p className="font-semibold text-red-700 dark:text-red-300 mb-1">Errores:</p>
              <ul className="list-disc list-inside text-red-600 dark:text-red-400">
                {errorsList.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          <div className="glass-card rounded-xl p-4 mb-4 text-sm space-y-1">
            <p><span className="text-surface-500 dark:text-navy-500">Persona:</span> <strong>{item?.personaNombre}</strong></p>
            <p><span className="text-surface-500 dark:text-navy-500">Carpetas devueltas:</span> <strong>{currentItems.length}</strong></p>
            {currentItems.length > 1 && (
              <p><span className="text-surface-500 dark:text-navy-500">Documentos presentes:</span> <strong>{selectedCount}/{totalDocs}</strong></p>
            )}
            {successData.prorrogaCreada && (
              <>
                <p><span className="text-surface-500 dark:text-navy-500">Prórroga:</span> <strong>{diasProrroga} días</strong></p>
                <p><span className="text-surface-500 dark:text-navy-500">Motivo:</span> {motivoProrroga}</p>
              </>
            )}
          </div>

          {successData.docsFaltantes?.length > 0 && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm">
              <p className="font-semibold text-amber-700 dark:text-amber-300 mb-1">Documentos faltantes:</p>
              <ul className="list-disc list-inside text-amber-600 dark:text-amber-400 space-y-0.5">
                {successData.docsFaltantes.map((n: string, i: number) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-center mb-2">
            <div className="bg-white p-3 rounded-xl shadow-sm">
              {qrUrl ? <QRCodeCanvas value={qrUrl} size={120} /> : <div className="w-[120px] h-[120px] flex items-center justify-center text-surface-400"><Loader2 size={24} className="animate-spin" /></div>}
            </div>
          </div>

          {qrUrl && (
            <p className="text-[10px] text-surface-400 dark:text-navy-500 text-center mb-3 break-all px-2">
              {qrUrl}
            </p>
          )}

          {!qrUrl && (
            <p className="text-xs text-amber-600 text-center mb-3">Detectando IP local...</p>
          )}

          {previewUrl ? (
            <div className="mb-4 relative">
              <button onClick={() => { setPreviewUrl(null); setUploadMsg(""); }} className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors" title="Descartar foto">
                <X size={16} />
              </button>
              <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                <img src={previewUrl} alt="Foto de firma" className="w-full rounded-xl border border-surface-300 dark:border-navy-600" />
              </a>
              {uploadMsg && (
                <p className={`text-xs mt-2 text-center ${uploadMsg.includes("exitosa") ? "text-green-600" : "text-red-500"}`}>
                  {uploadMsg}
                </p>
              )}
            </div>
          ) : (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="mb-4 px-4 py-6 rounded-xl border-2 border-dashed border-surface-300 dark:border-navy-600 bg-surface-50 dark:bg-navy-800/50 text-center cursor-pointer hover:bg-surface-100 dark:hover:bg-navy-800/80 transition-colors"
            >
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
              <Camera size={24} className="mx-auto text-surface-400 dark:text-navy-500 mb-2" />
              <p className="text-sm text-surface-600 dark:text-navy-400">
                {uploading ? "Subiendo..." : "Arrastra la foto aquí o haz clic para seleccionar"}
              </p>
              <p className="text-xs text-surface-400 dark:text-navy-500 mt-1">
                Escanea el QR con tu celular o sube la foto del documento firmado
              </p>
              {uploadMsg && (
                <p className={`text-xs mt-2 ${uploadMsg.includes("exitosa") ? "text-green-600" : "text-red-500"}`}>{uploadMsg}</p>
              )}
            </div>
          )}

          <div className="flex justify-center gap-3 pt-4 border-t border-white/20 dark:border-navy-700/30">
            <button onClick={handleClose} className="px-5 py-2.5 rounded-xl text-surface-600 dark:text-navy-400 bg-white/60 dark:bg-navy-800/60 border border-white/80 dark:border-navy-700/60 hover:bg-white dark:hover:bg-navy-800 transition-colors text-sm font-medium">
              Cerrar
            </button>
            <button
              onClick={() => {
                if (currentItems.length === 1) {
                  const docs = foldersWithDocs.find((f) => f.pcId === item.pcId)?.documentos ?? [];
                  const checked = checkedDocsByPcId.get(item.pcId) ?? new Set();
                  generarComprobanteDevolucion({
                    carpetaDesc: item.carpetaDesc,
                    personaNombre: item.personaNombre,
                    formatDate,
                    usuarioNombre: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
                    fechaPrest: item.fechaPrest,
                    fechaDevolucion: item.fechaDevolucion,
                    faltantes: successData.docsFaltantes ?? [],
                    diasProrroga: successData.prorrogaCreada ? diasProrroga : undefined,
                    motivoProrroga: successData.prorrogaCreada ? motivoProrroga : undefined,
                    documentos: docs,
                    checkedDocs: [...checked],
                    docIdsPrestadoIndividual: new Set(docs.filter((d) => d.isPrestadoIndividual).map((d) => d.id)),
                    docIdsYaDevueltos: new Set(),
                  });
                } else {
                  generarComprobanteDevolucionMultiple({
                    personaNombre: currentItems[0].personaNombre,
                    usuarioNombre: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
                    formatDate,
                    items: currentItems.map((i) => ({
                      carpetaDesc: i.carpetaDesc,
                      fechaPrest: i.fechaPrest,
                      fechaDevolucion: i.fechaDevolucion,
                      estado: "buen_estado",
                    })),
                    observaciones: undefined,
                  });
                }
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-medium shadow-md bg-gradient-to-r from-brand-600 to-blue-600 hover:from-red-800 hover:to-blue-800 transition-all text-sm"
            >
              <Printer size={16} />
              Imprimir comprobante
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── WARNING STEP ───
  if (showWarning) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 dark:bg-black/70 backdrop-blur-sm p-4">
        <div className="glass-panel rounded-2xl w-full max-w-lg p-6">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 mx-auto mb-3">
            <AlertTriangle size={24} className="text-amber-600" />
          </div>
          <h3 className="text-lg font-bold text-surface-800 dark:text-navy-200 text-center mb-2">
            Carpetas sin documentos marcados
          </h3>
          <p className="text-sm text-surface-600 dark:text-navy-400 text-center mb-4">
            Las siguientes carpetas no tienen ningún documento marcado como presente:
          </p>
          <div className="space-y-2 mb-4">
            {foldersSinDocs.map((f) => (
              <div key={f.pcId} className="px-4 py-3 rounded-xl bg-amber-50/60 dark:bg-amber-900/15 border border-amber-200/50">
                <p className="text-sm font-semibold text-surface-800 dark:text-navy-200">{f.carpetaDesc}</p>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-3 pt-4 border-t border-white/20 dark:border-navy-700/30">
            <button onClick={() => setShowWarning(false)} className="px-5 py-2.5 rounded-xl text-surface-600 dark:text-navy-400 bg-white/60 dark:bg-navy-800/60 border border-white/80 dark:border-navy-700/60 hover:bg-white dark:hover:bg-navy-800 transition-colors text-sm font-medium">
              Volver
            </button>
            <button onClick={() => {
              setShowWarning(false);
              if (hasMissingDocs) {
                openProrroga();
              } else {
                setStep("processing");
                submitAll();
              }
            }} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-medium shadow-md bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 transition-all text-sm">
              Continuar de todas maneras
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── CHECKLIST STEP ───
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 dark:bg-black/70 backdrop-blur-sm p-4 pt-8">
      <div className="glass-panel rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-surface-800 dark:text-navy-200 flex items-center gap-2">
              <Undo2 size={20} className="text-brand-600" />
              {isSingle ? "Devolver Carpeta" : `Devolver ${currentItems.length} carpetas`}
            </h3>
            {currentItems.length > 0 && (
              <p className="text-xs text-surface-600 dark:text-navy-500 mt-0.5">
                {currentItems[0].personaNombre} &middot; {selectedCount}/{totalDocs} documentos presentes
              </p>
            )}
          </div>
          <button onClick={handleClose} className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
            <X size={20} />
          </button>
        </div>

        {currentItems.length === 0 ? (
          <div className="flex flex-col items-center py-12">
            <p className="text-surface-500 dark:text-navy-400 text-lg font-semibold mb-2">No hay carpetas para devolver</p>
            <button onClick={handleClose} className="px-5 py-2 rounded-xl text-surface-600 dark:text-navy-400 bg-white/60 dark:bg-navy-800/60 border border-white/80 dark:border-navy-700/60 hover:bg-white dark:hover:bg-navy-800 transition-colors text-sm font-medium mt-2">
              Cerrar
            </button>
          </div>
        ) : loadingDocs ? (
          <div className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin text-brand-600" />
          </div>
        ) : (
          <div className="space-y-3 pr-1 mb-4">
            {paginatedFolders.map((folder) => {
              const docs = folder.documentos;
              const checked = checkedDocsByPcId.get(folder.pcId) ?? new Set();
              const editable = docs.filter((d) => !d.isPrestadoIndividual);
              const checkedCount = editable.filter((d) => checked.has(d.id)).length;
              const expanded = expandedFolders.has(folder.pcId);

              return (
                <div key={folder.pcId} className="rounded-xl border border-white/30 dark:border-navy-700/30 overflow-hidden">
                  <div
                    className="px-4 py-3 flex items-center gap-3 bg-surface-50 dark:bg-navy-800 cursor-pointer"
                    onClick={() => toggleFolder(folder.pcId)}
                  >
                    <label className="flex items-center cursor-pointer shrink-0" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={editable.length > 0 && editable.every((d) => checked.has(d.id))}
                        ref={(el) => {
                          if (el) el.indeterminate = !editable.every((d) => checked.has(d.id)) && editable.some((d) => checked.has(d.id));
                        }}
                        onChange={() => toggleAllDocs(folder.pcId)}
                        className="w-4 h-4 rounded border-surface-300 text-brand-600 focus:ring-brand-400"
                      />
                    </label>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-surface-800 dark:text-navy-200 text-sm">{folder.carpetaDesc}</p>
                      <p className="text-xs text-surface-500 dark:text-navy-500 mt-0.5">
                        Préstamo: {formatDate(folder.fechaPrest)} &middot; Límite: {formatDate(folder.fechaDevolucion)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className="text-xs text-surface-600 dark:text-navy-400">
                        {checkedCount}/{editable.length}
                      </span>
                      <button onClick={(e) => { e.stopPropagation(); handleRemoveItem(folder.pcId); }} className="p-1 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors" title="Quitar">
                        <X size={14} />
                      </button>
                      {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>

                  {expanded && (
                    <div className="divide-y divide-white/10 dark:divide-navy-700/20">
                      {docs.length === 0 ? (
                        <p className="px-4 py-3 text-sm text-surface-500 dark:text-navy-500 text-center">
                          Sin documentos registrados
                        </p>
                      ) : docs.map((doc) => {
                        const isPrestadoIndiv = doc.isPrestadoIndividual;
                        const isChecked = checked.has(doc.id);
                        let rowClass = "flex items-center gap-3 px-4 py-2.5 transition-all text-sm";
                        if (isPrestadoIndiv) {
                          rowClass += " bg-gray-100/60 dark:bg-navy-800/50 opacity-50";
                        } else if (isChecked) {
                          rowClass += " bg-green-50/80 dark:bg-green-900/20";
                        } else {
                          rowClass += " bg-red-50/60 dark:bg-red-900/15";
                        }

                        return (
                          <label key={doc.id} className={rowClass}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isPrestadoIndiv}
                              onChange={() => handleToggleDoc(folder.pcId, doc.id)}
                              className="w-4 h-4 rounded border-surface-300 text-brand-600 dark:text-brand-dark-400 focus:ring-brand-400"
                            />
                            <div className="flex-1 min-w-0">
                              <p className={`font-medium truncate ${
                                isPrestadoIndiv
                                  ? "text-surface-400 dark:text-navy-500"
                                  : isChecked
                                    ? "text-surface-800 dark:text-navy-200"
                                    : "text-red-700 dark:text-red-300"
                              }`}>
                                {doc.tipoDoc || doc.titulo}
                              </p>
                              {isPrestadoIndiv && (
                                <p className="text-xs text-amber-500 italic">Ya prestado individualmente</p>
                              )}
                            </div>
                            {isPrestadoIndiv ? (
                              <span className="text-xs text-amber-500 shrink-0">No disponible</span>
                            ) : isChecked ? (
                              <CheckCircle2 size={16} className="shrink-0 text-green-500" />
                            ) : (
                              <AlertTriangle size={16} className="shrink-0 text-red-500" />
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {foldersWithDocs.length > itemsPerPage && (
          <div className="flex items-center justify-center gap-3 mb-4">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="px-4 py-1.5 rounded-xl text-sm font-medium text-surface-600 dark:text-navy-400 bg-white/60 dark:bg-navy-800/60 border border-white/80 dark:border-navy-700/60 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white dark:hover:bg-navy-800 transition-colors"
            >
              Anterior
            </button>
            <span className="text-sm text-surface-500 dark:text-navy-500">
              Página {safePage + 1} de {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              className="px-4 py-1.5 rounded-xl text-sm font-medium text-surface-600 dark:text-navy-400 bg-white/60 dark:bg-navy-800/60 border border-white/80 dark:border-navy-700/60 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white dark:hover:bg-navy-800 transition-colors"
            >
              Siguiente
            </button>
          </div>
        )}

        {errorsList.length > 0 && (
          <div className="mb-4 px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-sm">
            <p className="font-semibold text-red-700 dark:text-red-300 mb-1">Errores:</p>
            <ul className="list-disc list-inside text-red-600 dark:text-red-400">
              {errorsList.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}

        {msg && (
          <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm font-medium ${
            msg.startsWith("✅") ? "bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300" :
            msg.startsWith("⚠️") ? "bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300" :
            "bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
          }`}>{msg}</div>
        )}

        {!loadingDocs && hasMissingDocs && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-semibold text-sm mb-1">
              <AlertTriangle size={16} />
              {[...faltantesByFolder.values()].flat().length} documento(s) faltante(s)
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Se generará una prórroga para que la persona devuelva los documentos faltantes.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-white/20 dark:border-navy-700/30">
          <button onClick={handleClose} className="px-5 py-2.5 rounded-xl text-surface-600 dark:text-navy-400 bg-white/60 dark:bg-navy-800/60 border border-white/80 dark:border-navy-700/60 hover:bg-white dark:hover:bg-navy-800 transition-colors text-sm font-medium">
            Cancelar
          </button>
          <button
            onClick={handleSubmitChecklist}
            disabled={saving || loadingDocs}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm ${
              hasMissingDocs
                ? "bg-gradient-to-r from-amber-600 to-amber-500 dark:from-amber-500 dark:to-amber-600"
                : "bg-gradient-to-r from-green-600 to-green-500 dark:from-green-500 dark:to-green-600"
            }`}
          >
            <Undo2 size={16} />
            {saving ? "Devolviendo..." : hasMissingDocs ? "Devolver con prórroga" : "Confirmar Devolución"}
          </button>
        </div>
      </div>
    </div>
  );
}
