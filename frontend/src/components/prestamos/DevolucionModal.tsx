import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery } from "@apollo/client/react";
import {
  X,
  Search,
  AlertTriangle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { GET_ALL_PRESTAMOS_ACTIVOS_PAGINATED } from "../../lib/queries";

export interface BulkItem {
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
  onClose: () => void;
  onBulkDevolver: (items: BulkItem[]) => void;
  formatDate: (d: string) => string;
  isOverdue: (d: string) => boolean;
}

interface GrupoItem {
  pcId: string;
  carpetaId: string;
  carpetaDesc: string;
}

interface PrestamoGroup {
  prestamoId: string;
  fechaPrest: string;
  fechaDevolucion: string;
  items: GrupoItem[];
}

interface PersonaGroup {
  personaId: string;
  personaNombre: string;
  prestamos: PrestamoGroup[];
}

const ITEMS_PER_PAGE = 5;

export default function DevolucionModal({
  onClose,
  onBulkDevolver,
  formatDate,
  isOverdue,
}: Props) {
  const [page, setPage] = useState(0);
  const { data, loading } = useQuery(GET_ALL_PRESTAMOS_ACTIVOS_PAGINATED, {
    variables: { page: page + 1, pageSize: ITEMS_PER_PAGE },
    fetchPolicy: "network-only",
  });

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [expandedPersonas, setExpandedPersonas] = useState<Set<string>>(() => new Set());

  const rawPrestamos = data?.allPrestamosActivosPaginated?.items ?? [];
  const totalCount = data?.allPrestamosActivosPaginated?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  const gruposPorPersona: PersonaGroup[] = useMemo(() => {
    const map = new Map<string, PersonaGroup>();
    for (const p of rawPrestamos) {
      const personaId = p.persona?.id ?? "";
      const personaNombre = `${p.persona?.nombre ?? ""} ${p.persona?.apellido ?? ""}`.trim();
      const items: GrupoItem[] = (p.prestamoCarpetas ?? [])
        .filter((pc: { estado: string }) => pc.estado === "prestado")
        .map((pc: { id: string; carpeta: { id: string; descripcion: string } }) => ({
          pcId: pc.id,
          carpetaId: pc.carpeta.id,
          carpetaDesc: pc.carpeta.descripcion,
        }));
      if (items.length === 0) continue;
      if (!map.has(personaId)) {
        map.set(personaId, { personaId, personaNombre, prestamos: [] });
      }
      map.get(personaId)!.prestamos.push({
        prestamoId: p.id,
        fechaPrest: p.fechaPrest,
        fechaDevolucion: p.fechaDevolucion,
        items,
      });
    }
    return [...map.values()];
  }, [rawPrestamos]);

  const q = search.toLowerCase();
  const filteredPersonas = useMemo(() => {
    if (!q) return gruposPorPersona;
    return gruposPorPersona
      .map((pg) => {
        const matchNombre = pg.personaNombre.toLowerCase().includes(q);
        const prestamosFiltrados = pg.prestamos
          .map((pr) => {
            const itemsFiltrados = pr.items.filter((i) =>
              i.carpetaDesc.toLowerCase().includes(q),
            );
            return { ...pr, items: itemsFiltrados };
          })
          .filter((pr) => pr.items.length > 0);
        if (matchNombre) return pg;
        if (prestamosFiltrados.length > 0) {
          return { ...pg, prestamos: prestamosFiltrados };
        }
        return null;
      })
      .filter((pg): pg is PersonaGroup => pg !== null);
  }, [gruposPorPersona, q]);

  useEffect(() => {
    if (selected.size === 0) setSelectedPersonaId(null);
  }, [selected]);

  useEffect(() => {
    if (filteredPersonas.length > 0) {
      setExpandedPersonas(new Set(filteredPersonas.map((p) => p.personaId)));
    }
  }, [filteredPersonas]);

  const prestamoAllSelected = useCallback(
    (prestamo: PrestamoGroup) => prestamo.items.every((i) => selected.has(i.pcId)),
    [selected],
  );

  const prestamoSomeSelected = useCallback(
    (prestamo: PrestamoGroup) => prestamo.items.some((i) => selected.has(i.pcId)),
    [selected],
  );

  const personaAllSelected = useCallback(
    (pg: PersonaGroup) =>
      pg.prestamos.every((pr) => pr.items.every((i) => selected.has(i.pcId))),
    [selected],
  );

  const personaSomeSelected = useCallback(
    (pg: PersonaGroup) =>
      pg.prestamos.some((pr) => pr.items.some((i) => selected.has(i.pcId))),
    [selected],
  );

  const handleToggleItem = useCallback(
    (pcId: string, personaId: string) => {
      const isSelected = selected.has(pcId);
      if (selectedPersonaId && selectedPersonaId !== personaId && !isSelected) return;
      if (!selectedPersonaId && !isSelected) setSelectedPersonaId(personaId);
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(pcId)) next.delete(pcId);
        else next.add(pcId);
        return next;
      });
    },
    [selected, selectedPersonaId],
  );

  const handleTogglePrestamo = useCallback(
    (prestamo: PrestamoGroup, personaId: string) => {
      const allSelected = prestamoAllSelected(prestamo);
      if (allSelected) {
        setSelected((prev) => {
          const next = new Set(prev);
          for (const item of prestamo.items) next.delete(item.pcId);
          return next;
        });
        return;
      }
      if (selectedPersonaId && selectedPersonaId !== personaId) return;
      if (!selectedPersonaId) setSelectedPersonaId(personaId);
      setSelected((prev) => {
        const next = new Set(prev);
        for (const item of prestamo.items) next.add(item.pcId);
        return next;
      });
    },
    [prestamoAllSelected, selectedPersonaId],
  );

  const handleTogglePersona = useCallback(
    (pg: PersonaGroup) => {
      const allSelected = personaAllSelected(pg);
      if (allSelected) {
        setSelected((prev) => {
          const next = new Set(prev);
          for (const pr of pg.prestamos) {
            for (const item of pr.items) next.delete(item.pcId);
          }
          return next;
        });
        return;
      }
      if (selectedPersonaId && selectedPersonaId !== pg.personaId) return;
      if (!selectedPersonaId) setSelectedPersonaId(pg.personaId);
      setSelected((prev) => {
        const next = new Set(prev);
        for (const pr of pg.prestamos) {
          for (const item of pr.items) next.add(item.pcId);
        }
        return next;
      });
    },
    [personaAllSelected, selectedPersonaId],
  );

  const toggleExpandPersona = (personaId: string) => {
    setExpandedPersonas((prev) => {
      const next = new Set(prev);
      if (next.has(personaId)) next.delete(personaId);
      else next.add(personaId);
      return next;
    });
  };

  const handleBulkSubmit = () => {
    if (selected.size === 0) return;
    const allItems: BulkItem[] = [];
    for (const pg of gruposPorPersona) {
      for (const pr of pg.prestamos) {
        for (const item of pr.items) {
          if (selected.has(item.pcId)) {
            allItems.push({
              pcId: item.pcId,
              carpetaDesc: item.carpetaDesc,
              carpetaId: item.carpetaId,
              personaNombre: pg.personaNombre,
              personaId: pg.personaId,
              prestamoId: pr.prestamoId,
              fechaPrest: pr.fechaPrest,
              fechaDevolucion: pr.fechaDevolucion,
            });
          }
        }
      }
    }
    onBulkDevolver(allItems);
  };

  const selectedCount = selected.size;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4 pt-8">
      <div className="glass-panel !bg-white/95 dark:!bg-navy-900/95 rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-surface-800 dark:text-navy-200">
              Registrar Devolución
            </h3>
            <p className="text-xs text-surface-600 dark:text-navy-500 mt-0.5">
              {totalCount} carpeta(s) en préstamo
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="relative mb-4">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500 dark:text-navy-500"
            size={16}
          />
          <input
            type="text"
            placeholder="Buscar por persona o carpeta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 placeholder:text-surface-600 dark:placeholder:text-navy-500 focus:outline-none focus:ring-2 focus:ring-brand-400/50 dark:focus:ring-brand-dark-500/50 transition-all text-sm"
          />
        </div>

        {selectedPersonaId && (
          <div className="mb-3 px-4 py-2 rounded-xl bg-brand-50 dark:bg-brand-dark-600/20 border border-brand-200 dark:border-brand-dark-500/30 text-sm text-surface-700 dark:text-navy-300">
            Solo se pueden devolver carpetas de:{" "}
            <strong>{gruposPorPersona.find((g) => g.personaId === selectedPersonaId)?.personaNombre ?? "—"}</strong>
            . Desmarca todo para cambiar de persona.
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin text-brand-600" />
          </div>
        ) : (
          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            {filteredPersonas.length === 0 ? (
              <p className="text-sm text-surface-500 dark:text-navy-500 text-center py-8">
                {search ? "Sin resultados" : "No hay carpetas en préstamo"}
              </p>
            ) : (
              filteredPersonas.map((pg) => {
                const lockDisabled = !!(selectedPersonaId && selectedPersonaId !== pg.personaId);
                const expanded = expandedPersonas.has(pg.personaId);
                const allPerSelected = personaAllSelected(pg);
                const somePerSelected = personaSomeSelected(pg);
                const hasOverdue = pg.prestamos.some((pr) => isOverdue(pr.fechaDevolucion));

                return (
                  <div
                    key={pg.personaId}
                    className={`rounded-xl border overflow-hidden transition-opacity ${
                      lockDisabled ? "opacity-40" : ""
                    } ${
                      hasOverdue
                        ? "border-red-200 dark:border-red-800"
                        : "border-blue-700 dark:border-blue-700"
                    }`}>
                    <div
                      className={`px-4 py-2.5 ${
                        hasOverdue
                          ? "bg-red-50/80 dark:bg-red-900/20"
                          : "bg-surface-50 dark:bg-navy-800"
                      }`}>
                      <div className="flex items-center gap-3">
                        <label className={`flex items-center ${lockDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
                          <input
                            type="checkbox"
                            checked={allPerSelected}
                            disabled={lockDisabled}
                            ref={(el) => {
                              if (el)
                                el.indeterminate = somePerSelected && !allPerSelected;
                            }}
                            onChange={() => handleTogglePersona(pg)}
                            className="w-4 h-4 rounded border-surface-300 text-brand-600 focus:ring-brand-400"
                          />
                        </label>
                        <div
                          className="min-w-0 flex-1 cursor-pointer"
                          onClick={() => toggleExpandPersona(pg.personaId)}>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-surface-800 dark:text-navy-200 text-sm truncate">
                              {pg.personaNombre}
                            </p>
                            <span className="text-xs text-surface-500 dark:text-navy-500">
                              {pg.prestamos.length} préstamo(s)
                            </span>
                            {hasOverdue ? (
                              <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                                <AlertTriangle size={12} /> Vencido
                              </span>
                            ) : (
                              <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                                <Clock size={12} /> Al día
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => toggleExpandPersona(pg.personaId)}
                          className="p-1 rounded-lg text-surface-500 dark:text-navy-500 hover:bg-white/40 dark:hover:bg-navy-700/40 transition-colors">
                          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="divide-y divide-white/10 dark:divide-navy-700/20">
                        {pg.prestamos.map((pr) => {
                          const allPrSelected = prestamoAllSelected(pr);
                          const somePrSelected = prestamoSomeSelected(pr);
                          const overdue = isOverdue(pr.fechaDevolucion);
                          return (
                            <div key={pr.prestamoId} className="px-2 py-2">
                              <div className="flex items-center gap-2 px-2 mb-1">
                                <label className={`flex items-center ${lockDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
                                  <input
                                    type="checkbox"
                                    checked={allPrSelected}
                                    disabled={lockDisabled}
                                    ref={(el) => {
                                      if (el)
                                        el.indeterminate = somePrSelected && !allPrSelected;
                                    }}
                                    onChange={() => handleTogglePrestamo(pr, pg.personaId)}
                                    className="w-4 h-4 rounded border-surface-300 text-brand-600 focus:ring-brand-400"
                                  />
                                </label>
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="font-medium text-surface-700 dark:text-navy-300">
                                    Préstamo: {formatDate(pr.fechaPrest)}
                                  </span>
                                  <span className={`${overdue ? "text-red-600 dark:text-red-400" : "text-surface-600 dark:text-navy-400"}`}>
                                    Límite: {formatDate(pr.fechaDevolucion)}
                                  </span>
                                  <span className="text-surface-500 dark:text-navy-500">
                                    ({pr.items.length} carpeta(s))
                                  </span>
                                </div>
                              </div>
                              <div className="ml-6 space-y-0.5">
                                {pr.items.map((item) => (
                                  <div
                                    key={item.pcId}
                                    onClick={() => handleToggleItem(item.pcId, pg.personaId)}
                                    className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-all text-sm ${
                                      lockDisabled
                                        ? "cursor-not-allowed opacity-60"
                                        : "cursor-pointer hover:bg-brand-50/50 dark:hover:bg-brand-dark-600/10"
                                    }`}>
                                    <input
                                      type="checkbox"
                                      checked={selected.has(item.pcId)}
                                      disabled={lockDisabled}
                                      onChange={() => {}}
                                      className="w-3.5 h-3.5 rounded border-surface-300 text-brand-600 focus:ring-brand-400 pointer-events-none"
                                    />
                                    <span className="font-medium text-surface-800 dark:text-navy-200 flex-1 text-xs">
                                      {item.carpetaDesc}
                                    </span>
                                    {selected.has(item.pcId) ? (
                                      <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                                        A devolver
                                      </span>
                                    ) : (
                                      <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                        Pendiente
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/10 dark:border-navy-700/20">
            <p className="text-xs text-surface-500 dark:text-navy-500">
              Página {page + 1} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 0}
                className="p-1.5 rounded-lg text-surface-500 dark:text-navy-500 hover:bg-white/30 dark:hover:bg-navy-800/50 hover:text-surface-800 dark:hover:text-navy-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-medium text-surface-600 dark:text-navy-400">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg text-surface-500 dark:text-navy-500 hover:bg-white/30 dark:hover:bg-navy-800/50 hover:text-surface-800 dark:hover:text-navy-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/20 dark:border-navy-700/30">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-surface-600 dark:text-navy-400 bg-white/60 dark:bg-navy-800/60 border border-white/80 dark:border-navy-700/60 hover:bg-white dark:hover:bg-navy-800 transition-colors text-sm font-medium">
            Cancelar
          </button>
          <button
            onClick={handleBulkSubmit}
            disabled={selectedCount === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-green-600 to-green-500 dark:from-green-500 dark:to-green-600 text-white font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all text-sm">
            <RotateCcw size={16} />
            Devolver seleccionados ({selectedCount})
          </button>
        </div>
      </div>
    </div>
  );
}
