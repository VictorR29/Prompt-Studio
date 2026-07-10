import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  viewName: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.group(`[ErrorBoundary] ${this.props.viewName}`);
    console.log('Error:', error.message);
    console.log('Component Stack:', errorInfo.componentStack);
    console.groupEnd();
    this.setState({ hasError: true });
  }

  handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[200px] p-6">
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-200 mb-2">Algo salió mal</h2>
            <p className="text-gray-400 mb-4">
              Ocurrió un error inesperado en esta sección. Podés intentar de nuevo.
            </p>
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
