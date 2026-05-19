import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return this.props.fallback ?? (
        <section className="status-state">
          <div className="status-illustration"><span /><span /><span /></div>
          <h2>Algo fallo</h2>
          <p>{this.state.error.message || 'Error inesperado al renderizar este componente.'}</p>
          <button className="primary-button" onClick={() => this.setState({ error: null })}>Reintentar</button>
        </section>
      );
    }
    return this.props.children;
  }
}
