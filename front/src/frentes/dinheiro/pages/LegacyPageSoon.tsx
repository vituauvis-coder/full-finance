/** Páginas ainda sem markup React — mesmo shell, aviso estilizado */
export function LegacyPageSoon({ title }: { title: string }) {
    return (
        <section className="page active">
            <motionPanel className="list-container" style={{ padding: '1.5rem' }}>
                <h2 style={{ marginTop: 0 }}>{title}</h2>
                <p className="card-metric-hint">
                    Esta tela ainda está sendo portada para React com o mesmo layout do legado. O Dashboard já usa os
                    módulos originais (gráficos, cards, heatmap).
                </p>
            </motionPanel>
        </section>
    );
}

function motionPanel({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
    return (
        <div className={className} style={style}>
            {children}
        </div>
    );
}