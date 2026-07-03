import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client/react';
import { Search, Users, FolderOpen, AlertCircle, AlertTriangle, CheckCircle2, Clock, Ban, FileText } from 'lucide-react';
import { GLOBAL_SEARCH, CREAR_BLOQUEO } from '../lib/queries';
import BloqueoModal from '../components/prestamos/BloqueoModal';
import PrestamosPendientesModal from '../components/prestamos/PrestamosPendientesModal';
import type { BloqueoInfo } from '../components/prestamos/BloqueoModal';
import { formatDate } from '../utils/formatDate';

interface PrestamoInfo {
  prestada: boolean;
  personaId?: string;
  personaNombre?: string;
  fechaPrest?: string;
  fechaDevolucion?: string;
  diasRestantes?: number;
}

interface CarpetaResult {
  id: string;
  descripcion?: string;
  fechaCrea: string;
  estado: string;
  piso: {
    nroFila: number;
    estante: {
      codigo: string;
      ambiente: { nombre: string };
    };
  };
  prestamoInfo?: PrestamoInfo;
}

interface DocPendienteItem {
  prestamoCarpetaId: string;
  carpetaDescripcion?: string;
  fechaPrest: string;
  fechaDevolucion: string;
  diasRetraso: number;
}

interface DocPendienteDocItem {
  prestamoDocItemId: string;
  documentoDescripcion?: string;
  fechaPrest: string;
  fechaDevolucion: string;
  diasRetraso: number;
}

interface BloqueoActivo {
  id: string;
  fechaBloq: string;
  motivoBloq: string;
}

interface PrestamosInfo {
  totalPendientesCarpetas: number;
  itemsCarpetas: DocPendienteItem[];
  totalPendientesDocumentos: number;
  itemsDocumentos: DocPendienteDocItem[];
  bloqueoActivo?: BloqueoActivo | null;
}

interface PersonaResult {
  id: string;
  ci: string;
  nombre: string;
  apellido: string;
  telefono?: string;
  email?: string;
  prestamosInfo?: PrestamosInfo;
}

