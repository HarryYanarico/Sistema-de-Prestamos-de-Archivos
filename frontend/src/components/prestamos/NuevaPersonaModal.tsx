import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { X } from 'lucide-react';
import { CREAR_PERSONA, GET_ALL_PERSONAS } from '../../lib/queries';

interface Props {
  show: boolean;
  onClose: () => void;
  onCreated: (personaId: string) => void;
}

export default function NuevaPersonaModal({ show, onClose, onCreated }: Props) {
  const [ci, setCi] = useState('');
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [direccion, setDireccion] = useState('');

  const [error, setError] = useState('');

  const [crearPersona] = useMutation(CREAR_PERSONA, { refetchQueries: [{ query: GET_ALL_PERSONAS }] });

  if (!show) return null;

  const handleSubmit = async () => {
    setError('');
    if (!ci || !nombre || !apellido) { setError('CI, nombre y apellido son obligatorios'); return; }
    try {
      const vars: Record<string, unknown> = { ci, nombre, apellido };
      if (telefono) vars.telefono = telefono;
      if (email) vars.email = email;
      if (direccion) vars.direccion = direccion;
      const { data } = await crearPersona({ variables: vars });
      if (data?.crearPersona?.error) throw new Error(data.crearPersona.error);
      onCreated(data.crearPersona.persona.id);
      setCi(''); setNombre(''); setApellido('');
      setTelefono(''); setEmail(''); setDireccion('');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 dark:bg-black/70 backdrop-blur-sm p-4">
      <div className="glass-panel rounded-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-surface-800 dark:text-navy-200">Nueva Persona</h3>
          <button onClick={onClose}
            className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-400 transition-colors"
          ><X size={20} /></button>
        </div>
        {error && <div className="mb-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm rounded-xl px-4 py-2.5">{error}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-navy-300 mb-1.5">CI *</label>
            <input type="text" value={ci} onChange={(e) => setCi(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400/50 dark:focus:ring-brand-dark-500/50 transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-navy-300 mb-1.5">Nombre *</label>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400/50 dark:focus:ring-brand-dark-500/50 transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-navy-300 mb-1.5">Apellido *</label>
            <input type="text" value={apellido} onChange={(e) => setApellido(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400/50 dark:focus:ring-brand-dark-500/50 transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-navy-300 mb-1.5">Teléfono</label>
            <input type="text" value={telefono} onChange={(e) => setTelefono(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400/50 dark:focus:ring-brand-dark-500/50 transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-navy-300 mb-1.5">Email</label>
            <input type="text" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400/50 dark:focus:ring-brand-dark-500/50 transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-navy-300 mb-1.5">Dirección</label>
            <input type="text" value={direccion} onChange={(e) => setDireccion(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-navy-800/60 border border-white/40 dark:border-navy-700/40 text-surface-800 dark:text-navy-200 focus:outline-none focus:ring-2 focus:ring-brand-400/50 dark:focus:ring-brand-dark-500/50 transition-all" />
          </div>

        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-surface-600 dark:text-navy-400 bg-white/60 dark:bg-navy-800/60 border border-white/80 dark:border-navy-700/60 hover:bg-white dark:hover:bg-navy-800 transition-colors text-sm font-medium">Cancelar</button>
          <button onClick={handleSubmit}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 dark:from-brand-dark-500 dark:to-blue-500 text-white font-medium shadow-md shadow-brand-500/30 dark:shadow-brand-dark-600/20 hover:shadow-lg transition-all text-sm">Guardar</button>
        </div>
      </div>
    </div>
  );
}
