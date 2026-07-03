import { useState, useMemo, useCallback } from 'react';
import { useQuery, useApolloClient } from '@apollo/client/react';
import {
  GET_ALL_CARPETAS_PAGINATED,
  GET_ALL_PRESTAMOS_PAGINATED,
  GET_ALL_DEVOLUCIONES_PAGINATED,
  GET_ALL_INCIDENTES_PAGINATED,
  GET_ALL_TRASPASOS_PAGINATED,
  GET_ALL_PRORROGAS_PAGINATED,
  GET_ALL_PERSONAS_PAGINATED,
  GET_ALL_RETIROS_PAGINATED,
  GET_ALL_BLOQUEOS_PAGINATED,
  GET_ALL_CARPETAS,
  GET_ALL_PRESTAMOS,
  GET_ALL_DEVOLUCIONES,
  GET_ALL_INCIDENTES,
  GET_ALL_TRASPASOS,
  GET_ALL_PERSONAS,
  GET_ALL_RETIROS,
  GET_ALL_BLOQUEOS,
  GET_ALL_PRESTAMOS_DOC_PAGINATED,
  GET_ALL_DEVOLUCIONES_DOC_PAGINATED,
  GET_ALL_PRORROGAS_DOC_PAGINATED,
} from '../lib/queries';
import { BarChart3, FileSpreadsheet, FileText, Search, Calendar, ChevronLeft, ChevronRight, User, Eye, Printer, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth, usePermission } from '../context/AuthContext';

type ReportType = 'carpetas' | 'prestamos' | 'devoluciones' | 'incidentes' | 'traspasos' | 'prorrogas' | 'retiros' | 'personas' | 'bloqueos' | 'prestamosDoc' | 'devolucionesDoc' | 'prorrogasDoc' | '';

type ModoReporte = 'general' | 'personal';

const PAGE_SIZE = 10;

const REPORT_OPTIONS: { value: ReportType; label: string }[] = [
  { value: '', label: 'Seleccione un reporte...' },
  { value: 'carpetas', label: 'Carpetas' },
  { value: 'prestamos', label: 'Préstamos' },
  { value: 'devoluciones', label: 'Devoluciones' },
  { value: 'incidentes', label: 'Incidentes' },
  { value: 'traspasos', label: 'Traspasos' },
  { value: 'prorrogas', label: 'Prórrogas' },
  { value: 'retiros', label: 'Retiros' },
  { value: 'bloqueos', label: 'Bloqueos' },
  { value: 'personas', label: 'Personas' },
  { value: 'prestamosDoc', label: 'Préstamos Doc' },
  { value: 'devolucionesDoc', label: 'Devoluciones Doc' },
  { value: 'prorrogasDoc', label: 'Prórrogas Doc' },
];

const PERSONAL_OPTIONS: { value: ReportType; label: string }[] = [
  { value: '', label: 'Seleccione un reporte...' },
  { value: 'carpetas', label: 'Carpetas' },
  { value: 'prestamos', label: 'Préstamos' },
  { value: 'devoluciones', label: 'Devoluciones' },
  { value: 'incidentes', label: 'Incidentes' },
  { value: 'traspasos', label: 'Traspasos' },
  { value: 'prorrogas', label: 'Prórrogas' },
  { value: 'retiros', label: 'Retiros' },
  { value: 'bloqueos', label: 'Bloqueos' },
  { value: 'personas', label: 'Personas' },
  { value: 'prestamosDoc', label: 'Préstamos Doc' },
  { value: 'devolucionesDoc', label: 'Devoluciones Doc' },
  { value: 'prorrogasDoc', label: 'Prórrogas Doc' },
];

function formatDate(dateStr: string) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function mapEstado(estado: string): string {
  if (estado === 'buen_estado') return 'Buen estado';
  if (estado === 'mal_estado') return 'Mal estado';
  if (estado === 'dañado') return 'Dañado';
  return estado;
}

interface PaginatedItems { items: Record<string, unknown>[]; totalCount: number }

