import { useState, useEffect, useRef } from 'react';
import { useLazyQuery } from '@apollo/client/react';
import { X, Search, UserPlus, AlertTriangle, CheckCircle2, Circle, ChevronRight, ChevronDown, FileText, Camera, Loader2 } from 'lucide-react';
import { GET_PERSONA_PRESTAMOS_PENDIENTES, GET_CARPETAS_CON_DOCUMENTOS } from '../../lib/queries';
import { useAuth } from '../../context/AuthContext';
import PrestamosPendientesModal from './PrestamosPendientesModal';
import { formatDate } from '../../utils/formatDate';
import { QRCodeCanvas } from 'qrcode.react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Persona {
  id: string; ci: string; nombre: string; apellido: string; cargo?: string; telefono?: string; email?: string;
}

interface CarpetaDisponible {
  id: string; descripcion: string; fechaCrea?: string;
  piso: { nroFila: number; estante: { codigo: string; ambiente: { nombre: string } } };
}

interface Props {
  show: boolean;
  onClose: () => void;
  personas: Persona[];
  ultimasPersonas: Persona[];
  carpetasDisponibles: CarpetaDisponible[];
  personasConCargo: Persona[];
  onRegistrar: (vars: {
    idsCarpetas: string[]; idPersona: string; fechaDevolucion: string;
    idAutorizadoPor?: string; observaciones?: string;
  }) => Promise<{ error?: string; warning?: string; tokenFirma?: string }>;
  hasPerm: (p: string) => boolean;
  onShowNewPersona: () => void;
  onBloquear?: (personaId: string, motivo: string) => Promise<string>;
}

