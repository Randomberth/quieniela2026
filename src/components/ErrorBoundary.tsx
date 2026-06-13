/**
 * ErrorBoundary component: catches render errors and displays
 * a user-friendly fallback instead of a white screen.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { errorLogger } from '@/lib/logger';

// ─── Props ─────────────────────────────────────────────────────

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback UI — receives error and reset callback */
  fallback?: ReactNode;
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Name for logging (e.g. component name) */
  boundaryName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ─── Default Fallback Component ────────────────────────────────

function DefaultErrorFallback({
  error,
  onReset,
  boundaryName,
}: {
  error: Error | null;
  onReset: () => void;
  boundaryName?: string;
}) {
  return (
    <div className="p-8 rounded-lg border border-red-200 bg-red-50" role="alert">
      <div className="flex items-center gap-3 mb-3">
        <AlertTriangle className="w-6 h-6 text-red-600" />
        <h2 className="text-lg font-semibold text-red-800">
          Algo salió mal
          {boundaryName && (
            <span className="text-sm font-normal text-red-600 ml-2">
              ({boundaryName})
            </span>
          )}
        </h2>
      </div>

      <p className="text-sm text-red-700 mb-4">
        Ha ocurrido un error inesperado. Por favor, intenta recargar o volver más tarde.
      </p>

      {error && (
        <details className="mb-4">
          <summary className="text-xs text-red-500 cursor-pointer hover:text-red-700">
            Detalles técnicos
          </summary>
          <pre className="mt-2 p-2 bg-red-100 rounded text-xs text-red-800 overflow-auto max-h-40">
            {error.message}
          </pre>
        </details>
      )}

      <div className="flex gap-2">
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          Intentar de nuevo
        </button>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-100 transition-colors text-sm font-medium"
        >
          Recargar página
        </button>
      </div>
    </div>
  );
}

// ─── Error Boundary Class ──────────────────────────────────────

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log to error logger
    errorLogger.error({
      operation: 'READ',
      entity: 'matches',
      message: error.message,
      metadata: {
        boundary: this.props.boundaryName || 'unknown',
        componentStack: errorInfo.componentStack ?? undefined,
        cause: (error as Error & { cause?: unknown }).cause as unknown,
      },
    });

    // Also log to console for Sentry-compatible capture
    console.error(
      `[ErrorBoundary${this.props.boundaryName ? `:${this.props.boundaryName}` : ''}]`,
      error,
      errorInfo.componentStack
    );

    // Call custom handler if provided
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <DefaultErrorFallback
          error={this.state.error}
          onReset={this.handleReset}
          boundaryName={this.props.boundaryName}
        />
      );
    }

    return this.props.children;
  }
}

// ─── Convenience HOC ───────────────────────────────────────────

/**
 * Wrap a component with an ErrorBoundary.
 * Usage: const SafeComponent = withErrorBoundary(MyComponent, 'MyComponent')
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  boundaryName?: string
): React.ComponentType<P> {
  const displayName = boundaryName || Component.displayName || Component.name || 'Component';

  function WrappedWithErrorBoundary(props: P) {
    return (
      <ErrorBoundary boundaryName={displayName}>
        <Component {...props} />
      </ErrorBoundary>
    );
  }

  WrappedWithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;
  return WrappedWithErrorBoundary;
}

export default ErrorBoundary;
