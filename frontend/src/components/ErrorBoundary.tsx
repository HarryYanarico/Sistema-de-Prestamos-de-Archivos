import { Component } from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-white via-red-50 to-blue-100 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-surface-800 dark:text-navy-200 mb-2">
              Algo salió mal
            </h1>
            <p className="text-surface-600 dark:text-navy-400 mb-6">
              No se pudo cargar la página. Intenta recargar.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 text-white font-medium shadow-md hover:from-red-700 hover:to-blue-700 transition-all"
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