export default function RegistrarPrestamoModal({ show, onClose, personas, ultimasPersonas, carpetasDisponibles, personasConCargo, onRegistrar, hasPerm, onShowNewPersona, onBloquear }: Props) {
  const [step, setStep] = useState(1);
  const [idPersona, setIdPersona] = useState('');
  const [idAutorizadoPor, setIdAutorizadoPor] = useState('');
  const [idsCarpetas, setIdsCarpetas] = useState<string[]>([]);
  const [fechaDevolucion, setFechaDevolucion] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [error, setError] = useState('');
  const [searchPersona, setSearchPersona] = useState('');
  const [personaQuery, setPersonaQuery] = useState('');
  const [searchCarpeta, setSearchCarpeta] = useState('');
  const [carpetaQuery, setCarpetaQuery] = useState('');
  const [searchAutoriza, setSearchAutoriza] = useState('');

  const [showSuccess, setShowSuccess] = useState(false);
  const [showPendientes, setShowPendientes] = useState(false);
  const [showPendientesWarning, setShowPendientesWarning] = useState(false);
  const [showOverdueBlock, setShowOverdueBlock] = useState(false);
  const [overdueItems, setOverdueItems] = useState<any[]>([]);
  const [fetchPendientes, { data: pendientesData }] = useLazyQuery(GET_PERSONA_PRESTAMOS_PENDIENTES, {
    fetchPolicy: 'network-only',
  });

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [checkedDocs, setCheckedDocs] = useState<Set<string>>(new Set());
  const [fetchCarpetasDocs, { data: docsData }] = useLazyQuery(GET_CARPETAS_CON_DOCUMENTOS, {
    fetchPolicy: 'network-only',
  });

  const { user } = useAuth();

  const [tokenFirma, setTokenFirma] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [polling, setPolling] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (idPersona) {
      fetchPendientes({ variables: { personaId: idPersona } });
    }
  }, [idPersona, fetchPendientes]);

  useEffect(() => {
    if (idsCarpetas.length > 0) {
      fetchCarpetasDocs({ variables: { ids: idsCarpetas } });
    }
  }, [idsCarpetas, fetchCarpetasDocs]);

  useEffect(() => {
    const carpetas = docsData?.allCarpetas || [];
    if (carpetas.length > 0 && checkedDocs.size === 0) {
      const allIds = new Set<string>();
      for (const c of carpetas) {
        for (const d of c.documentos || []) {
          allIds.add(d.id);
        }
      }
      if (allIds.size > 0) setCheckedDocs(allIds);
    }
  }, [docsData]);

  const [qrBaseUrl, setQrBaseUrl] = useState('');

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

  const personaSel = personas.find(p => p.id === idPersona);
  const pendientes = pendientesData?.personaPrestamosPendientes;

  useEffect(() => {
    if (pendientes && pendientes.totalPendientes > 0) {
      const overdue = pendientes.items.filter((i: any) => i.diasRetraso > 0);
      if (overdue.length > 0) {
        setOverdueItems(overdue);
        setShowOverdueBlock(true);
      } else {
        setShowPendientesWarning(true);
      }
    }
  }, [pendientes]);

  if (!show) return null;

  const handleSubmit = async () => {
    setError('');
    if (!idPersona) { setError('Selecciona una persona'); return; }
    if (!idAutorizadoPor) { setError('Selecciona quién autoriza el préstamo'); return; }
    if (idsCarpetas.length === 0) { setError('Selecciona al menos una carpeta'); return; }
    if (!fechaDevolucion) { setError('Ingresa la fecha de devolución'); return; }
    const res = await onRegistrar({ idsCarpetas, idPersona, fechaDevolucion, idAutorizadoPor, observaciones: observaciones || undefined });
    if (res?.error) setError(res.error);
    else {
      if (res?.warning) setError(res.warning);
      if (res?.tokenFirma) setTokenFirma(res.tokenFirma);
      setShowSuccess(true);
    }
  };

  const toggleCarpeta = (id: string) => {
    setIdsCarpetas((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleFolderExpand = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
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

  const generatePDF = () => {
    const doc = new jsPDF();
    const personaSel = personas.find((p) => p.id === idPersona);
    const autorizaSel = personasConCargo.find((p) => p.id === idAutorizadoPor);
    const carpetasData = docsData?.allCarpetas || [];

    let y = 20;
    doc.setFontSize(18);
    doc.text('Comprobante de Pr\u00E9stamo', 14, y); y += 12;

    doc.setFontSize(10);
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}`, 14, y); y += 6;
    doc.text(`Realizado por: ${user?.username || '-'}`, 14, y); y += 10;

    doc.setFontSize(11);
    doc.text('Datos del Pr\u00E9stamo', 14, y); y += 7;
    doc.setFontSize(10);
    doc.text(`Se prest\u00F3 a: ${personaSel?.nombre || ''} ${personaSel?.apellido || ''} (CI: ${personaSel?.ci || '-'})`, 14, y); y += 6;
    if (autorizaSel) {
      doc.text(`Autorizado por: ${autorizaSel.nombre} ${autorizaSel.apellido} (${autorizaSel.cargo || 'Sin cargo'})`, 14, y); y += 6;
    }
    doc.text(`Fecha de devoluci\u00F3n: ${new Date(fechaDevolucion).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}`, 14, y); y += 6;
    if (observaciones) {
      doc.text(`Observaciones: ${observaciones}`, 14, y); y += 6;
    }

    y += 4;

    const body: string[][] = [];
    for (const c of carpetasData) {
      const docs = c.documentos || [];
      if (docs.length === 0) {
        body.push([c.descripcion, '(Sin documentos)', '', '']);
      } else {
        docs.forEach((d: any, idx: number) => {
          const presente = checkedDocs.has(d.id) ? 'S\u00ED' : 'No';
          body.push([
            idx === 0 ? c.descripcion : '',
            d.codigoDoc || '',
            d.tipoDoc || '',
            presente,
          ]);
        });
      }
    }

    autoTable(doc, {
      head: [['Carpeta', 'C\u00F3digo Doc.', 'Documento', 'Presente']],
      body,
      startY: y,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [79, 70, 229] },
      columnStyles: {
        3: { halign: 'center', cellWidth: 20 },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);

    y += 4;

    const lw = 65;
    doc.line(62.5 - lw / 2, y, 62.5 + lw / 2, y);
    doc.line(147.5 - lw / 2, y, 147.5 + lw / 2, y);
    y += 5;

    const firmaNombre = personaSel ? `${personaSel.nombre} ${personaSel.apellido}` : '';
    const usuarioNombre = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '';
    doc.text(firmaNombre, 62.5, y, { align: 'center' });
    doc.text(usuarioNombre, 147.5, y, { align: 'center' });

    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  const reset = () => {
    setStep(1); setIdPersona(''); setIdAutorizadoPor('');
    setIdsCarpetas([]); setFechaDevolucion(''); setObservaciones(''); setError('');
    setSearchPersona(''); setPersonaQuery(''); setSearchCarpeta(''); setCarpetaQuery(''); setSearchAutoriza('');
    setCheckedDocs(new Set());
    setExpandedFolders(new Set());
    setTokenFirma('');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setUploadMsg('');
    setShowSuccess(false);
    setShowPendientesWarning(false);
    setShowOverdueBlock(false);
    setOverdueItems([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4">
      <div className="glass-panel !bg-white/95 dark:!bg-navy-900/95 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-surface-800 dark:text-navy-200">Registrar Préstamo</h3>
          <button onClick={reset}
            className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-400 transition-colors"
          ><X size={20} /></button>
        </div>

        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <button key={s} onClick={() => setStep(s)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                step === s
                  ? 'bg-brand-600 dark:bg-brand-dark-500 text-white shadow-md'
                  : s < step
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                    : 'bg-surface-100 dark:bg-navy-800 text-surface-500 dark:text-navy-500'
              }`}
            >{s === 1 ? '1. Persona' : s === 2 ? '2. Carpetas' : '3. Confirmar'}</button>
          ))}
        </div>

        {error && <div className="mb-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm rounded-xl px-4 py-2.5">{error}</div>}

        {step === 1 && (
          <div>
            <h4 className="text-sm font-semibold text-surface-700 dark:text-navy-300 mb-3">Seleccionar persona que recibe el préstamo</h4>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500 dark:text-navy-500" size={16} />
              <input type="text" placeholder="Buscar por CI, nombre o apellido..." value={searchPersona}
                onChange={(e) => setSearchPersona(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') setPersonaQuery(searchPersona.trim()); }}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 placeholder:text-surface-600 dark:placeholder:text-navy-500 focus:outline-none focus:ring-2 focus:ring-brand-400/50 dark:focus:ring-brand-dark-500/50 transition-all text-sm" />
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
              {(personaQuery
                ? personas.filter((p) => {
                    const q = personaQuery.toLowerCase();
                    return p.ci.toLowerCase().includes(q) || p.nombre.toLowerCase().includes(q) || p.apellido.toLowerCase().includes(q);
                  })
                : ultimasPersonas
              ).map((p) => (
                <button key={p.id} onClick={() => setIdPersona(p.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all text-sm flex items-center gap-3 ${
                    idPersona === p.id
                      ? 'bg-brand-50 dark:bg-brand-dark-600/20 border border-brand-200 dark:border-brand-dark-600/30 text-brand-700 dark:text-brand-dark-400'
                      : 'bg-white/40 dark:bg-navy-800/40 border border-transparent hover:bg-white/60 dark:hover:bg-navy-800/60 text-surface-700 dark:text-navy-300'
                  }`}>
                  {idPersona === p.id
                    ? <CheckCircle2 size={18} className="text-brand-600 dark:text-brand-dark-400 shrink-0" />
                    : <Circle size={18} className="text-surface-400 shrink-0" />
                  }
                  <span className="font-semibold">{p.nombre} {p.apellido}</span>
                  <span className="ml-auto text-surface-500 dark:text-navy-500">CI: {p.ci}</span>
                </button>
              ))}
              {!personaQuery && ultimasPersonas.length === 0 && personas.length > 0 && (
                <p className="text-sm text-surface-500 dark:text-navy-500 text-center py-4">No hay personas recientes</p>
              )}
              {personas.length === 0 && <p className="text-sm text-surface-500 dark:text-navy-500 text-center py-4">No hay personas registradas</p>}
             </div>
             {hasPerm('gestionar_personas') && (
              <button onClick={onShowNewPersona}
                className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-brand-300 text-brand-600 dark:text-brand-dark-400 hover:bg-brand-50 dark:hover:bg-brand-dark-600/20 transition-all text-sm font-medium"
              ><UserPlus size={16} /> Registrar nueva persona</button>
            )}



            <div className="mt-6 border-t border-white/20 dark:border-navy-700/30 pt-4">
              <h4 className="text-sm font-semibold text-surface-700 dark:text-navy-300 mb-3">Autorizado por (persona con cargo)</h4>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500 dark:text-navy-500" size={16} />
                <input type="text" placeholder="Buscar personas con cargo..." value={searchAutoriza}
                  onChange={(e) => setSearchAutoriza(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 placeholder:text-surface-600 dark:placeholder:text-navy-500 focus:outline-none focus:ring-2 focus:ring-brand-400/50 dark:focus:ring-brand-dark-500/50 transition-all text-sm" />
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                {personasConCargo.filter((p) => {
                  const q = searchAutoriza.toLowerCase();
                  return p.nombre.toLowerCase().includes(q) || p.apellido.toLowerCase().includes(q) || (p.cargo || '').toLowerCase().includes(q);
                }).map((p) => (
                  <button key={p.id} onClick={() => setIdAutorizadoPor(p.id)}
                    className={`w-full text-left px-4 py-2.5 rounded-xl transition-all text-sm flex items-center gap-3 ${
                      idAutorizadoPor === p.id
                        ? 'bg-brand-50 dark:bg-brand-dark-600/20 border border-brand-200 dark:border-brand-dark-600/30 text-brand-700 dark:text-brand-dark-400'
                        : 'bg-white/40 dark:bg-navy-800/40 border border-transparent hover:bg-white/60 dark:hover:bg-navy-800/60 text-surface-700 dark:text-navy-300'
                    }`}>
                    {idAutorizadoPor === p.id
                      ? <CheckCircle2 size={18} className="text-brand-600 dark:text-brand-dark-400 shrink-0" />
                      : <Circle size={18} className="text-surface-400 shrink-0" />
                    }
                    <span className="font-semibold">{p.nombre} {p.apellido}</span>
                    <span className="ml-auto px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">{p.cargo}</span>
                  </button>
                ))}
                {personasConCargo.length === 0 && <p className="text-sm text-surface-500 dark:text-navy-500 text-center py-4">No hay personas con cargo registradas</p>}
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button onClick={() => setStep(2)}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 dark:from-brand-dark-500 dark:to-blue-500 text-white font-medium shadow-md text-sm"
              >Siguiente</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h4 className="text-sm font-semibold text-surface-700 dark:text-navy-300 mb-3">Seleccionar carpetas a prestar</h4>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500 dark:text-navy-500" size={16} />
              <input type="text" placeholder="Buscar carpeta..." value={searchCarpeta}
                onChange={(e) => setSearchCarpeta(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') setCarpetaQuery(searchCarpeta.trim()); }}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 placeholder:text-surface-600 dark:placeholder:text-navy-500 focus:outline-none focus:ring-2 focus:ring-brand-400/50 dark:focus:ring-brand-dark-500/50 transition-all text-sm" />
            </div>
            <div className="mb-2 text-xs text-surface-600 dark:text-navy-500">{idsCarpetas.length} seleccionadas</div>
            {idsCarpetas.length > 0 && (
              <div className="mb-2 p-2 rounded-lg bg-brand-50 dark:bg-brand-dark-600/20 border border-brand-200 dark:border-brand-dark-500/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-brand-700 dark:text-brand-dark-400">
                    {idsCarpetas.length} carpeta(s) seleccionada(s)
                  </span>
                  <button
                    onClick={() => setIdsCarpetas([])}
                    className="text-xs text-brand-600 dark:text-brand-dark-400 hover:underline"
                  >
                    Limpiar
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {idsCarpetas.map((id) => {
                    const carpeta = carpetasDisponibles.find(c => c.id === id);
                    return (
                      <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-white/50 dark:bg-navy-800/50 text-surface-700 dark:text-navy-300">
                        {carpeta?.descripcion || id}
                        <button onClick={() => toggleCarpeta(id)} className="text-red-400 hover:text-red-600 ml-0.5">&times;</button>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
              {(carpetaQuery
                ? carpetasDisponibles.filter((c) => {
                    const q = carpetaQuery.toLowerCase();
                    return c.descripcion.toLowerCase().includes(q) || c.piso.estante.codigo.toLowerCase().includes(q) || c.piso.estante.ambiente.nombre.toLowerCase().includes(q);
                  })
                : [...carpetasDisponibles]
                    .sort((a, b) => ((b as any).fechaCrea || '').localeCompare((a as any).fechaCrea || ''))
                    .slice(0, 5)
              ).map((c) => (
                <label key={c.id}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-sm cursor-pointer ${
                    idsCarpetas.includes(c.id)
                      ? 'bg-brand-50 dark:bg-brand-dark-600/20 border border-brand-200 dark:border-brand-dark-600/30'
                      : 'bg-white/40 dark:bg-navy-800/40 border border-transparent hover:bg-white/60 dark:hover:bg-navy-800/60'
                  }`}>
                  <input type="checkbox" checked={idsCarpetas.includes(c.id)} onChange={() => toggleCarpeta(c.id)}
                    className="rounded border-surface-300 text-brand-600 focus:ring-brand-400 dark:focus:ring-brand-dark-500" />
                  <div className="flex-1">
                    <span className="font-semibold text-surface-800 dark:text-navy-200">{c.descripcion}</span>
                    <span className="text-surface-500 dark:text-navy-500 ml-2 text-xs">{c.piso.estante.ambiente.nombre} / {c.piso.estante.codigo} / Fila {c.piso.nroFila}</span>
                  </div>
                </label>
              ))}
              {carpetasDisponibles.length === 0 && <p className="text-sm text-surface-500 dark:text-navy-500 text-center py-4">No hay carpetas disponibles</p>}
            </div>
            <div className="flex justify-between mt-6">
              <button onClick={() => setStep(1)}
                className="px-6 py-2.5 rounded-xl text-surface-600 dark:text-navy-400 bg-white/60 dark:bg-navy-800/60 border border-white/80 dark:border-navy-700/60 hover:bg-white dark:hover:bg-navy-800 transition-colors text-sm font-medium"
              >Atrás</button>
              <button onClick={() => setStep(3)}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 dark:from-brand-dark-500 dark:to-blue-500 text-white font-medium shadow-md text-sm"
              >Siguiente</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h4 className="text-sm font-semibold text-surface-700 dark:text-navy-300 mb-4">Confirmar préstamo</h4>
            <div className="space-y-3 mb-6">
              <div className="glass-card rounded-xl p-4">
                <p className="text-xs text-surface-600 dark:text-navy-500 mb-1">Persona</p>
                <p className="font-semibold text-surface-800 dark:text-navy-200">
                  {personas.find((p) => p.id === idPersona)?.nombre} {personas.find((p) => p.id === idPersona)?.apellido}
                  <span className="text-surface-500 dark:text-navy-500 font-normal ml-2">CI: {personas.find((p) => p.id === idPersona)?.ci}</span>
                </p>
              </div>
              {idAutorizadoPor && (
                <div className="glass-card rounded-xl p-4">
                  <p className="text-xs text-surface-600 dark:text-navy-500 mb-1">Autorizado por</p>
                  <p className="font-semibold text-surface-800 dark:text-navy-200">
                    {personasConCargo.find((p) => p.id === idAutorizadoPor)?.nombre} {personasConCargo.find((p) => p.id === idAutorizadoPor)?.apellido}
                    <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">{personasConCargo.find((p) => p.id === idAutorizadoPor)?.cargo}</span>
                  </p>
                </div>
              )}
              <div className="glass-card rounded-xl p-4">
                <p className="text-xs text-surface-600 dark:text-navy-500 mb-1">Carpetas ({idsCarpetas.length})</p>
                <div className="space-y-1 mt-1">
                  {carpetasDisponibles.filter((c) => idsCarpetas.includes(c.id)).map((c) => {
                    const docCarpeta = docsData?.allCarpetas?.find((dc: any) => dc.id === c.id);
                    const docs = docCarpeta?.documentos || [];
                    const allChecked = docs.length > 0 && docs.every((d: any) => checkedDocs.has(d.id));
                    return (
                      <div key={c.id} className="border-2 border-blue-400/50 dark:border-blue-500/50 rounded-xl">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-t-lg bg-surface-50 dark:bg-navy-800/50">
                          <button onClick={() => toggleFolderExpand(c.id)}
                            className="flex items-center gap-2 flex-1 text-left"
                          >
                            {expandedFolders.has(c.id)
                              ? <ChevronDown size={14} className="shrink-0 text-surface-500" />
                              : <ChevronRight size={14} className="shrink-0 text-surface-500" />
                            }
                            <span className="text-sm font-medium text-surface-800 dark:text-navy-200">{c.descripcion}</span>
                          </button>
                          {docs.length > 0 && (
                            <button onClick={() => {
                              const ids = docs.map((d: any) => d.id);
                              setCheckedDocs((prev) => {
                                const next = new Set(prev);
                                  if (allChecked) {
                                  ids.forEach((id: string) => next.delete(id));
                                } else {
                                  ids.forEach((id: string) => next.add(id));
                                }
                                return next;
                              });
                            }}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-brand-600 dark:text-brand-dark-400 hover:bg-brand-50 dark:hover:bg-brand-dark-600/20 transition-colors"
                            >
                              {allChecked ? 'Deseleccionar todos' : 'Seleccionar todos'}
                            </button>
                          )}
                          <span className="text-xs text-surface-500 dark:text-navy-500 shrink-0">
                            {docs.filter((d: any) => checkedDocs.has(d.id)).length}/{docs.length} presentes
                          </span>
                        </div>
                        {expandedFolders.has(c.id) && (
                          <div className="ml-6 mt-1 space-y-0.5 border-l-2 border-blue-300 dark:border-blue-400 pl-3 pb-2">
                            {docs.length > 0 ? docs.map((d: any) => {
                              const isChecked = checkedDocs.has(d.id);
                              return (
                                <label key={d.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all text-xs cursor-pointer ${
                                  isChecked
                                    ? 'bg-green-50/60 dark:bg-green-900/15 border border-green-200/50 dark:border-green-800/30'
                                    : 'bg-red-50/60 dark:bg-red-900/15 border border-red-200/50 dark:border-red-800/30 hover:bg-red-100/60 dark:hover:bg-red-900/25'
                                }`}>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      setCheckedDocs((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(d.id)) next.delete(d.id);
                                        else next.add(d.id);
                                        return next;
                                      });
                                    }}
                                    className="w-3.5 h-3.5 rounded border-surface-300 text-brand-600 focus:ring-brand-400 dark:focus:ring-brand-dark-500"
                                  />
                                  <FileText size={12} className="shrink-0 text-surface-400" />
                                  <span className="font-mono text-surface-600 dark:text-navy-400">{d.codigoDoc}</span>
                                  <span className="text-surface-800 dark:text-navy-200 truncate">{d.tipoDoc}</span>
                                </label>
                              );
                            }) : (
                              <p className="text-xs text-surface-500 dark:text-navy-500 py-1">Sin documentos asignados</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="glass-card rounded-xl p-4">
                <label className="block text-xs text-surface-600 dark:text-navy-500 mb-1">Fecha de devolución</label>
                <input type="date" value={fechaDevolucion} onChange={(e) => setFechaDevolucion(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400/50 dark:focus:ring-brand-dark-500/50 transition-all" />
              </div>
              <div className="glass-card rounded-xl p-4">
                <label className="block text-xs text-surface-600 dark:text-navy-500 mb-1">Observaciones</label>
                <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
                  rows={2} placeholder="Opcional..."
                  className="w-full px-4 py-2 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400/50 dark:focus:ring-brand-dark-500/50 transition-all resize-none" />
              </div>
            </div>
            <div className="flex justify-between">
              <button onClick={() => setStep(2)}
                className="px-6 py-2.5 rounded-xl text-surface-600 dark:text-navy-400 bg-white/60 dark:bg-navy-800/60 border border-white/80 dark:border-navy-700/60 hover:bg-white dark:hover:bg-navy-800 transition-colors text-sm font-medium"
              >Atrás</button>
              <div className="flex gap-2">
                <button onClick={handleSubmit}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 dark:from-brand-dark-500 dark:to-blue-500 text-white font-medium shadow-md shadow-brand-500/30 dark:shadow-brand-dark-600/20 hover:shadow-lg transition-all text-sm"
                >Confirmar Préstamo</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showPendientes && personaSel && pendientes && (
        <PrestamosPendientesModal
          persona={{
            id: personaSel.id,
            nombre: personaSel.nombre,
            apellido: personaSel.apellido,
            ci: personaSel.ci,
            telefono: personaSel.telefono,
            email: personaSel.email,
          }}
          items={pendientes.items.map((i: any) => ({
            descripcion: i.carpetaDescripcion,
            fechaPrest: i.fechaPrest,
            fechaDevolucion: i.fechaDevolucion,
            diasRetraso: i.diasRetraso,
          }))}
          type="carpetas"
          onClose={() => setShowPendientes(false)}
          onBloquear={onBloquear}
        />
      )}

      {showPendientesWarning && pendientes && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4">
          <div className="glass-panel !bg-white/95 dark:!bg-navy-900/95 rounded-2xl w-full max-w-md p-6 text-center">
            <AlertTriangle size={48} className="mx-auto mb-4 text-amber-500" />
            <h3 className="text-lg font-bold text-surface-800 dark:text-navy-200 mb-2">Préstamos pendientes</h3>
            <p className="text-sm text-surface-600 dark:text-navy-400 mb-6">
              Esta persona tiene <strong>{pendientes.totalPendientes}</strong> {pendientes.totalPendientes === 1 ? 'préstamo pendiente' : 'préstamos pendientes'} que aún no ha devuelto. ¿Deseas continuar de todos modos?
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => { setIdPersona(''); setShowPendientesWarning(false); }}
                className="px-5 py-2.5 rounded-xl text-surface-600 dark:text-navy-400 bg-white/60 dark:bg-navy-800/60 border border-white/80 dark:border-navy-700/60 hover:bg-white dark:hover:bg-navy-800 transition-colors text-sm font-medium"
              >Cancelar</button>
              <button onClick={() => setShowPendientesWarning(false)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-medium shadow-md text-sm"
              >Continuar de todos modos</button>
            </div>
          </div>
        </div>
      )}

      {showOverdueBlock && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4">
          <div className="glass-panel !bg-white/95 dark:!bg-navy-900/95 rounded-2xl w-full max-w-lg p-6">
            <AlertTriangle size={48} className="mx-auto mb-4 text-red-500" />
            <h3 className="text-lg font-bold text-surface-800 dark:text-navy-200 text-center mb-2">Préstamos vencidos</h3>
            <p className="text-sm text-surface-600 dark:text-navy-400 text-center mb-5">
              Esta persona tiene préstamos vencidos. No se le puede realizar un nuevo préstamo hasta que los regularice.
            </p>
            <div className="space-y-2 mb-5">
              {overdueItems.map((item, i) => (
                <div key={i} className="glass-card rounded-xl p-3">
                  <p className="font-semibold text-surface-800 dark:text-navy-200 text-sm">{item.carpetaDescripcion}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-surface-500 dark:text-navy-400">
                    <span>Devolución: {formatDate(item.fechaDevolucion)}</span>
                    <span className="text-red-600 dark:text-red-400 font-semibold">{item.diasRetraso} día(s) vencido</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-center">
              <button onClick={() => { setIdPersona(''); setShowOverdueBlock(false); setOverdueItems([]); }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-surface-600 to-surface-500 text-white font-medium shadow-md text-sm"
              >Seleccionar otra persona</button>
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
