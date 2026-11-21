/** Reserva visual do gráfico mensal até migração completa do Chart.js legado. */
export function CofrinhosChartPlaceholder() {
    return (
        <section className="dashboard-reports-section cofrinhos-page__charts-section" aria-label="Gráficos de cofrinhos">
            <div className="cofrinhos-page__charts dashboard-reports-charts-grid dashboard-reports-charts-grid--single">
                <div className="reports-chart-container dashboard-flux-chart-card cofrinhos-page__chart-card">
                    <div className="reports-chart-header">
                        <h3>Aportes por caixinha</h3>
                        <p className="reports-chart-hint">Visão mensal do ano civil — gráfico interativo em breve.</p>
                    </div>
                    <div className="chart-wrapper cofrinhos-page__chart-wrapper" aria-hidden="true">
                        <div className="cofrinhos-page__chart-placeholder" />
                    </div>
                </div>
            </div>
        </section>
    );
}