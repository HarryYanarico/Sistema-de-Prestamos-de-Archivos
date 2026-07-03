import { useState, useEffect, useMemo, useRef } from "react";
import { useLazyQuery, useQuery } from "@apollo/client/react";
import {
  X,
  Search,
  UserPlus,
  AlertTriangle,
  CheckCircle2,
  Circle,
  FileText,
  Camera,
  Loader2,
} from "lucide-react";
import { formatDate } from "../../utils/formatDate";
import {
  GET_ALL_DOCUMENTOS,
  GET_PERSONA_PRESTAMOS_DOC_PENDIENTES,
} from "../../lib/queries";
import { useAuth } from "../../context/AuthContext";
import PrestamosPendientesModal from "./PrestamosPendientesModal";
import { QRCodeCanvas } from "qrcode.react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Persona {
  id: string;
  ci: string;
  nombre: string;
  apellido: string;
  cargo?: string;
  telefono?: string;
  email?: string;
}

interface Documento {
  id: string;
  codigoDoc?: string;
  titulo?: string;
  tipoDoc?: string;
  fechaIngre?: string;
  carpeta?: { id: string; descripcion?: string };
}

interface DocPendienteItem {
  prestamoDocItemId: string;
  documentoDescripcion: string;
  fechaPrest: string;
  fechaDevolucion: string;
  diasRetraso: number;
}

interface DocPendientesData {
  totalPendientes: number;
  items: DocPendienteItem[];
}

interface Props {
  show: boolean;
  onClose: () => void;
  personas: Persona[];
  ultimasPersonas: Persona[];
  personasConCargo: Persona[];
  onRegistrar: (vars: {
    idsDocumentos: string[];
    idPersona: string;
    fechaDevolucion: string;
    idAutorizadoPor?: string;
    observaciones?: string;
  }) => Promise<{ error?: string; tokenFirma?: string }>;
  hasPerm: (p: string) => boolean;
  onBloquear?: (personaId: string, motivo: string) => Promise<string>;
}

