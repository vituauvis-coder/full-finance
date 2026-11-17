import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class RouteErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('[RouteErrorBoundary]', error, info.componentStack);
    }

    render() {
        if (this.state.error) {
            return (
                <section className="page active" role="alert">
                    <h2 style={{ marginTop: 0 }}>Não foi possível abrir esta tela</h2>
                    <p>{this.state.error.message}</p>
                    <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
                        Recarregar
                    </button>
                </section>
            );
        }
        return this.props.children;
    }
}