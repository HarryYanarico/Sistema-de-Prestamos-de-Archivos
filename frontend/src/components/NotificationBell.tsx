import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation } from '@apollo/client/react';
import { Bell, AlertTriangle, Clock, ArrowLeftRight, RotateCcw, Ban, FileText, Info } from 'lucide-react';
import { GET_NOTIFICATIONS, MARCAR_NOTIFICACIONES_LEIDAS } from '../lib/queries';
import { useNavigate } from 'react-router-dom';
import { formatDate } from '../utils/formatDate';

const iconMap: Record<string, typeof AlertTriangle> = {
  VENCIMIENTO: Clock,
  PROXIMO_VENCER: Clock,
  TRASPASO: ArrowLeftRight,
  INCIDENTE: AlertTriangle,
  DEVOLUCION_ESTADO: RotateCcw,
  BLOQUEO: Ban,
};

const colorMap: Record<string, string> = {
  VENCIMIENTO: 'text-red-500 dark:text-red-400',
  PROXIMO_VENCER: 'text-amber-500 dark:text-amber-400',
  TRASPASO: 'text-blue-500 dark:text-blue-400',
  INCIDENTE: 'text-orange-500 dark:text-orange-400',
  DEVOLUCION_ESTADO: 'text-purple-500 dark:text-purple-400',
  BLOQUEO: 'text-rose-500 dark:text-rose-400',
};

export default function NotificationBell() {
  const { data, refetch } = useQuery(GET_NOTIFICATIONS, { pollInterval: 30000 });
  const [marcarLeidas] = useMutation(MARCAR_NOTIFICACIONES_LEIDAS);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const notifications: { id: string; tipo: string; mensaje: string; link: string; fecha: string; leido: boolean }[] = data?.notifications ?? [];
  const unread = notifications.filter((n) => !n.leido);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('click', handleClick);
    }
    return () => document.removeEventListener('click', handleClick);
  }, [open]);

  const handleToggle = useCallback(() => {
    if (!open) {
      const unreadIds = notifications.filter((n) => !n.leido).map((n) => n.id);
      if (unreadIds.length > 0) {
        marcarLeidas({ variables: { ids: unreadIds } }).then(() => refetch());
      }

      if (btnRef.current) {
        const rect = btnRef.current.getBoundingClientRect();
        setPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
      }
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [open, notifications, marcarLeidas, refetch]);

  const handleLink = (link: string) => {
    setOpen(false);
    navigate(link);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="w-10 h-10 rounded-xl bg-white/50 dark:bg-navy-800/50 border border-white/40 dark:border-navy-700/40 flex items-center justify-center text-surface-600 dark:text-navy-400 hover:text-brand-600 dark:hover:text-brand-dark-400 hover:bg-white dark:hover:bg-navy-800 transition-colors relative"
        title="Notificaciones"
      >
        <Bell size={20} />
        {unread.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none shadow-lg shadow-red-500/30">
            {unread.length > 99 ? '99+' : unread.length}
          </span>
        )}
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          className="fixed w-80 sm:w-96 max-h-[70vh] flex flex-col rounded-2xl bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl border border-white/50 dark:border-navy-700/50 shadow-2xl z-[100] overflow-hidden"
          style={{ top: pos.top, right: pos.right }}
        >
          <div className="p-4 border-b border-white/20 dark:border-navy-700/20">
            <h3 className="font-bold text-surface-800 dark:text-navy-200 text-sm flex items-center gap-2">
              <Bell size={16} />
              Notificaciones
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-surface-500 dark:text-navy-500">
                <Info size={24} />
                <p className="text-sm">Sin notificaciones</p>
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = iconMap[n.tipo] ?? AlertTriangle;
                const color = colorMap[n.tipo] ?? 'text-surface-500';
                return (
                  <button
                    key={n.id}
                    onClick={() => handleLink(n.link)}
                    className={`w-full text-left flex items-start gap-3 p-3 rounded-xl transition-colors ${
                      n.leido
                        ? 'opacity-60 hover:opacity-100'
                        : 'bg-brand-50/50 dark:bg-brand-dark-600/10'
                    } hover:bg-white/50 dark:hover:bg-navy-800/50 cursor-pointer`}
                  >
                    <div className={`mt-0.5 ${color}`}>
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-surface-700 dark:text-navy-300 leading-snug">{n.mensaje}</p>
                      <p className="text-[10px] text-surface-500 dark:text-navy-500 mt-0.5">{formatDate(n.fecha)}</p>
                    </div>
                    {!n.leido && <span className="w-2 h-2 rounded-full bg-brand-500 dark:bg-brand-dark-400 flex-shrink-0 mt-1.5" />}
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}