export default function SearchResultsPage() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q') || '';

  const { data, loading } = useQuery(GLOBAL_SEARCH, {
    variables: { query: q },
    skip: !q,
    fetchPolicy: 'network-only',
  });

  const [crearBloqueo] = useMutation(CREAR_BLOQUEO);

  const carpetas: CarpetaResult[] = data?.globalSearch?.carpetas ?? [];
  const personas: PersonaResult[] = data?.globalSearch?.personas ?? [];
  const total = carpetas.length + personas.length;

  const [bloquearPersona, setBloquearPersona] = useState<{
    persona: PersonaResult;
    bloqueoInfo: BloqueoInfo;
  } | null>(null);

  const [pendientesPersona, setPendientesPersona] = useState<{
    persona: PersonaResult;
    items: { descripcion: string; fechaPrest: string; fechaDevolucion: string; diasRetraso: number }[];
    type: 'carpetas' | 'documentos';
  } | null>(null);

  const handleBloquear = async (personaId: string, motivo: string) => {
    try {
      const { data: res } = await crearBloqueo({ variables: { personaId, motivo } });
      if (res?.crearBloqueo?.error) throw new Error(res.crearBloqueo.error);
      return '✅ Persona bloqueada exitosamente';
    } catch (err: unknown) {
      return err instanceof Error ? err.message : 'Error al bloquear';
    }
  };

  const buildBloqueoInfo = (p: PersonaResult, overdueItems: DocPendienteItem[] | DocPendienteDocItem[]): BloqueoInfo => ({
    persona: {
      nombre: p.nombre,
      apellido: p.apellido,
      ci: p.ci,
      telefono: p.telefono,
      email: p.email,
    },
    fechaPrest: overdueItems.reduce((a, b) => a < b.fechaPrest ? a : b.fechaPrest, overdueItems[0]?.fechaPrest || ''),
    fechaDevolucion: overdueItems.reduce((a, b) => a < b.fechaDevolucion ? a : b.fechaDevolucion, overdueItems[0]?.fechaDevolucion || ''),
    diasRetraso: Math.max(...overdueItems.map(i => i.diasRetraso), 0),
    itemsVencidos: overdueItems.map(i => ({
      descripcion: 'carpetaDescripcion' in i ? i.carpetaDescripcion || '' : i.documentoDescripcion || '',
    })),
  });

  const estadoBadge = (estado: string) => {
    const styles: Record<string, string> = {
      disponible: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
      prestado: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
      retirado: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[estado] || 'bg-surface-100 text-surface-600 dark:bg-navy-800 dark:text-navy-400'}`}>
        {estado}
      </span>
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-surface-800 dark:text-navy-200 flex items-center gap-3">
          <Search size={24} className="text-brand-600 dark:text-brand-dark-400" />
          Resultados de búsqueda
        </h1>
        <p className="text-surface-500 dark:text-navy-500 mt-1">
          {q ? `Mostrando resultados para "${q}"` : 'Ingresa un término de búsqueda'}
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      )}

      {!loading && q && total === 0 && (
        <div className="glass-panel rounded-2xl p-8 text-center">
          <AlertCircle size={40} className="mx-auto mb-3 text-surface-400 dark:text-navy-600" />
          <p className="text-surface-600 dark:text-navy-400 font-medium">Sin resultados</p>
          <p className="text-sm text-surface-500 dark:text-navy-500 mt-1">No se encontraron coincidencias para "{q}"</p>
        </div>
      )}

      {!loading && q && total > 0 && (
        <div className="space-y-8">
          {carpetas.length > 0 && (
            <section>
              <h2 className="text-lg font-bold text-surface-800 dark:text-navy-200 flex items-center gap-2 mb-3">
                <FolderOpen size={18} className="text-brand-600 dark:text-brand-dark-400" />
                Carpetas ({carpetas.length})
              </h2>
              <div className="space-y-3">
                {carpetas.map((c) => (
                  <div key={c.id}
                    className="glass-card rounded-xl p-4 border border-white/20 dark:border-navy-700/30"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <Link to={`/carpetas?q=${encodeURIComponent(c.descripcion || '')}`}
                          className="font-semibold text-sm text-surface-800 dark:text-navy-200 hover:text-brand-600 dark:hover:text-brand-dark-400 transition-colors"
                        >
                          {c.descripcion || `Carpeta #${c.id}`}
                        </Link>
                        <div className="flex items-center gap-2 mt-1.5">
                          {estadoBadge(c.estado)}
                          <span className="text-xs text-surface-500 dark:text-navy-500">
                            {c.piso?.estante?.ambiente?.nombre} — Estante {c.piso?.estante?.codigo} — Piso {c.piso?.nroFila}
                          </span>
                        </div>
                        {c.prestamoInfo?.prestada && (
                          <div className="mt-2 pl-3 border-l-2 border-amber-400 dark:border-amber-600">
                            <p className="text-xs text-surface-600 dark:text-navy-400 flex items-center gap-1">
                              <Users size={12} />
                              Prestada a <span className="font-semibold text-surface-800 dark:text-navy-200">{c.prestamoInfo.personaNombre}</span>
                            </p>
                            <p className="text-xs text-surface-500 dark:text-navy-500 mt-0.5">
                              Desde: {formatDate(c.prestamoInfo.fechaPrest)} — Devolución: {formatDate(c.prestamoInfo.fechaDevolucion)}
                            </p>
                            {c.prestamoInfo.diasRestantes != null && (
                              c.prestamoInfo.diasRestantes >= 0 ? (
                                <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-0.5 flex items-center gap-1">
                                  <Clock size={12} />
                                  {c.prestamoInfo.diasRestantes} día(s) para vencer
                                </p>
                              ) : (
                                <p className="text-xs text-red-600 dark:text-red-400 font-semibold mt-0.5 flex items-center gap-1">
                                  <AlertTriangle size={12} />
                                  Vencido por {Math.abs(c.prestamoInfo.diasRestantes)} día(s)
                                </p>
                              )
                            )}
                          </div>
                        )}
                      </div>
                      <Link to={`/carpetas?q=${encodeURIComponent(c.descripcion || '')}`}
                        className="shrink-0 px-3 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-dark-600/20 text-brand-600 dark:text-brand-dark-400 text-xs font-medium hover:bg-brand-100 dark:hover:bg-brand-dark-600/30 transition-colors"
                      >
                        Ver carpeta
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {personas.length > 0 && (
            <section>
              <h2 className="text-lg font-bold text-surface-800 dark:text-navy-200 flex items-center gap-2 mb-3">
                <Users size={18} className="text-indigo-600 dark:text-indigo-400" />
                Personas ({personas.length})
              </h2>
              <div className="space-y-3">
                {personas.map((p) => {
                  const info = p.prestamosInfo;
                  const totalPendientes = (info?.totalPendientesCarpetas || 0) + (info?.totalPendientesDocumentos || 0);
                  const overdueCarpetas = info?.itemsCarpetas?.filter(i => i.diasRetraso > 0) || [];
                  const overdueDocumentos = info?.itemsDocumentos?.filter(i => i.diasRetraso > 0) || [];
                  const hasOverdue = overdueCarpetas.length > 0 || overdueDocumentos.length > 0;

                  return (
                    <div key={p.id}
                      className="glass-card rounded-xl p-4 border border-white/20 dark:border-navy-700/30"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-surface-800 dark:text-navy-200">
                              {p.nombre} {p.apellido}
                            </span>
                            <span className="text-xs text-surface-500 dark:text-navy-500">
                              CI: {p.ci}
                            </span>
                            {info?.bloqueoActivo && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 flex items-center gap-1">
                                <Ban size={10} /> BLOQUEADA
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            {totalPendientes > 0 ? (
                              <>
                                {info!.totalPendientesCarpetas > 0 && (
                                  <button
                                    onClick={() => setPendientesPersona({
                                      persona: p,
                                      items: info!.itemsCarpetas.map(i => ({
                                        descripcion: i.carpetaDescripcion || 'Carpeta',
                                        fechaPrest: i.fechaPrest,
                                        fechaDevolucion: i.fechaDevolucion,
                                        diasRetraso: i.diasRetraso,
                                      })),
                                      type: 'carpetas',
                                    })}
                                    className="text-xs text-brand-600 dark:text-brand-dark-400 hover:underline flex items-center gap-1"
                                  >
                                    <FolderOpen size={12} />
                                    {info!.totalPendientesCarpetas} carpeta(s) pendiente(s)
                                  </button>
                                )}
                                {info!.totalPendientesDocumentos > 0 && (
                                  <button
                                    onClick={() => setPendientesPersona({
                                      persona: p,
                                      items: info!.itemsDocumentos.map(i => ({
                                        descripcion: i.documentoDescripcion || 'Documento',
                                        fechaPrest: i.fechaPrest,
                                        fechaDevolucion: i.fechaDevolucion,
                                        diasRetraso: i.diasRetraso,
                                      })),
                                      type: 'documentos',
                                    })}
                                    className="text-xs text-brand-600 dark:text-brand-dark-400 hover:underline flex items-center gap-1"
                                  >
                                    <FileText size={12} />
                                    {info!.totalPendientesDocumentos} documento(s) pendiente(s)
                                  </button>
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                                <CheckCircle2 size={12} />
                                Sin préstamos pendientes
                              </span>
                            )}
                          </div>
                          {hasOverdue && (
                            <div className="mt-2 flex items-center gap-2">
                              <span className="text-xs text-red-600 dark:text-red-400 font-semibold flex items-center gap-1">
                                <AlertTriangle size={12} />
                                {overdueCarpetas.length + overdueDocumentos.length} préstamo(s) vencido(s)
                              </span>
                              <button
                                onClick={() => {
                                  const overdueItems = [...overdueCarpetas, ...overdueDocumentos];
                                  setBloquearPersona({
                                    persona: p,
                                    bloqueoInfo: buildBloqueoInfo(p, overdueItems),
                                  });
                                }}
                                className="px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors flex items-center gap-1"
                              >
                                <Ban size={10} /> Bloquear
                              </button>
                            </div>
                          )}
                        </div>
                        <Link to={`/personas?q=${encodeURIComponent(`${p.nombre} ${p.apellido}`)}`}
                          className="shrink-0 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                        >
                          Ver persona
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {!q && (
        <div className="glass-panel rounded-2xl p-8 text-center">
          <Search size={40} className="mx-auto mb-3 text-surface-400 dark:text-navy-600" />
          <p className="text-surface-600 dark:text-navy-400">Usa el buscador del navbar para encontrar carpetas, personas o documentos</p>
        </div>
      )}

      {bloquearPersona && (
        <BloqueoModal
          personaNombre={`${bloquearPersona.persona.nombre} ${bloquearPersona.persona.apellido}`}
          info={bloquearPersona.bloqueoInfo}
          onClose={() => setBloquearPersona(null)}
          onBloquear={async (motivo) => {
            const res = await handleBloquear(bloquearPersona.persona.id, motivo);
            if (res.startsWith('✅')) setBloquearPersona(null);
            return res;
          }}
        />
      )}

      {pendientesPersona && (
        <PrestamosPendientesModal
          persona={{
            id: pendientesPersona.persona.id,
            nombre: pendientesPersona.persona.nombre,
            apellido: pendientesPersona.persona.apellido,
            ci: pendientesPersona.persona.ci,
            telefono: pendientesPersona.persona.telefono,
            email: pendientesPersona.persona.email,
          }}
          items={pendientesPersona.items}
          type={pendientesPersona.type}
          onClose={() => setPendientesPersona(null)}
          onBloquear={handleBloquear}
        />
      )}
    </div>
  );
}