export default function ReportesPage() {
  const client = useApolloClient();
  const { user } = useAuth();
  const { hasPerm, isAdmin } = usePermission();
  const esConsultor = user?.groups?.some(g => g.name === 'Consultor') ?? false;
  const puedeVerGenerales = isAdmin || esConsultor;
  const [modo, setModo] = useState<ModoReporte>(puedeVerGenerales ? 'general' : 'personal');
  const [reportType, setReportType] = useState<ReportType>('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [firmaPreview, setFirmaPreview] = useState<string | null>(null);

  const isPersonal = !puedeVerGenerales || modo === 'personal';
  const options = isPersonal ? PERSONAL_OPTIONS : REPORT_OPTIONS;
  const usuarioId = isPersonal ? user?.id : undefined;

  const pagVars = { page: currentPage, pageSize: PAGE_SIZE };

  const { data: carpetasData, loading: loadingCarpetas } = useQuery<{ allCarpetasPaginated: PaginatedItems }>(GET_ALL_CARPETAS_PAGINATED, {
    skip: reportType !== 'carpetas',
    variables: { ...pagVars, ambienteId: undefined, search: appliedSearch || undefined, fechaDesde: dateFrom || undefined, fechaHasta: dateTo || undefined },
  });
  const { data: prestamosData, loading: loadingPrestamos } = useQuery<{ allPrestamosPaginated: PaginatedItems }>(GET_ALL_PRESTAMOS_PAGINATED, {
    skip: reportType !== 'prestamos',
    variables: { ...pagVars, search: appliedSearch || undefined, usuarioId, fechaDesde: dateFrom || undefined, fechaHasta: dateTo || undefined },
  });
  const { data: devolucionesData, loading: loadingDevoluciones } = useQuery<{ allDevolucionesPaginated: PaginatedItems }>(GET_ALL_DEVOLUCIONES_PAGINATED, {
    skip: reportType !== 'devoluciones',
    variables: { ...pagVars, search: appliedSearch || undefined, usuarioId, fechaDesde: dateFrom || undefined, fechaHasta: dateTo || undefined },
  });
  const { data: incidentesData, loading: loadingIncidentes } = useQuery<{ allIncidentesPaginated: PaginatedItems }>(GET_ALL_INCIDENTES_PAGINATED, {
    skip: reportType !== 'incidentes',
    variables: { ...pagVars, search: appliedSearch || undefined, usuarioId, fechaDesde: dateFrom || undefined, fechaHasta: dateTo || undefined },
  });
  const { data: traspasosData, loading: loadingTraspasos } = useQuery<{ allTraspasosPaginated: PaginatedItems }>(GET_ALL_TRASPASOS_PAGINATED, {
    skip: reportType !== 'traspasos',
    variables: { ...pagVars, search: appliedSearch || undefined, usuarioId, fechaDesde: dateFrom || undefined, fechaHasta: dateTo || undefined },
  });
  const { data: prorrogasData, loading: loadingProrrogas } = useQuery<{ allProrrogasPaginated: PaginatedItems }>(GET_ALL_PRORROGAS_PAGINATED, {
    skip: reportType !== 'prorrogas',
    variables: { ...pagVars, search: appliedSearch || undefined, usuarioId, fechaDesde: dateFrom || undefined, fechaHasta: dateTo || undefined },
  });
  const { data: personasData, loading: loadingPersonas } = useQuery<{ allPersonasPaginated: PaginatedItems }>(GET_ALL_PERSONAS_PAGINATED, {
    skip: reportType !== 'personas',
    variables: { ...pagVars, search: appliedSearch || undefined },
  });
  const { data: retirosData, loading: loadingRetiros } = useQuery<{ allRetirosPaginated: PaginatedItems }>(GET_ALL_RETIROS_PAGINATED, {
    skip: reportType !== 'retiros',
    variables: { ...pagVars, search: appliedSearch || undefined, usuarioId, fechaDesde: dateFrom || undefined, fechaHasta: dateTo || undefined },
  });
  const { data: bloqueosData, loading: loadingBloqueos } = useQuery<{ allBloqueosPaginated: PaginatedItems }>(GET_ALL_BLOQUEOS_PAGINATED, {
    skip: reportType !== 'bloqueos',
    variables: { ...pagVars, search: appliedSearch || undefined, usuarioId, fechaDesde: dateFrom || undefined, fechaHasta: dateTo || undefined },
  });
  const { data: prestamosDocData, loading: loadingPrestamosDoc } = useQuery<{ allPrestamosDocPaginated: PaginatedItems }>(GET_ALL_PRESTAMOS_DOC_PAGINATED, {
    skip: reportType !== 'prestamosDoc',
    variables: { ...pagVars, search: appliedSearch || undefined, usuarioId, fechaDesde: dateFrom || undefined, fechaHasta: dateTo || undefined },
  });
  const { data: devolucionesDocData, loading: loadingDevolucionesDoc } = useQuery<{ allDevolucionesDocPaginated: PaginatedItems }>(GET_ALL_DEVOLUCIONES_DOC_PAGINATED, {
    skip: reportType !== 'devolucionesDoc',
    variables: { ...pagVars, search: appliedSearch || undefined, usuarioId, fechaDesde: dateFrom || undefined, fechaHasta: dateTo || undefined },
  });
  const { data: prorrogasDocData, loading: loadingProrrogasDoc } = useQuery<{ allProrrogasDocPaginated: PaginatedItems }>(GET_ALL_PRORROGAS_DOC_PAGINATED, {
    skip: reportType !== 'prorrogasDoc',
    variables: { ...pagVars, search: appliedSearch || undefined, usuarioId, fechaDesde: dateFrom || undefined, fechaHasta: dateTo || undefined },
  });

  const isLoading = loadingCarpetas || loadingPrestamos || loadingDevoluciones || loadingIncidentes || loadingTraspasos || loadingProrrogas || loadingRetiros || loadingPersonas || loadingBloqueos || loadingPrestamosDoc || loadingDevolucionesDoc || loadingProrrogasDoc;

  const paginatedResult = useMemo(() => {
    switch (reportType) {
      case 'carpetas': return carpetasData?.allCarpetasPaginated;
      case 'prestamos': return prestamosData?.allPrestamosPaginated;
      case 'devoluciones': return devolucionesData?.allDevolucionesPaginated;
      case 'incidentes': return incidentesData?.allIncidentesPaginated;
      case 'traspasos': return traspasosData?.allTraspasosPaginated;
      case 'prorrogas': return prorrogasData?.allProrrogasPaginated;
      case 'retiros': return retirosData?.allRetirosPaginated;
      case 'bloqueos': return bloqueosData?.allBloqueosPaginated;
      case 'personas': return personasData?.allPersonasPaginated;
      case 'prestamosDoc': return prestamosDocData?.allPrestamosDocPaginated;
      case 'devolucionesDoc': return devolucionesDocData?.allDevolucionesDocPaginated;
      case 'prorrogasDoc': return prorrogasDocData?.allProrrogasDocPaginated;
      default: return null;
    }
  }, [reportType, carpetasData, prestamosData, devolucionesData, incidentesData, traspasosData, prorrogasData, retirosData, personasData, bloqueosData, prestamosDocData, devolucionesDocData, prorrogasDocData]);

  const totalCount = paginatedResult?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const applyLocalFilters = useCallback((items: any[]) => {
    let result = items;
    if (appliedSearch) {
      const q = appliedSearch.toLowerCase();
      result = result.filter((item: any) => JSON.stringify(item).toLowerCase().includes(q));
    }
    return result;
  }, [appliedSearch]);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const filteredItems = useMemo(() => {
    return applyLocalFilters(paginatedResult?.items ?? []);
  }, [paginatedResult, applyLocalFilters]);

  const columns = useMemo(() => {
    switch (reportType) {
      case 'carpetas':
        return ['Descripción', 'Fecha Creación', 'Estado', 'Ambiente', 'Estante', 'Piso'];
      case 'prestamos':
        return ['Persona CI', 'Persona Nombre', 'Fecha Préstamo', 'Fecha de devolución', 'Usuario', 'Carpetas', 'Estado'];
      case 'devoluciones':
        return ['Fecha Devolución', 'Carpeta', 'Usuario', 'Estado', 'Observaciones', 'Foto Firma'];
      case 'incidentes':
        return ['Tipo', 'Fecha Reporte', 'Estado', 'Usuario', 'Descripción', 'Carpeta'];
      case 'traspasos':
        return ['Fecha', 'Origen', 'Destino', 'Usuario', 'Carpetas'];
      case 'prorrogas':
        return ['Fecha Registro', 'Días', 'Motivo', 'Persona'];
      case 'retiros':
        return ['Carpeta', 'Persona', 'Autorizado por', 'Fecha Retiro', 'Motivo', 'Usuario'];
      case 'bloqueos':
        return ['CI', 'Persona', 'Fecha Bloqueo', 'Motivo', 'Fecha Desbloqueo', 'Motivo Desbloqueo', 'Bloqueado por', 'Desbloqueado por'];
      case 'personas':
        return ['CI', 'Nombre', 'Apellido', 'Teléfono', 'Email', 'Cargo'];
      case 'prestamosDoc':
        return ['Persona', 'CI', 'Fecha Préstamo', 'Fecha Devolución', 'Documentos', 'Estado'];
      case 'devolucionesDoc':
        return ['Persona', 'CI', 'Documento', 'Fecha Devolución', 'Estado', 'Observaciones', 'Usuario'];
      case 'prorrogasDoc':
        return ['Persona', 'CI', 'Días', 'Motivo', 'Fecha Registro', 'Usuario'];
      default:
        return [];
    }
  }, [reportType]);

  const rows = useMemo((): React.ReactNode[][] => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    return filteredItems.map((item: any) => {
      switch (reportType) {
        case 'carpetas': {
          const piso = item.piso;
          const estante = piso?.estante;
          const ambiente = estante?.ambiente;
          return [
            item.descripcion ?? '-',
            formatDate(item.fechaCrea),
            item.estado ?? '-',
            ambiente?.nombre ?? '-',
            estante?.codigo ?? '-',
            `Fila ${piso?.nroFila ?? '-'}`,
          ];
        }
        case 'prestamos': {
          const persona = item.persona;
          const carpetas = (item.carpetas ?? []).map((c: any) => c.descripcion).join(', ');
          const estados = (() => {
            const pcs = item.prestamoCarpetas ?? [];
            if (pcs.length === 0) return 'Pendiente';
            if (pcs.some((pc: any) => pc.estado === 'prestado')) return 'Pendiente';
            return 'Completado';
          })();
          return [
            persona?.ci ?? '-',
            `${persona?.nombre ?? ''} ${persona?.apellido ?? ''}`.trim() || '-',
            formatDate(item.fechaPrest),
            formatDate(item.fechaDevolucion),
            item.usuario?.username ?? '-',
            carpetas || '-',
            estados,
          ];
        }
        case 'devoluciones': {
          const pc = item.prestamoCarpeta;
          const token = item.tokenFirma;
          return [
            formatDate(item.fechaDevol),
            pc?.carpeta?.descripcion ?? '-',
            item.usuario?.username ?? '-',
            mapEstado(item.estadoDevolucion) ?? '-',
            item.observaciones ?? '-',
            token ? (
              <button
                onClick={() => setFirmaPreview(token)}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-100 dark:bg-brand-dark-600/30 text-brand-600 dark:text-brand-dark-400 hover:bg-brand-200 dark:hover:bg-brand-dark-600/50 transition-colors"
                title="Ver firma"
              >
                <Eye size={16} />
              </button>
            ) : 'No',
          ];
        }
        case 'incidentes': {
          const descs = (item.detalles ?? []).map((d: any) => d.descripcion).join('; ');
          const carpets = (item.detalles ?? []).map((d: any) => d.carpeta?.descripcion).filter(Boolean).join(', ');
          return [
            item.tipoInci ?? '-',
            formatDate(item.fechaReporte),
            item.estado ?? '-',
            item.usuario?.username ?? '-',
            descs || '-',
            carpets || '-',
          ];
        }
        case 'traspasos': {
          const itemsStr = (item.items ?? []).map((i: any) => i.carpeta?.descripcion).filter(Boolean).join(', ');
          return [
            formatDate(item.fecha),
            item.ambienteOrigen?.nombre ?? '-',
            item.ambienteDestino?.nombre ?? '-',
            item.usuario?.username ?? '-',
            itemsStr || '-',
          ];
        }
        case 'prorrogas': {
          const prestamo = item.prestamo;
          const persona = prestamo?.persona;
          return [
            formatDate(item.fechaRegistro),
            item.diasOtorgados ?? '-',
            item.motivo ?? '-',
            persona ? `${persona.nombre ?? ''} ${persona.apellido ?? ''}`.trim() : '-',
          ];
        }
        case 'retiros': {
          const carpeta = item.carpeta;
          const personaR = item.persona;
          const autorizado = item.autorizadoPor;
          const motivoStr = item.motivo === 'traslado' ? 'Traslado' : item.motivo === 'retiro_indefinido' ? 'Retiro Indefinido' : `Otro${item.motivoOtro ? ': ' + item.motivoOtro : ''}`;
          return [
            carpeta?.descripcion ?? '-',
            personaR ? `${personaR.nombre ?? ''} ${personaR.apellido ?? ''}`.trim() : '-',
            autorizado ? `${autorizado.nombre ?? ''} ${autorizado.apellido ?? ''}`.trim() : '-',
            formatDate(item.fechaRetiro),
            motivoStr,
            item.usuario ? `${item.usuario.firstName ?? ''} ${item.usuario.lastName ?? ''}`.trim() : '-',
          ];
        }
        case 'bloqueos': {
          const pers = item.persona;
          return [
            pers?.ci ?? '-',
            pers ? `${pers.nombre ?? ''} ${pers.apellido ?? ''}`.trim() : '-',
            formatDate(item.fechaBloq),
            item.motivoBloq ?? '-',
            item.fechaDesbloq ? formatDate(item.fechaDesbloq) : '-',
            item.motivoDesbloq ?? '-',
            item.usuario ? `${item.usuario.firstName ?? ''} ${item.usuario.lastName ?? ''}`.trim() : '-',
            item.usuarioDesbloqueo ? `${item.usuarioDesbloqueo.firstName ?? ''} ${item.usuarioDesbloqueo.lastName ?? ''}`.trim() : '-',
          ];
        }
        case 'personas':
          return [
            item.ci ?? '-',
            item.nombre ?? '-',
            item.apellido ?? '-',
            item.telefono ?? '-',
            item.email ?? '-',
            item.cargo ?? '-',
          ];
        default:
          return [];
      }
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }, [filteredItems, reportType]);

  const reportTitle = REPORT_OPTIONS.find(o => o.value === reportType)?.label ?? '';

  const fetchAllForExport = useCallback(async (): Promise<{ items: Record<string, unknown>[]; total: number } | null> => {
    setExporting(true);
    try {
      let allData: Record<string, unknown>[];
      const exportVars = usuarioId ? { usuarioId } : {};
      switch (reportType) {
        case 'carpetas': {
          const r = await client.query<{ allCarpetas: Record<string, unknown>[] }>({ query: GET_ALL_CARPETAS, fetchPolicy: 'network-only' });
          allData = r.data?.allCarpetas ?? [];
          break;
        }
        case 'prestamos': {
          const r = await client.query<{ allPrestamos: Record<string, unknown>[] }>({ query: GET_ALL_PRESTAMOS, variables: exportVars, fetchPolicy: 'network-only' });
          allData = r.data?.allPrestamos ?? [];
          break;
        }
        case 'devoluciones': {
          const r = await client.query<{ allDevoluciones: Record<string, unknown>[] }>({ query: GET_ALL_DEVOLUCIONES, variables: exportVars, fetchPolicy: 'network-only' });
          allData = r.data?.allDevoluciones ?? [];
          break;
        }
        case 'incidentes': {
          const r = await client.query<{ allIncidentes: Record<string, unknown>[] }>({ query: GET_ALL_INCIDENTES, variables: exportVars, fetchPolicy: 'network-only' });
          allData = r.data?.allIncidentes ?? [];
          break;
        }
        case 'traspasos': {
          const r = await client.query<{ allTraspasos: Record<string, unknown>[] }>({ query: GET_ALL_TRASPASOS, variables: exportVars, fetchPolicy: 'network-only' });
          allData = r.data?.allTraspasos ?? [];
          break;
        }
        case 'prorrogas': {
          const r = await client.query<{ allProrrogasPaginated: { items: Record<string, unknown>[] } }>({ query: GET_ALL_PRORROGAS_PAGINATED, variables: { page: 1, pageSize: 9999, ...exportVars }, fetchPolicy: 'network-only' });
          allData = r.data?.allProrrogasPaginated?.items ?? [];
          break;
        }
        case 'retiros': {
          const r = await client.query<{ allRetiros: Record<string, unknown>[] }>({ query: GET_ALL_RETIROS, variables: exportVars, fetchPolicy: 'network-only' });
          allData = r.data?.allRetiros ?? [];
          break;
        }
        case 'bloqueos': {
          const r = await client.query<{ allBloqueos: Record<string, unknown>[] }>({ query: GET_ALL_BLOQUEOS, variables: exportVars, fetchPolicy: 'network-only' });
          allData = r.data?.allBloqueos ?? [];
          break;
        }
        case 'personas': {
          const r = await client.query<{ allPersonas: Record<string, unknown>[] }>({ query: GET_ALL_PERSONAS, fetchPolicy: 'network-only' });
          allData = r.data?.allPersonas ?? [];
          break;
        }
        case 'prestamosDoc': {
          const r = await client.query<{ allPrestamosDocPaginated: { items: Record<string, unknown>[] } }>({ query: GET_ALL_PRESTAMOS_DOC_PAGINATED, variables: { page: 1, pageSize: 9999, ...exportVars }, fetchPolicy: 'network-only' });
          allData = r.data?.allPrestamosDocPaginated?.items ?? [];
          break;
        }
        case 'devolucionesDoc': {
          const r = await client.query<{ allDevolucionesDocPaginated: { items: Record<string, unknown>[] } }>({ query: GET_ALL_DEVOLUCIONES_DOC_PAGINATED, variables: { page: 1, pageSize: 9999, ...exportVars }, fetchPolicy: 'network-only' });
          allData = r.data?.allDevolucionesDocPaginated?.items ?? [];
          break;
        }
        case 'prorrogasDoc': {
          const r = await client.query<{ allProrrogasDocPaginated: { items: Record<string, unknown>[] } }>({ query: GET_ALL_PRORROGAS_DOC_PAGINATED, variables: { page: 1, pageSize: 9999, ...exportVars }, fetchPolicy: 'network-only' });
          allData = r.data?.allProrrogasDocPaginated?.items ?? [];
          break;
        }
        default:
          return null;
      }
      return { items: allData, total: allData.length };
    } catch (err) {
      console.error('Error fetching export data:', err);
      return null;
    }
  }, [reportType, client, usuarioId]);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const buildExportRows = useCallback((allItems: any[]) => {
    return allItems.map((item: any) => {
      switch (reportType) {
        case 'carpetas': {
          const piso = item.piso;
          const estante = piso?.estante;
          const ambiente = estante?.ambiente;
          return [item.descripcion ?? '-', formatDate(item.fechaCrea), item.estado ?? '-', ambiente?.nombre ?? '-', estante?.codigo ?? '-', `Fila ${piso?.nroFila ?? '-'}`];
        }
        case 'prestamos': {
          const persona = item.persona;
          const carpetas = (item.carpetas ?? []).map((c: any) => c.descripcion).join(', ');
          const estados = (() => {
            const pcs = item.prestamoCarpetas ?? [];
            if (pcs.length === 0) return 'Pendiente';
            if (pcs.some((pc: any) => pc.estado === 'prestado')) return 'Pendiente';
            return 'Completado';
          })();
          return [persona?.ci ?? '-', `${persona?.nombre ?? ''} ${persona?.apellido ?? ''}`.trim() || '-', formatDate(item.fechaPrest), formatDate(item.fechaDevolucion), item.usuario?.username ?? '-', carpetas || '-', estados];
        }
        case 'devoluciones': {
          const pc = item.prestamoCarpeta;
          return [formatDate(item.fechaDevol), pc?.carpeta?.descripcion ?? '-', item.usuario?.username ?? '-', mapEstado(item.estadoDevolucion) ?? '-', item.observaciones ?? '-', item.tokenFirma ? 'Sí' : 'No'];
        }
        case 'incidentes': {
          const descs = (item.detalles ?? []).map((d: any) => d.descripcion).join('; ');
          const carpets = (item.detalles ?? []).map((d: any) => d.carpeta?.descripcion).filter(Boolean).join(', ');
          return [item.tipoInci ?? '-', formatDate(item.fechaReporte), item.estado ?? '-', item.usuario?.username ?? '-', descs || '-', carpets || '-'];
        }
        case 'traspasos': {
          const itemsStr = (item.items ?? []).map((i: any) => i.carpeta?.descripcion).filter(Boolean).join(', ');
          return [formatDate(item.fecha), item.ambienteOrigen?.nombre ?? '-', item.ambienteDestino?.nombre ?? '-', item.usuario?.username ?? '-', itemsStr || '-'];
        }
        case 'prorrogas': {
          const prestamo = item.prestamo;
          const persona = prestamo?.persona;
          return [formatDate(item.fechaRegistro), item.diasOtorgados ?? '-', item.motivo ?? '-', persona ? `${persona.nombre ?? ''} ${persona.apellido ?? ''}`.trim() : '-'];
        }
        case 'retiros': {
          const carpeta = item.carpeta;
          const personaR = item.persona;
          const autorizado = item.autorizadoPor;
          const motivoStr = item.motivo === 'traslado' ? 'Traslado' : item.motivo === 'retiro_indefinido' ? 'Retiro Indefinido' : `Otro${item.motivoOtro ? ': ' + item.motivoOtro : ''}`;
          return [carpeta?.descripcion ?? '-', personaR ? `${personaR.nombre ?? ''} ${personaR.apellido ?? ''}`.trim() : '-', autorizado ? `${autorizado.nombre ?? ''} ${autorizado.apellido ?? ''}`.trim() : '-', formatDate(item.fechaRetiro), motivoStr, item.usuario ? `${item.usuario.firstName ?? ''} ${item.usuario.lastName ?? ''}`.trim() : '-'];
        }
        case 'bloqueos': {
          const pers = item.persona;
          return [pers?.ci ?? '-', pers ? `${pers.nombre ?? ''} ${pers.apellido ?? ''}`.trim() : '-', formatDate(item.fechaBloq), item.motivoBloq ?? '-', item.fechaDesbloq ? formatDate(item.fechaDesbloq) : '-', item.motivoDesbloq ?? '-', item.usuario ? `${item.usuario.firstName ?? ''} ${item.usuario.lastName ?? ''}`.trim() : '-', item.usuarioDesbloqueo ? `${item.usuarioDesbloqueo.firstName ?? ''} ${item.usuarioDesbloqueo.lastName ?? ''}`.trim() : '-'];
        }
        case 'personas':
          return [item.ci ?? '-', item.nombre ?? '-', item.apellido ?? '-', item.telefono ?? '-', item.email ?? '-', item.cargo ?? '-'];
        case 'prestamosDoc': {
          const persona = item.persona;
          const docs = (item.items ?? []).map((i: any) => i.documento?.codigoDoc ?? i.documento?.titulo ?? '-').join(', ');
          const allReturned = (item.items ?? []).every((i: any) => i.estado === 'devuelto');
          return [
            persona ? `${persona.nombre ?? ''} ${persona.apellido ?? ''}`.trim() : '-',
            persona?.ci ?? '-',
            formatDate(item.fechaPrest),
            formatDate(item.fechaDevolucion),
            docs || '-',
            allReturned ? 'Completado' : 'Activo',
          ];
        }
        case 'devolucionesDoc': {
          const docItem = item.prestamoDocItem;
          const persona = docItem?.prestamoDoc?.persona;
          return [
            persona ? `${persona.nombre ?? ''} ${persona.apellido ?? ''}`.trim() : '-',
            persona?.ci ?? '-',
            docItem?.documento ? `${docItem.documento.codigoDoc ?? ''} — ${docItem.documento.titulo ?? ''}` : '-',
            formatDate(item.fechaDevol),
            mapEstado(item.estadoDevolucion) ?? '-',
            item.observaciones ?? '-',
            item.usuario ? `${item.usuario.firstName ?? ''} ${item.usuario.lastName ?? ''}`.trim() : '-',
          ];
        }
        case 'prorrogasDoc': {
          const persona = item.prestamoDoc?.persona;
          return [
            persona ? `${persona.nombre ?? ''} ${persona.apellido ?? ''}`.trim() : '-',
            persona?.ci ?? '-',
            item.diasOtorgados ?? '-',
            item.motivo ?? '-',
            formatDate(item.fechaRegistro),
            item.usuario ? `${item.usuario.firstName ?? ''} ${item.usuario.lastName ?? ''}`.trim() : '-',
          ];
        }
        default:
          return [];
      }
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }, [reportType]);

  const exportExcel = async () => {
    const result = await fetchAllForExport();
    if (!result || !result.items.length) return;
    const filteredExport = applyLocalFilters(result.items);
    const dataRows = buildExportRows(filteredExport);
    const data = dataRows.map((row) => {
      const obj: Record<string, string> = {};
      columns.forEach((col, i) => { obj[col] = row[i] ?? ''; });
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, reportTitle);
    XLSX.writeFile(wb, `Reporte_${reportTitle}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    setExporting(false);
  };

  const exportPdf = async () => {
    const result = await fetchAllForExport();
    if (!result || !result.items.length) {
      setExporting(false);
      return;
    }
    const filteredExport = applyLocalFilters(result.items);
    const dataRows = buildExportRows(filteredExport);
    try {
      const doc = new jsPDF('landscape');
      let y = 22;
      doc.setFontSize(16);
      doc.text(`Reporte: ${reportTitle}`, 14, y); y += 8;
      doc.setFontSize(10);
      doc.text(`Generado: ${new Date().toLocaleString('es-ES')}`, 14, y);
      autoTable(doc, {
        head: [columns],
        body: dataRows,
        startY: y + 8,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [79, 70, 229] },
      });
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      window.open(url, '_blank');
    } catch (err) {
      console.error('Error generating PDF:', err);
    }
    setExporting(false);
  };

  const handleTypeChange = (val: string) => {
    setReportType(val as ReportType);
    setSearch('');
    setAppliedSearch('');
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
  };

  const handleModoChange = (nuevo: ModoReporte) => {
    if (nuevo === modo) return;
    setModo(nuevo);
    setReportType('');
    setSearch('');
    setAppliedSearch('');
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-800 dark:text-navy-200">Reportes</h1>
          <p className="text-surface-500 dark:text-navy-400 text-sm mt-1">
            {!puedeVerGenerales
              ? 'Consulte y exporte sus registros personales'
              : isPersonal
                ? 'Consulte y exporte sus propios registros'
                : 'Genere y exporte reportes del sistema'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-12 h-12 rounded-xl bg-brand-100 dark:bg-brand-dark-600/20 flex items-center justify-center text-brand-600 dark:text-brand-dark-400">
            {isPersonal ? <User size={24} /> : <BarChart3 size={24} />}
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="flex gap-1 bg-white/40 dark:bg-navy-800/40 rounded-xl p-1 backdrop-blur-sm border border-white/30 dark:border-navy-700/30 w-fit">
          <button
            onClick={() => handleModoChange('general')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              !isPersonal
                ? 'bg-white dark:bg-navy-700 text-brand-600 dark:text-brand-dark-300 shadow-sm'
                : 'text-surface-500 dark:text-navy-400 hover:text-surface-700 dark:hover:text-navy-200'
            }`}
          >
            <BarChart3 size={16} className="inline mr-1.5" />
            Generales
          </button>
          <button
            onClick={() => handleModoChange('personal')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              isPersonal
                ? 'bg-white dark:bg-navy-700 text-brand-600 dark:text-brand-dark-300 shadow-sm'
                : 'text-surface-500 dark:text-navy-400 hover:text-surface-700 dark:hover:text-navy-200'
            }`}
          >
            <User size={16} className="inline mr-1.5" />
            Personales
          </button>
        </div>
      )}

      <div className="glass-panel rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-surface-600 dark:text-navy-400 mb-1">
              Tipo de Reporte
            </label>
            <select
              value={reportType}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/50 dark:bg-navy-800/50 border border-white/40 dark:border-navy-700/40 focus:outline-none focus:ring-2 focus:ring-brand-400/50 text-surface-800 dark:text-navy-200"
            >
              {options.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.value === ''}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {reportType && reportType !== 'personas' && (
            <>
              <div>
                <label className="block text-sm font-medium text-surface-600 dark:text-navy-400 mb-1">
                  <Calendar size={14} className="inline mr-1" />
                  Desde
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/50 dark:bg-navy-800/50 border border-white/40 dark:border-navy-700/40 focus:outline-none focus:ring-2 focus:ring-brand-400/50 text-surface-800 dark:text-navy-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-600 dark:text-navy-400 mb-1">
                  <Calendar size={14} className="inline mr-1" />
                  Hasta
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/50 dark:bg-navy-800/50 border border-white/40 dark:border-navy-700/40 focus:outline-none focus:ring-2 focus:ring-brand-400/50 text-surface-800 dark:text-navy-200"
                />
              </div>
            </>
          )}

          {reportType && (
            <div>
              <label className="block text-sm font-medium text-surface-600 dark:text-navy-400 mb-1">
                <Search size={14} className="inline mr-1" />
                Buscar
              </label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { setAppliedSearch(search); setCurrentPage(1); } }}
                placeholder="Buscar y presione Enter..."
                className="w-full px-3 py-2.5 rounded-xl bg-white/50 dark:bg-navy-800/50 border border-white/40 dark:border-navy-700/40 focus:outline-none focus:ring-2 focus:ring-brand-400/50 text-surface-800 dark:text-navy-200"
              />
            </div>
          )}
        </div>
      </div>

      {!reportType && (
        <div className="glass-panel rounded-2xl p-12 flex flex-col items-center justify-center text-surface-400 dark:text-navy-500">
          <BarChart3 size={64} className="mb-4 opacity-40" />
          <p className="text-lg font-medium">Seleccione un tipo de reporte</p>
          <p className="text-sm">Elija una opción arriba para visualizar y exportar datos</p>
        </div>
      )}

      {reportType && (
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-surface-800 dark:text-navy-200">
              {isPersonal ? `Mis ${reportTitle.toLowerCase()}` : reportTitle}
              <span className="ml-2 text-sm font-normal text-surface-500 dark:text-navy-400">
                {isLoading
                  ? ' (cargando...)'
                  : ` (pág. ${currentPage} de ${totalPages} — ${totalCount} registros)`}
              </span>
            </h2>
            <div className="flex gap-2">
              <button
                onClick={exportExcel}
                disabled={!totalCount || exporting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
              >
                <FileSpreadsheet size={16} />
                {exporting ? 'Procesando...' : 'Excel'}
              </button>
              <button
                onClick={exportPdf}
                disabled={!totalCount || exporting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
              >
                <FileText size={16} />
                {exporting ? 'Procesando...' : 'PDF'}
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-surface-400 dark:text-navy-500">
              No se encontraron registros para este reporte.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/30 dark:border-navy-700/30">
                      {columns.map((col) => (
                        <th
                          key={col}
                          className="text-left px-3 py-3 font-semibold text-surface-600 dark:text-navy-400 whitespace-nowrap"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-white/20 dark:border-navy-700/20 hover:bg-white/30 dark:hover:bg-navy-800/30 transition-colors"
                      >
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className="px-3 py-2.5 text-surface-700 dark:text-navy-300 whitespace-nowrap max-w-xs truncate"
                            title={typeof cell === 'string' ? cell : undefined}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/30 dark:border-navy-700/30">
                <span className="text-sm text-surface-500 dark:text-navy-500">
                  Mostrando página {currentPage} de {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/50 dark:bg-navy-800/50 border border-white/40 dark:border-navy-700/40 disabled:opacity-30 disabled:cursor-not-allowed text-surface-600 dark:text-navy-400 hover:bg-white dark:hover:bg-navy-800 transition-colors text-sm"
                  >
                    <ChevronLeft size={16} />
                    Anterior
                  </button>

                  {totalPages <= 7
                    ? Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                        <button
                          key={pg}
                          onClick={() => setCurrentPage(pg)}
                          className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                            pg === currentPage
                              ? 'bg-brand-600 text-white'
                              : 'bg-white/50 dark:bg-navy-800/50 text-surface-600 dark:text-navy-400 hover:bg-white dark:hover:bg-navy-800'
                          }`}
                        >
                          {pg}
                        </button>
                      ))
                    : (() => {
                        const pages: (number | '...')[] = [];
                        pages.push(1);
                        if (currentPage > 3) pages.push('...');
                        for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
                          pages.push(i);
                        }
                        if (currentPage < totalPages - 2) pages.push('...');
                        pages.push(totalPages);
                        return pages.map((pg, i) =>
                          pg === '...' ? (
                            <span key={`e${i}`} className="text-surface-400 dark:text-navy-500 px-1">...</span>
                          ) : (
                            <button
                              key={pg}
                              onClick={() => setCurrentPage(pg)}
                              className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                                pg === currentPage
                                  ? 'bg-brand-600 text-white'
                                  : 'bg-white/50 dark:bg-navy-800/50 text-surface-600 dark:text-navy-400 hover:bg-white dark:hover:bg-navy-800'
                              }`}
                            >
                              {pg}
                            </button>
                          )
                        );
                      })()}

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/50 dark:bg-navy-800/50 border border-white/40 dark:border-navy-700/40 disabled:opacity-30 disabled:cursor-not-allowed text-surface-600 dark:text-navy-400 hover:bg-white dark:hover:bg-navy-800 transition-colors text-sm"
                  >
                    Siguiente
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
      {firmaPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setFirmaPreview(null)}>
          <div className="relative max-w-3xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="glass-panel rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-surface-800 dark:text-navy-200">Firma</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const printWin = window.open('', '_blank');
                      if (printWin) {
                        printWin.document.write(`
                          <html><head><title>Firma</title>
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
                alt="Firma"
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
