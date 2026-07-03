export function formatDate(iso: string | undefined | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-BO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