export default function RegistrarPrestamoDocModal({
  show,
  onClose,
  personas,
  ultimasPersonas,
  personasConCargo,
  onRegistrar,
  hasPerm,
  onBloquear,
}: Props) {
  const [step, setStep] = useState(1);
  const [idPersona, setIdPersona] = useState("");
  const [idAutorizadoPor, setIdAutorizadoPor] = useState("");
  const [selectedDocs, setSelectedDocs] = useState<Documento[]>([]);
  const [fechaDevolucion, setFechaDevolucion] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState("");
  const [searchPersona, setSearchPersona] = useState("");
  const [personaQuery, setPersonaQuery] = useState("");
  const [searchAutoriza, setSearchAutoriza] = useState("");
  const [searchDoc, setSearchDoc] = useState("");
  const [docQuery, setDocQuery] = useState("");

  const [showSuccess, setShowSuccess] = useState(false);
  const [showPendientes, setShowPendientes] = useState(false);
  const [dismissedForPersona, setDismissedForPersona] = useState<string | null>(null);

  const [tokenFirma, setTokenFirma] = useState('');
  const [qrBaseUrl, setQrBaseUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [polling, setPolling] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fetchDocPendientes, { data: docPendientesData }] = useLazyQuery<{
    personaPrestamosDocPendientes: DocPendientesData;
  }>(GET_PERSONA_PRESTAMOS_DOC_PENDIENTES, {
    fetchPolicy: "network-only",
  });
  const { data: docsData, loading: loadingDocs } = useQuery<{
    allDocumentos: Documento[];
  }>(GET_ALL_DOCUMENTOS, {
    variables: { search: docQuery || undefined },
    fetchPolicy: "network-only",
  });

  const { user } = useAuth();

  useEffect(() => {
    if (idPersona) {
      fetchDocPendientes({ variables: { personaId: idPersona } });
    }
  }, [idPersona, fetchDocPendientes]);

  useEffect(() => {
    if (showSuccess && tokenFirma) {
      setPolling(true);
      const envUrl = (import.meta.env.VITE_QR_BASE_URL as string || '').replace(/\/+$/, '');
      setQrBaseUrl(envUrl);
    } else {
      setPolling(false);
    }
  }, [showSuccess, tokenFirma]);

  useEffect(() => {
    if (!polling || !tokenFirma) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/upload-firma/${tokenFirma}/`);
        const json = await res.json();
        if (json.success && json.url) {
          setPreviewUrl(json.url);
          setUploadMsg('Foto recibida desde el celular');
          setPolling(false);
        }
      } catch {
        // silent retry
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [polling, tokenFirma]);

  const personaSel = personas.find((p) => p.id === idPersona);
  const docPendientes = docPendientesData?.personaPrestamosDocPendientes;

  const overdueItems = useMemo<DocPendienteItem[]>(() => {
    if (!docPendientes || docPendientes.totalPendientes === 0) return [];
    return docPendientes.items.filter((i) => i.diasRetraso > 0);
  }, [docPendientes]);

  const showOverdueBlock =
    !!idPersona && overdueItems.length > 0 && dismissedForPersona !== idPersona;
  const showPendientesWarning =
    !!idPersona &&
    !!docPendientes &&
    docPendientes.totalPendientes > 0 &&
    overdueItems.length === 0 &&
    dismissedForPersona !== idPersona;

  if (!show) return null;

  const documentos = docsData?.allDocumentos ?? [];
  const docSearchResults = docQuery
    ? documentos.filter(
        (d: Documento) => !selectedDocs.some((s: Documento) => s.id === d.id),
      )
    : [];

  const recentDocs =
    !docQuery && documentos.length > 0
      ? (() => {
          const seenFolders = new Set<string>();
          return [...documentos]
            .sort((a: Documento, b: Documento) =>
              (b.fechaIngre || "").localeCompare(a.fechaIngre || ""),
            )
            .filter((d: Documento) => {
              if (!d.carpeta?.id || seenFolders.has(d.carpeta.id)) return false;
              seenFolders.add(d.carpeta.id);
              return true;
            })
            .slice(0, 5);
        })()
      : [];

  const handleSubmit = async () => {
    setError("");
    if (!idPersona) {
      setError("Selecciona una persona");
      return;
    }
    if (!idAutorizadoPor) {
      setError("Selecciona quién autoriza el préstamo");
      return;
    }
    if (selectedDocs.length === 0) {
      setError("Selecciona al menos un documento");
      return;
    }
    if (!fechaDevolucion) {
      setError("Ingresa la fecha de devolución");
      return;
    }
    const res = await onRegistrar({
      idsDocumentos: selectedDocs.map((d: Documento) => d.id),
      idPersona,
      fechaDevolucion,
      idAutorizadoPor,
      observaciones: observaciones || undefined,
    });
    if (res?.error) setError(res.error);
    else {
      if (res?.tokenFirma) setTokenFirma(res.tokenFirma);
      setShowSuccess(true);
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const personaSel = personas.find((p) => p.id === idPersona);
    const autorizaSel = personasConCargo.find((p) => p.id === idAutorizadoPor);
    const documentos = selectedDocs;

    let y = 20;
    doc.setFontSize(18);
    doc.text("Comprobante de Pr\u00E9stamo de Documentos", 14, y);
    y += 12;

    doc.setFontSize(10);
    doc.text(
      `Fecha: ${new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}`,
      14,
      y,
    );
    y += 6;
    doc.text(`Registrado por: ${user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username : "-"}`, 14, y);
    y += 10;

    doc.setFontSize(11);
    doc.text("Datos del Pr\u00E9stamo", 14, y);
    y += 7;
    doc.setFontSize(10);
    doc.text(`Se prest\u00F3 a: ${personaSel?.nombre || ""} ${personaSel?.apellido || ""} (CI: ${personaSel?.ci || "-"})`, 14, y);
    y += 6;
    if (autorizaSel) {
      doc.text(`Autorizado por: ${autorizaSel.nombre} ${autorizaSel.apellido} (${autorizaSel.cargo || "Sin cargo"})`, 14, y);
      y += 6;
    }
    doc.text(
      `Fecha de devoluci\u00F3n: ${new Date(fechaDevolucion).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}`,
      14,
      y,
    );
    y += 6;
    if (observaciones) {
      doc.text(`Observaciones: ${observaciones}`, 14, y);
      y += 6;
    }

    y += 4;

    const body: string[][] = documentos.map((d: Documento) => [
      d.codigoDoc || "",
      d.tipoDoc || "-",
      d.carpeta?.descripcion || "-",
    ]);

    autoTable(doc, {
      head: [["C\u00F3digo", "Documento", "Carpeta"]],
      body,
      startY: y,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [79, 70, 229] },
    });

    y = (doc as any).lastAutoTable.finalY + 15;
    y += 4;
    const lw = 65;
    doc.line(62.5 - lw / 2, y, 62.5 + lw / 2, y);
    doc.line(147.5 - lw / 2, y, 147.5 + lw / 2, y);
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const firmaNombre = personaSel ? `${personaSel.nombre} ${personaSel.apellido}` : "";
    const usuarioNombre = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : "";
    doc.text(firmaNombre, 62.5, y, { align: 'center' });
    doc.text(usuarioNombre, 147.5, y, { align: 'center' });

    const pdfBlob = doc.output("blob");
    const url = URL.createObjectURL(pdfBlob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  const handleUploadPhoto = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setUploadMsg('Solo se permiten imágenes');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setUploading(true);
    setUploadMsg('');
    try {
      const formData = new FormData();
      formData.append('foto', file);
      const res = await fetch(`/api/upload-firma/${tokenFirma}/`, {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      if (json.url) setPreviewUrl(json.url);
      setUploadMsg('Foto subida exitosamente');
    } catch (err: unknown) {
      setUploadMsg(err instanceof Error ? err.message : 'Error al subir foto');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleUploadPhoto(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUploadPhoto(file);
  };

  const reset = () => {
    setStep(1);
    setIdPersona("");
    setIdAutorizadoPor("");
    setSelectedDocs([]);
    setFechaDevolucion("");
    setObservaciones("");
    setError("");
    setSearchPersona("");
    setPersonaQuery("");
    setSearchAutoriza("");
    setSearchDoc("");
    setDocQuery("");
    setShowSuccess(false);
    setDismissedForPersona(null);
    setTokenFirma("");
    setQrBaseUrl("");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setUploadMsg("");
    onClose();
  };

  const toggleDoc = (doc: Documento) => {
    setSelectedDocs((prev) =>
      prev.some((d) => d.id === doc.id)
        ? prev.filter((d) => d.id !== doc.id)
        : [...prev, doc],
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4">
      <div className="glass-panel !bg-white/95 dark:!bg-navy-900/95 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-surface-800 dark:text-navy-200">
            Registrar Préstamo de Documentos
          </h3>
          <button
            onClick={reset}
            className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <button
              key={s}
              onClick={() => setStep(s)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                step === s
                  ? "bg-brand-600 dark:bg-brand-dark-500 text-white shadow-md"
                  : s < step
                    ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                    : "bg-surface-100 dark:bg-navy-800 text-surface-500 dark:text-navy-500"
              }`}>
              {s === 1
                ? "1. Persona"
                : s === 2
                  ? "2. Documentos"
                  : "3. Confirmar"}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm rounded-xl px-4 py-2.5">
            {error}
          </div>
        )}

        {step === 1 && (
          <div>
            <h4 className="text-sm font-semibold text-surface-700 dark:text-navy-300 mb-3">
              Seleccionar persona que recibe el préstamo
            </h4>
            <div className="relative mb-4">
              <Search
                className="absolute border-black border left-3 top-1/2 -translate-y-1/2 text-surface-500 dark:text-navy-500"
                size={16}
              />
              <input
                type="text"
                placeholder="Buscar por CI, nombre o apellido..."
                value={searchPersona}
                onChange={(e) => setSearchPersona(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setPersonaQuery(searchPersona.trim());
                }}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border-gray-700 bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 placeholder:text-surface-600 dark:placeholder:text-navy-500 focus:outline-none focus:ring-2 focus:ring-brand-400/50 dark:focus:ring-brand-dark-500/50 transition-all text-sm"
              />
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
              {(personaQuery
                ? personas.filter((p) => {
                    const q = personaQuery.toLowerCase();
                    return (
                      p.ci.toLowerCase().includes(q) ||
                      p.nombre.toLowerCase().includes(q) ||
                      p.apellido.toLowerCase().includes(q)
                    );
                  })
                : ultimasPersonas
              ).map((p) => (
                <button
                  key={p.id}
                  onClick={() => setIdPersona(p.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all text-sm flex items-center gap-3 ${
                    idPersona === p.id
                      ? "bg-brand-50 dark:bg-brand-dark-600/20 border border-brand-200 dark:border-brand-dark-600/30 text-brand-700 dark:text-brand-dark-400"
                      : "bg-white/40 dark:bg-navy-800/40 border border-transparent hover:bg-white/60 dark:hover:bg-navy-800/60 text-surface-700 dark:text-navy-300"
                  }`}>
                  {idPersona === p.id ? (
                    <CheckCircle2
                      size={18}
                      className="text-brand-600 dark:text-brand-dark-400 shrink-0"
                    />
                  ) : (
                    <Circle
                      size={18}
                      className="text-surface-400 shrink-0"
                    />
                  )}
                  <span className="font-semibold">
                    {p.nombre} {p.apellido}
                  </span>
                  <span className="ml-auto text-surface-500 dark:text-navy-500">
                    CI: {p.ci}
                  </span>
                </button>
              ))}
              {!personaQuery &&
                ultimasPersonas.length === 0 &&
                personas.length > 0 && (
                  <p className="text-sm text-surface-500 dark:text-navy-500 text-center py-4">
                    No hay personas recientes
                  </p>
                )}
              {personas.length === 0 && (
                <p className="text-sm text-surface-500 dark:text-navy-500 text-center py-4">
                  No hay personas registradas
                </p>
              )}
            </div>
            {hasPerm("gestionar_personas") && (
              <button
                onClick={() => {}}
                className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-brand-300 text-brand-600 dark:text-brand-dark-400 hover:bg-brand-50 dark:hover:bg-brand-dark-600/20 transition-all text-sm font-medium">
                <UserPlus size={16} /> Registrar nueva persona
              </button>
            )}

            <div className="mt-6 border-t border-white/20 dark:border-navy-700/30 pt-4">
              <h4 className="text-sm font-semibold text-surface-700 dark:text-navy-300 mb-3">
                Autorizado por (persona con cargo)
              </h4>
              <div className="relative mb-4">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500 dark:text-navy-500"
                  size={16}
                />
                <input
                  type="text"
                  placeholder="Buscar personas con cargo..."
                  value={searchAutoriza}
                  onChange={(e) => setSearchAutoriza(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 placeholder:text-surface-600 dark:placeholder:text-navy-500 focus:outline-none focus:ring-2 focus:ring-brand-400/50 dark:focus:ring-brand-dark-500/50 transition-all text-sm"
                />
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                {personasConCargo
                  .filter((p) => {
                    const q = searchAutoriza.toLowerCase();
                    return (
                      p.nombre.toLowerCase().includes(q) ||
                      p.apellido.toLowerCase().includes(q) ||
                      (p.cargo || "").toLowerCase().includes(q)
                    );
                  })
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setIdAutorizadoPor(p.id)}
                      className={`w-full text-left px-4 py-2.5 rounded-xl transition-all text-sm flex items-center gap-3 ${
                        idAutorizadoPor === p.id
                          ? "bg-brand-50 dark:bg-brand-dark-600/20 border border-brand-200 dark:border-brand-dark-600/30 text-brand-700 dark:text-brand-dark-400"
                          : "bg-white/40 dark:bg-navy-800/40 border border-transparent hover:bg-white/60 dark:hover:bg-navy-800/60 text-surface-700 dark:text-navy-300"
                      }`}>
                      {idAutorizadoPor === p.id ? (
                        <CheckCircle2
                          size={18}
                          className="text-brand-600 dark:text-brand-dark-400 shrink-0"
                        />
                      ) : (
                        <Circle
                          size={18}
                          className="text-surface-400 shrink-0"
                        />
                      )}
                      <span className="font-semibold">
                        {p.nombre} {p.apellido}
                      </span>
                      <span className="ml-auto px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        {p.cargo}
                      </span>
                    </button>
                  ))}
                {personasConCargo.length === 0 && (
                  <p className="text-sm text-surface-500 dark:text-navy-500 text-center py-4">
                    No hay personas con cargo registradas
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setStep(2)}
                disabled={!idPersona || !idAutorizadoPor}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 dark:from-brand-dark-500 dark:to-blue-500 text-white font-medium shadow-md text-sm disabled:opacity-50">
                Siguiente
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h4 className="text-sm font-semibold text-surface-700 dark:text-navy-300 mb-3">
              Seleccionar documentos a prestar
            </h4>
            <div className="relative mb-2">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500 dark:text-navy-500"
                size={16}
              />
              <input
                type="text"
                placeholder="Buscar documento por código o título..."
                value={searchDoc}
                onChange={(e) => setSearchDoc(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setDocQuery(searchDoc.trim());
                }}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 placeholder:text-surface-600 dark:placeholder:text-navy-500 focus:outline-none focus:ring-2 focus:ring-brand-400/50 dark:focus:ring-brand-dark-500/50 transition-all text-sm"
              />
            </div>
            <div className="mb-2 text-xs text-surface-600 dark:text-navy-500">
              {selectedDocs.length} seleccionado(s)
            </div>
            <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
              {docQuery ? (
                loadingDocs ? (
                  <p className="text-sm text-surface-500 dark:text-navy-500 text-center py-4">
                    Buscando...
                  </p>
                ) : docSearchResults.length === 0 ? (
                  <p className="text-sm text-surface-500 dark:text-navy-500 text-center py-4">
                    Sin resultados
                  </p>
                ) : (
                  docSearchResults.map((d: Documento) => (
                    <label
                      key={d.id}
                      className="flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-sm cursor-pointer bg-white/40 dark:bg-navy-800/40 border border-transparent hover:bg-white/60 dark:hover:bg-navy-800/60">
                      <input
                        type="checkbox"
                        checked={selectedDocs.some((s: Documento) => s.id === d.id)}
                        onChange={() => toggleDoc(d)}
                        className="rounded border-surface-300 text-brand-600 focus:ring-brand-400 dark:focus:ring-brand-dark-500"
                      />
                      <div className="flex-1">
                        <span className="font-semibold text-surface-800 dark:text-navy-200">
                          {d.codigoDoc || d.tipoDoc}
                        </span>
                        {d.codigoDoc && (
                          <span className="text-surface-700 dark:text-navy-300 ml-1">
                            — {d.tipoDoc}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-surface-500 dark:text-navy-500">
                        {d.carpeta?.descripcion || "-"}
                      </span>
                    </label>
                  ))
                )
              ) : recentDocs.length > 0 ? (
                <>
                  <p className="text-xs text-surface-500 dark:text-navy-500 mb-2 px-1">
                    Documentos recientes
                  </p>
                  {recentDocs.map((d: Documento) => (
                    <label
                      key={d.id}
                      className="flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-sm cursor-pointer bg-white/40 dark:bg-navy-800/40 border border-transparent hover:bg-white/60 dark:hover:bg-navy-800/60">
                      <input
                        type="checkbox"
                        checked={selectedDocs.some((s: Documento) => s.id === d.id)}
                        onChange={() => toggleDoc(d)}
                        className="rounded border-surface-300 text-brand-600 focus:ring-brand-400 dark:focus:ring-brand-dark-500"
                      />
                      <div className="flex-1">
                        <span className="font-semibold text-surface-800 dark:text-navy-200">
                          {d.codigoDoc || d.tipoDoc}
                        </span>
                        {d.codigoDoc && (
                          <span className="text-surface-700 dark:text-navy-300 ml-1">
                            — {d.tipoDoc}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-surface-500 dark:text-navy-500">
                        {d.carpeta?.descripcion || "-"}
                      </span>
                    </label>
                  ))}
                </>
              ) : documentos.length > 0 ? null : (
                <p className="text-sm text-surface-500 dark:text-navy-500 text-center py-8">
                  No hay documentos disponibles
                </p>
              )}
            </div>
            {selectedDocs.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                  {selectedDocs.map((d: Documento) => (
                  <span
                    key={d.id}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-brand-100 dark:bg-brand-dark-600/20 text-brand-700 dark:text-brand-dark-400">
                    {d.codigoDoc || d.tipoDoc}
                    <button
                      onClick={() => toggleDoc(d)}
                      className="hover:text-red-500">
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex justify-between mt-6">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-2.5 rounded-xl text-surface-600 dark:text-navy-400 bg-white/60 dark:bg-navy-800/60 border border-white/80 dark:border-navy-700/60 hover:bg-white dark:hover:bg-navy-800 transition-colors text-sm font-medium">
                Atrás
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={selectedDocs.length === 0}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 dark:from-brand-dark-500 dark:to-blue-500 text-white font-medium shadow-md text-sm disabled:opacity-50">
                Siguiente
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h4 className="text-sm font-semibold text-surface-700 dark:text-navy-300 mb-4">
              Confirmar préstamo
            </h4>
            <div className="space-y-3 mb-6">
              <div className="glass-card rounded-xl p-4">
                <p className="text-xs text-surface-600 dark:text-navy-500 mb-1">
                  Persona
                </p>
                <p className="font-semibold text-surface-800 dark:text-navy-200">
                  {personas.find((p) => p.id === idPersona)?.nombre}{" "}
                  {personas.find((p) => p.id === idPersona)?.apellido}
                  <span className="text-surface-500 dark:text-navy-500 font-normal ml-2">
                    CI: {personas.find((p) => p.id === idPersona)?.ci}
                  </span>
                </p>
              </div>
              {idAutorizadoPor && (
                <div className="glass-card rounded-xl p-4">
                  <p className="text-xs text-surface-600 dark:text-navy-500 mb-1">
                    Autorizado por
                  </p>
                  <p className="font-semibold text-surface-800 dark:text-navy-200">
                    {
                      personasConCargo.find((p) => p.id === idAutorizadoPor)
                        ?.nombre
                    }{" "}
                    {
                      personasConCargo.find((p) => p.id === idAutorizadoPor)
                        ?.apellido
                    }
                    <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      {
                        personasConCargo.find((p) => p.id === idAutorizadoPor)
                          ?.cargo
                      }
                    </span>
                  </p>
                </div>
              )}
              <div className="glass-card rounded-xl p-4">
                <p className="text-xs text-surface-600 dark:text-navy-500 mb-1">
                  Documentos ({selectedDocs.length})
                </p>
                <div className="space-y-1 mt-1 max-h-40 overflow-y-auto">
                {selectedDocs.map((d: Documento) => (
                    <div
                      key={d.id}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-50 dark:bg-navy-800/50 text-sm">
                      <FileText
                        size={14}
                        className="shrink-0 text-surface-400"
                      />
                      <span className="font-mono text-xs text-surface-500 dark:text-navy-400">
                        {d.codigoDoc}
                      </span>
                      <span className="text-surface-800 dark:text-navy-200">
                        {d.tipoDoc}
                      </span>
                      <span className="text-xs text-surface-400 dark:text-navy-500">
                        ({d.carpeta?.descripcion || "Sin carpeta"})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="glass-card rounded-xl p-4">
                <label className="block text-xs text-surface-600 dark:text-navy-500 mb-1">
                  Fecha de devolución
                </label>
                <input
                  type="date"
                  value={fechaDevolucion}
                  onChange={(e) => setFechaDevolucion(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400/50 dark:focus:ring-brand-dark-500/50 transition-all"
                />
              </div>
              <div className="glass-card rounded-xl p-4">
                <label className="block text-xs text-surface-600 dark:text-navy-500 mb-1">
                  Observaciones
                </label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  rows={2}
                  placeholder="Opcional..."
                  className="w-full px-4 py-2 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400/50 dark:focus:ring-brand-dark-500/50 transition-all resize-none"
                />
              </div>
            </div>
            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-2.5 rounded-xl text-surface-600 dark:text-navy-400 bg-white/60 dark:bg-navy-800/60 border border-white/80 dark:border-navy-700/60 hover:bg-white dark:hover:bg-navy-800 transition-colors text-sm font-medium">
                Atrás
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handleSubmit}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 dark:from-brand-dark-500 dark:to-blue-500 text-white font-medium shadow-md shadow-brand-500/30 dark:shadow-brand-dark-600/20 hover:shadow-lg transition-all text-sm">
                  Confirmar Préstamo
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showPendientes && personaSel && docPendientes && (
        <PrestamosPendientesModal
          persona={{
            id: personaSel.id,
            nombre: personaSel.nombre,
            apellido: personaSel.apellido,
            ci: personaSel.ci,
            telefono: personaSel.telefono,
            email: personaSel.email,
          }}
          items={docPendientes.items.map((i: DocPendienteItem) => ({
            descripcion: i.documentoDescripcion,
            fechaPrest: i.fechaPrest,
            fechaDevolucion: i.fechaDevolucion,
            diasRetraso: i.diasRetraso,
          }))}
          type="documentos"
          onClose={() => setShowPendientes(false)}
          onBloquear={onBloquear}
        />
      )}

      {showPendientesWarning && docPendientes && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4">
          <div className="glass-panel !bg-white/95 dark:!bg-navy-900/95 rounded-2xl w-full max-w-md p-6 text-center">
            <AlertTriangle
              size={48}
              className="mx-auto mb-4 text-amber-500"
            />
            <h3 className="text-lg font-bold text-surface-800 dark:text-navy-200 mb-2">
              Préstamos pendientes
            </h3>
            <p className="text-sm text-surface-600 dark:text-navy-400 mb-6">
              Esta persona tiene{" "}
              <strong>{docPendientes.totalPendientes}</strong>{" "}
              {docPendientes.totalPendientes === 1
                ? "préstamo pendiente"
                : "préstamos pendientes"}{" "}
              que aún no ha devuelto. ¿Deseas continuar de todos modos?
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setIdPersona("")}
                className="px-5 py-2.5 rounded-xl text-surface-600 dark:text-navy-400 bg-white/60 dark:bg-navy-800/60 border border-white/80 dark:border-navy-700/60 hover:bg-white dark:hover:bg-navy-800 transition-colors text-sm font-medium">
                Cancelar
              </button>
              <button
                onClick={() => setDismissedForPersona(idPersona)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-medium shadow-md text-sm">
                Continuar de todos modos
              </button>
            </div>
          </div>
        </div>
      )}

      {showOverdueBlock && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4">
          <div className="glass-panel !bg-white/95 dark:!bg-navy-900/95 rounded-2xl w-full max-w-lg p-6">
            <AlertTriangle
              size={48}
              className="mx-auto mb-4 text-red-500"
            />
            <h3 className="text-lg font-bold text-surface-800 dark:text-navy-200 text-center mb-2">
              Préstamos vencidos
            </h3>
            <p className="text-sm text-surface-600 dark:text-navy-400 text-center mb-5">
              Esta persona tiene préstamos vencidos. No se le puede realizar un
              nuevo préstamo hasta que los regularice.
            </p>
            <div className="space-y-2 mb-5">
              {overdueItems.map((item, i) => (
                <div
                  key={i}
                  className="glass-card rounded-xl p-3">
                  <p className="font-semibold text-surface-800 dark:text-navy-200 text-sm">
                    {item.documentoDescripcion}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-surface-500 dark:text-navy-400">
                    <span>Devolución: {formatDate(item.fechaDevolucion)}</span>
                    <span className="text-red-600 dark:text-red-400 font-semibold">
                      {item.diasRetraso} día(s) vencido
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-center">
              <button
                onClick={() => setIdPersona("")}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-surface-600 to-surface-500 text-white font-medium shadow-md text-sm">
                Seleccionar otra persona
              </button>
            </div>
          </div>
        </div>
      )}

      {showSuccess && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4">
          <div className="glass-panel !bg-white/95 dark:!bg-navy-900/95 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mx-auto mb-3">
              <CheckCircle2 size={24} className="text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-bold text-surface-800 dark:text-navy-200 text-center mb-4">
              Préstamo registrado exitosamente
            </h3>

            <div className="flex justify-center mb-2">
              <div className="bg-white p-3 rounded-xl shadow-sm">
                {tokenFirma && qrBaseUrl ? (
                  <QRCodeCanvas value={`${qrBaseUrl}/firma/${tokenFirma}`} size={120} />
                ) : (
                  <div className="w-[120px] h-[120px] flex items-center justify-center text-surface-400">
                    <Loader2 size={24} className="animate-spin" />
                  </div>
                )}
              </div>
            </div>

            {tokenFirma && qrBaseUrl && (
              <p className="text-[10px] text-surface-400 dark:text-navy-500 text-center mb-3 break-all px-2">
                {qrBaseUrl}/firma/{tokenFirma}
              </p>
            )}

            {previewUrl ? (
              <div className="mb-4">
                <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                  <img src={previewUrl} alt="Foto de firma" className="w-full rounded-xl border border-surface-300 dark:border-navy-600" />
                </a>
                {uploadMsg && (
                  <p className={`text-xs mt-2 text-center ${uploadMsg.includes('exitosa') || uploadMsg.includes('recibida') ? 'text-green-600' : 'text-red-500'}`}>
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
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Camera size={24} className="mx-auto text-surface-400 dark:text-navy-500 mb-2" />
                <p className="text-sm text-surface-600 dark:text-navy-400">
                  {uploading ? 'Subiendo...' : 'Arrastra la foto aquí o haz clic para seleccionar'}
                </p>
                <p className="text-xs text-surface-400 dark:text-navy-500 mt-1">
                  Escanea el QR con tu celular o sube la foto del documento firmado
                </p>
                {uploadMsg && (
                  <p className={`text-xs mt-2 ${uploadMsg.includes('exitosa') || uploadMsg.includes('recibida') ? 'text-green-600' : 'text-red-500'}`}>
                    {uploadMsg}
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-center gap-3 pt-4 border-t border-white/20 dark:border-navy-700/30">
              <button onClick={generatePDF}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 dark:from-brand-dark-500 dark:to-blue-500 text-white font-medium shadow-md text-sm flex items-center gap-2"
              ><FileText size={16} /> Imprimir comprobante</button>
              <button onClick={reset}
                className="px-5 py-2.5 rounded-xl text-surface-600 dark:text-navy-400 bg-white/60 dark:bg-navy-800/60 border border-white/80 dark:border-navy-700/60 hover:bg-white dark:hover:bg-navy-800 transition-colors text-sm font-medium"
              >Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
