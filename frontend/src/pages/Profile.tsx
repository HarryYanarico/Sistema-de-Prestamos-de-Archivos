import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Shield, UserCircle, LogOut, Pencil, X, Check, KeyRound, Calendar, BadgeCheck } from 'lucide-react';
import { ACTUALIZAR_PERFIL } from '../lib/queries';

const roleIcons: Record<string, string> = {
  Administrador: 'bg-gradient-to-tr from-brand-600 to-blue-400 dark:from-brand-dark-500 dark:to-blue-400',
  Archivista: 'bg-gradient-to-tr from-amber-500 to-amber-400 dark:from-amber-600 dark:to-amber-500',
  Operador: 'bg-gradient-to-tr from-indigo-600 to-indigo-400 dark:from-indigo-500 dark:to-indigo-400',
  Consultor: 'bg-gradient-to-tr from-emerald-600 to-emerald-400 dark:from-emerald-500 dark:to-emerald-400',
};

export default function Profile() {
  const { user, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  const [actualizarPerfil] = useMutation<{ actualizarPerfil?: { error?: string } }>(ACTUALIZAR_PERFIL);

  if (!user) return null;

  const primaryRole = user.groups[0]?.name ?? 'Sin rol asignado';
  const gradient = roleIcons[primaryRole] ?? 'bg-gradient-to-tr from-surface-500 to-surface-400 dark:from-navy-600 dark:to-navy-500';

  const humanPermLabel = (perm: string) => {
    const parts = perm.split('.');
    const action = parts[1]?.split('_')[0] ?? '';
    const model = parts[1]?.split('_').slice(1).join(' ') ?? perm;
    const labels: Record<string, string> = { add: 'Crear', change: 'Editar', delete: 'Eliminar', view: 'Ver' };
    return `${labels[action] ?? action} ${model.charAt(0).toUpperCase() + model.slice(1)}`;
  };

  const openEdit = () => {
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setEditError('');
    setEditSuccess('');
    setEditing(true);
  };

  const handleSave = async () => {
    setEditError('');
    setEditSuccess('');
    if (!firstName.trim() || !lastName.trim()) {
      setEditError('Nombre y apellido son obligatorios.');
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      setEditError('Las contraseñas nuevas no coinciden.');
      return;
    }
    try {
      const vars: Record<string, unknown> = {};
      if (firstName !== user.firstName) vars.firstName = firstName.trim();
      if (lastName !== user.lastName) vars.lastName = lastName.trim();
      if (newPassword) {
        vars.currentPassword = currentPassword;
        vars.newPassword = newPassword;
      }
      if (Object.keys(vars).length === 0) {
        setEditing(false);
        return;
      }
      const { data } = await actualizarPerfil({ variables: vars });
      if (data?.actualizarPerfil?.error) throw new Error(data.actualizarPerfil.error);
      setEditSuccess('Perfil actualizado correctamente.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => { setEditing(false); window.location.reload(); }, 1200);
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Error al actualizar');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-surface-800 dark:text-navy-200">Mi Perfil</h2>
        <div className="flex items-center gap-2">
          {!editing && (
            <button onClick={openEdit}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 dark:from-brand-dark-500 dark:to-blue-500 text-white font-medium shadow-md text-sm hover:from-red-700 hover:to-blue-700 dark:hover:from-red-800 dark:hover:to-blue-800 transition-all"
            >
              <Pencil size={16} />
              Editar Perfil
            </button>
          )}
          <button onClick={logout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-red-600 bg-red-50 border border-red-200 dark:bg-red-900/30 dark:border-red-800 hover:bg-red-100 transition-colors text-sm font-medium"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className={`${gradient} px-8 py-10 flex flex-col sm:flex-row items-center sm:items-end gap-5`}>
          <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shadow-lg">
            <UserCircle size={44} />
          </div>
          <div className="text-center sm:text-left">
            <h3 className="text-2xl font-bold text-white">
              {user.firstName} {user.lastName}
            </h3>
            <p className="text-white/80 text-sm mt-0.5">@{user.username}</p>
            <span className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-sm font-semibold border bg-white/20 backdrop-blur-sm text-white border-white/30`}>
              <Shield size={14} />
              {primaryRole}
            </span>
          </div>
        </div>

        {editing ? (
          <div className="p-8 space-y-5">
            {editError && (
              <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm rounded-xl px-4 py-2.5">
                <X size={16} className="shrink-0" />
                {editError}
              </div>
            )}
            {editSuccess && (
              <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-sm rounded-xl px-4 py-2.5">
                <Check size={16} className="shrink-0" />
                {editSuccess}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-navy-300 mb-1.5">Nombre *</label>
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400/50 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-navy-300 mb-1.5">Apellido *</label>
                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400/50 transition-all" />
              </div>
            </div>

            <div className="border-t border-white/20 dark:border-navy-700/30 pt-5">
              <h4 className="text-sm font-semibold text-surface-700 dark:text-navy-300 mb-3 flex items-center gap-2">
                <KeyRound size={16} />
                Cambiar contraseña (opcional)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-navy-300 mb-1.5">Contraseña actual</label>
                  <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400/50 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-navy-300 mb-1.5">Nueva contraseña</label>
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400/50 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-navy-300 mb-1.5">Confirmar nueva contraseña</label>
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400/50 transition-all" />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setEditing(false)}
                className="px-5 py-2.5 rounded-xl text-surface-600 dark:text-navy-400 bg-white/60 dark:bg-navy-800/60 border border-white/80 dark:border-navy-700/60 hover:bg-white dark:hover:bg-navy-800 transition-colors text-sm font-medium">
                Cancelar
              </button>
              <button onClick={handleSave}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 dark:from-brand-dark-500 dark:to-blue-500 text-white font-medium shadow-md shadow-brand-500/30 dark:shadow-brand-dark-600/20 hover:shadow-lg transition-all text-sm">
                Guardar Cambios
              </button>
            </div>
          </div>
        ) : (
          <div className="p-8">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-surface-500 dark:text-navy-500 mb-4">
              Información de la cuenta
            </h4>
            <div className="divide-y divide-white/20 dark:divide-navy-700/30">
              <ProfileRow icon={<User size={18} />} label="Nombre de usuario" value={user.username} />
              <ProfileRow icon={<Mail size={18} />} label="Correo electrónico" value={user.email || 'No registrado'} />
              <ProfileRow icon={<BadgeCheck size={18} />} label="Estado" value={user.isActive ? 'Activo' : 'Inactivo'} />
              <ProfileRow icon={<Shield size={18} />} label="Roles" value={user.groups.map((g) => g.name).join(', ') || 'Ninguno'} />
              {user.dateJoined && (
                <ProfileRow icon={<Calendar size={18} />} label="Miembro desde" value={new Date(user.dateJoined).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })} />
              )}
            </div>
          </div>
        )}
      </div>

      {!editing && (
        <div className="glass-panel rounded-2xl p-8">
          <h3 className="text-lg font-bold text-surface-800 dark:text-navy-200 mb-5 flex items-center gap-2">
            <Shield size={20} />
            Permisos asignados
            <span className="text-sm font-normal text-surface-500 dark:text-navy-500">({user.permissionsList.length})</span>
          </h3>
          {(user.permissionsList ?? []).length === 0 ? (
            <p className="text-surface-500 dark:text-navy-500 text-sm">Sin permisos específicos asignados.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {[...(user.permissionsList ?? [])].sort().map((perm) => (
                <div key={perm} className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-surface-50 dark:bg-navy-800 text-sm text-surface-700 dark:text-navy-300">
                  <span className="w-2 h-2 rounded-full bg-brand-500 dark:bg-brand-dark-400 flex-shrink-0" />
                  {humanPermLabel(perm)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProfileRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-4 py-3.5">
      <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-brand-dark-600/20 flex items-center justify-center text-brand-600 dark:text-brand-dark-400 shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-surface-500 dark:text-navy-500">{label}</p>
        <p className="text-surface-800 dark:text-navy-200 font-medium truncate">{value}</p>
      </div>
    </div>
  );
}
