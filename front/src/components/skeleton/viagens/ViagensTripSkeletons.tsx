import type { ReactNode } from 'react';
import { Skeleton } from '../../ui/Skeleton';
import type { ViagensTripSkeletonVariant } from './viagensSkeletonRoute';
import '../../../frentes/dashboard/styles/dashboard-tokens.css';
import '../../../frentes/viagens/styles/orcamento-workspace.css';
import '../../../frentes/viagens/styles/viagens-ficha-form.css';
import '../../../frentes/viagens/styles/viagens-ficha-toolbar.css';
import '../../../frentes/viagens/styles/viagens-dash-hero.css';
import '../../../frentes/viagens/styles/viagens-transporte-modern.css';
import '../../../frentes/viagens/styles/voos-workspace.css';
import '../../../frentes/viagens/styles/hospedagens-workspace.css';
import '../../../frentes/viagens/styles/roteiros-workspace.css';

function ViagensSkeletonShell({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="viagens-skeleton" aria-busy="true" role="status" aria-label={label}>
            <p className="skeleton-visually-hidden">{label}</p>
            {children}
        </div>
    );
}

function OrcKpiRowSkeleton({ count = 4 }: { count?: number }) {
    return (
        <div className="orc-kpis skeleton-viagens-kpis" aria-hidden="true">
            {Array.from({ length: count }, (_, i) => (
                <article key={i} className="orc-kpi skeleton-viagens-kpi">
                    <Skeleton className="skeleton--line-sm" style={{ width: i % 2 === 0 ? '3.6rem' : '2.85rem' }} />
                    <Skeleton
                        className="skeleton--metric"
                        style={{ width: '4.1rem', height: '1.05rem', marginTop: '0.28rem' }}
                    />
                </article>
            ))}
        </div>
    );
}

export function ViagensModuleChromeSkeleton({ title }: { title: string }) {
    return (
        <header className="viagens-ficha__header" aria-hidden="true">
            <div className="viagens-ficha__chrome">
                <div className="viagens-ficha__chrome-left">
                    <Skeleton className="skeleton--circle" style={{ width: '2.25rem', height: '2.25rem' }} />
                    <Skeleton
                        className="skeleton-viagens-module-title"
                        style={{ width: title.length > 10 ? '7.5rem' : '6.25rem', height: '1.35rem' }}
                    />
                </div>
            </div>
        </header>
    );
}

function ViagemFichaModuloHeroSkeleton({ title }: { title: string }) {
    return (
        <div className="viagens-ficha__header">
            <header className="viagens-hero viagens-ficha-hero" aria-hidden="true">
                <div className="viagens-hero__row viagens-hero__row--head">
                    <Skeleton className="skeleton-viagens-hero-back" />
                    <Skeleton
                        className="skeleton-viagens-hero-module-title"
                        style={{ width: title.length > 11 ? '8.25rem' : title.length > 8 ? '7rem' : '6.25rem' }}
                    />
                </div>
            </header>
        </div>
    );
}

function OrcamentoOverviewSkeleton() {
    return (
        <section className="orc-overview skeleton-viagens-orc-overview" aria-hidden="true">
            <article className="orc-overview__block orc-overview__block--chart skeleton-viagens-orc-overview__block">
                <div className="orc-chart-toolbar" aria-hidden>
                    <Skeleton className="skeleton-viagens-orc-chart-tool" />
                </div>
                <Skeleton className="skeleton-viagens-orc-donut skeleton-viagens-orc-donut--goal" />
            </article>
            <article className="orc-overview__block orc-overview__block--aportes skeleton-viagens-orc-overview__block">
                <div className="orc-aportes__top">
                    <Skeleton className="skeleton--line-sm skeleton-viagens-orc-aportes-eyebrow" />
                    <div className="orc-aportes__tools">
                        <Skeleton className="skeleton-viagens-orc-aportes-tool" />
                        <Skeleton className="skeleton-viagens-orc-aportes-cta" />
                    </div>
                </div>
                <Skeleton className="skeleton-viagens-orc-aportes-balance" />
                <Skeleton className="skeleton-viagens-orc-aportes-count" />
                <ul className="orc-aportes__pace">
                    {Array.from({ length: 3 }, (_, i) => (
                        <li key={i}>
                            <Skeleton className="skeleton-viagens-orc-pace-row" style={{ opacity: 1 - i * 0.08 }} />
                        </li>
                    ))}
                </ul>
                <div className="orc-month-cal orc-month-cal--aportes skeleton-viagens-orc-aportes-cal" aria-hidden>
                    {Array.from({ length: 4 }, (_, i) => (
                        <Skeleton key={i} className="skeleton-viagens-orc-cal-cell" />
                    ))}
                </div>
            </article>
            <article className="orc-overview__block orc-overview__block--categories skeleton-viagens-orc-overview__block">
                <Skeleton className="skeleton-viagens-orc-donut skeleton-viagens-orc-donut--pay" />
            </article>
        </section>
    );
}

function OrcamentoLedgerSkeleton() {
    return (
        <aside className="orc-finance-ledger skeleton-viagens-orc-ledger" aria-hidden>
            <header className="orc-finance-ledger__head">
                <Skeleton className="skeleton--circle" style={{ width: '1rem', height: '1rem', flexShrink: 0 }} />
                <Skeleton className="skeleton--line-sm" style={{ width: '11rem', maxWidth: '100%' }} />
            </header>
            <ul className="orc-finance-ledger__list">
                {Array.from({ length: 2 }, (_, i) => (
                    <li key={i} className="orc-finance-ledger__row">
                        <Skeleton className="skeleton-viagens-orc-ledger-kind" />
                        <Skeleton className="skeleton-viagens-orc-ledger-desc" />
                        <Skeleton className="skeleton-viagens-orc-ledger-date" />
                        <Skeleton className="skeleton-viagens-orc-ledger-amt" />
                    </li>
                ))}
            </ul>
        </aside>
    );
}

function OrcamentoSkeletonBody() {
    return (
        <div className="viagens-root skeleton-viagens-orcamento-root">
            <div className="viagens-ficha">
                <ViagemFichaModuloHeroSkeleton title="Orçamento" />
                <section className="orc-workspace skeleton-viagens-orcamento" aria-hidden="true">
                    <OrcamentoOverviewSkeleton />
                    <OrcamentoLedgerSkeleton />
                    <div className="orc-columns skeleton-viagens-orc-columns">
                        {['Categorias', 'Despesas'].map((title, panel) => (
                            <section
                                key={title}
                                className={`orc-panel skeleton-viagens-orc-panel${panel === 0 ? ' orc-panel--categories' : ' orc-panel--expenses'}`}
                            >
                                <div className="orc-panel__head">
                                    <Skeleton className="skeleton--line" style={{ width: '5.25rem' }} />
                                    <Skeleton className="skeleton--circle" style={{ width: '1.65rem', height: '1.65rem' }} />
                                </div>
                                <div className="orc-panel__scroll skeleton-viagens-orc-panel__scroll">
                                    {Array.from({ length: panel === 0 ? 6 : 5 }, (_, i) => (
                                        <Skeleton key={i} className="skeleton-viagens-orc-cat-row" />
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}

function TransporteSkeletonBody() {
    return (
        <div className="viagens-root viagens-root--transporte skeleton-viagens-transporte-root">
            <div className="viagens-ficha voos-page skeleton-viagens-transporte-page">
                <section className="transporte-page-header skeleton-viagens-transporte-header">
                    <div className="transporte-page-header__inner">
                        <ViagensModuleChromeSkeleton title="Transportes" />
                        <div className="transporte-page-header__aside skeleton-viagens-transporte-aside">
                            <div className="transporte-module-tabs skeleton-viagens-transporte-tabs">
                                <Skeleton className="skeleton-viagens-transporte-tab" />
                                <Skeleton className="skeleton-viagens-transporte-tab" />
                            </div>
                            <Skeleton className="skeleton-viagens-transporte-cta" />
                        </div>
                    </div>
                </section>
                <section className="transporte-hero">
                    <div className="voos-resumo skeleton-viagens-voos-resumo">
                        <div className="voos-resumo__col">
                            <Skeleton className="skeleton--line" style={{ width: '5rem', marginBottom: '0.55rem' }} />
                            {Array.from({ length: 3 }, (_, i) => (
                                <Skeleton key={i} className="skeleton-viagens-voos-stat" />
                            ))}
                        </div>
                        <div className="voos-resumo__col voos-resumo__col--miles">
                            <Skeleton className="skeleton--line" style={{ width: '4.5rem', marginBottom: '0.55rem' }} />
                            <Skeleton className="skeleton-viagens-wallet-block" />
                        </div>
                    </div>
                </section>
                <div className="voos-home">
                    {Array.from({ length: 2 }, (_, i) => (
                        <div key={i} className="voos-board skeleton-viagens-voos-segment">
                            <Skeleton className="skeleton--line" style={{ width: '6.5rem' }} />
                            <Skeleton className="skeleton-viagens-voos-simulation" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function HospedagensSkeletonBody() {
    return (
        <div className="viagens-root" aria-hidden="true">
            <div className="viagens-ficha hosp-page voos-page">
                <ViagensModuleChromeSkeleton title="Hospedagens" />
                <div className="hosp-page__home voos-home">
                    <section className="hosp-resumo">
                        <article className="hosp-resumo__custo">
                            <Skeleton className="skeleton--line" style={{ width: '4rem', marginBottom: '0.65rem' }} />
                            <OrcKpiRowSkeleton />
                            <Skeleton className="skeleton--line-sm" style={{ width: '82%', marginTop: '0.65rem' }} />
                        </article>
                        <article className="hosp-resumo__trilha">
                            <Skeleton className="skeleton--line" style={{ width: '9.5rem', marginBottom: '0.65rem' }} />
                            <Skeleton className="skeleton-viagens-hosp-trail" />
                        </article>
                    </section>
                    <div className="hosp-workspace skeleton-viagens-hosp-workspace">
                        <aside className="hosp-workspace__rail">
                            <Skeleton className="skeleton--line" style={{ width: '5.5rem' }} />
                            {Array.from({ length: 4 }, (_, i) => (
                                <Skeleton key={i} className="skeleton-viagens-hosp-rail-row" />
                            ))}
                        </aside>
                        <div className="hosp-workspace__main">
                            <Skeleton className="skeleton-viagens-hosp-main-card" />
                        </div>
                        <div className="hosp-workspace__map">
                            <Skeleton className="skeleton-viagens-hosp-map" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function RoteirosSkeletonBody() {
    return (
        <div className="viagens-root" aria-hidden="true">
            <div className="viagens-ficha rote-page voos-page">
                <ViagensModuleChromeSkeleton title="Roteiros" />
                <div className="rote-page__home voos-home">
                    <section className="rote-resumo">
                        <OrcKpiRowSkeleton />
                    </section>
                    <div className="rote-board voos-home__block skeleton-viagens-rote-board">
                        <Skeleton className="skeleton--line" style={{ width: '7rem' }} />
                        <Skeleton className="skeleton-viagens-rote-planner" />
                    </div>
                </div>
            </div>
        </div>
    );
}

function FichaSkeletonBody() {
    return (
        <div className="viagens-root">
            <div className="viagens-ficha">
                <div className="viagens-ficha-home skeleton-viagens-ficha-home" aria-hidden="true">
                    <div className="skeleton-viagens-modulos">
                        {Array.from({ length: 4 }, (_, i) => (
                            <Skeleton key={i} className="skeleton-viagens-modulo-tile" />
                        ))}
                    </div>
                    <Skeleton className="skeleton-viagens-ficha-top" />
                    <Skeleton className="skeleton-viagens-feed" />
                </div>
            </div>
        </div>
    );
}

function AtlasMilesRowSkeleton() {
    return (
        <li>
            <div className="atlas-miles-row skeleton-viagens-miles-row" aria-hidden="true">
                <span className="atlas-miles-row__meta">
                    <Skeleton className="skeleton-viagens-miles-row__dot" />
                    <span className="atlas-miles-row__text">
                        <Skeleton className="skeleton--line" style={{ width: '5.25rem' }} />
                        <Skeleton className="skeleton--line-sm" style={{ width: '3.25rem', marginTop: '0.15rem' }} />
                    </span>
                </span>
                <span className="atlas-miles-row__values">
                    <Skeleton className="skeleton--line" style={{ width: '3.5rem' }} />
                    <Skeleton className="skeleton--line-sm" style={{ width: '2.75rem', marginTop: '0.12rem' }} />
                </span>
            </div>
        </li>
    );
}

function AtlasTripCardSkeletonInner({ tall }: { tall?: boolean }) {
    return (
        <div
            className={`atlas-trip-card skeleton-viagens-trip-card${tall ? ' skeleton-viagens-trip-card--tall' : ''}`}
            aria-hidden="true"
        >
            <div className="atlas-trip-card__top">
                <Skeleton className="skeleton-viagens-trip-status" />
                <div className="atlas-trip-card__flags">
                    <Skeleton className="skeleton--circle" style={{ width: '1.1rem', height: '0.75rem', borderRadius: 3 }} />
                    <Skeleton className="skeleton--circle" style={{ width: '1.1rem', height: '0.75rem', borderRadius: 3 }} />
                </div>
            </div>
            <Skeleton className="skeleton--line" style={{ width: '72%', height: '0.95rem' }} />
            <Skeleton className="skeleton--line-sm" style={{ width: '88%', marginTop: '0.3rem' }} />
            <Skeleton className="skeleton-viagens-trip-cap" />
            {tall ? (
                <div className="atlas-trip-card__foot skeleton-viagens-trip-foot">
                    <Skeleton className="skeleton--line-sm" style={{ width: '4.25rem' }} />
                    <Skeleton className="skeleton--line-sm" style={{ width: '6.5rem' }} />
                </div>
            ) : null}
        </div>
    );
}

function AtlasMapSkeleton() {
    return (
        <div className="viagens-map-frame skeleton-viagens-map-frame" aria-hidden="true">
            <div className="viagens-map-frame__wash" />
            <div className="viagens-map-ctrl-stack skeleton-viagens-map-hud">
                <Skeleton className="skeleton-viagens-map-ctrl-btn" />
                <Skeleton className="skeleton-viagens-map-ctrl-btn" />
                <Skeleton className="skeleton-viagens-map-ctrl-btn" />
            </div>
            <div className="viagens-map-view-toggle skeleton-viagens-map-hud" aria-hidden>
                <Skeleton className="skeleton-viagens-map-toggle-pill skeleton-viagens-map-toggle-pill--wide" />
                <Skeleton className="skeleton-viagens-map-toggle-pill" />
            </div>
            <div className="viagens-map-layer-toggles skeleton-viagens-map-hud" aria-hidden>
                <Skeleton className="skeleton-viagens-map-layer-pill" />
                <Skeleton className="skeleton-viagens-map-layer-pill" />
                <Skeleton className="skeleton-viagens-map-layer-pill skeleton-viagens-map-layer-pill--short" />
            </div>
            <div className="viagens-map-legend skeleton-viagens-map-legend-shell">
                <ul className="viagens-map-legend__list">
                    {[0, 1, 2].map((i) => (
                        <li key={i} className="viagens-map-legend__item">
                            <Skeleton className="skeleton-viagens-legend-swatch" />
                            <Skeleton className="skeleton--line-sm" style={{ width: i === 0 ? '2.1rem' : '3.1rem' }} />
                        </li>
                    ))}
                </ul>
                <Skeleton className="skeleton--line-sm skeleton-viagens-map-legend-meta" />
            </div>
        </div>
    );
}

export function AtlasSkeletonLayout() {
    return (
        <div
            className="viagens-casa-layout skeleton-viagens-atlas"
                aria-busy="true"
                role="status"
                aria-label="Carregando atlas"
            >
                <p className="skeleton-visually-hidden">Carregando atlas</p>
            <div className="viagens-casa-sidebar">
                <section className="atlas-sidebar-panel atlas-miles-panel">
                    <div className="atlas-sidebar-panel__head">
                        <h2 className="atlas-sidebar-panel__title">
                            <Skeleton className="skeleton--line" style={{ width: '7.25rem', height: '1rem' }} />
                        </h2>
                        <Skeleton className="skeleton-viagens-panel-link" />
                    </div>
                    <div className="atlas-miles-panel__body">
                        <ul className="atlas-miles-panel__list">
                            <AtlasMilesRowSkeleton />
                            <AtlasMilesRowSkeleton />
                            <AtlasMilesRowSkeleton />
                        </ul>
                    </div>
                </section>
                <div className="atlas-sidebar-divider" aria-hidden />
                <aside className="viagens-casa__trail viagens-trilho atlas-sidebar-panel atlas-trips-panel">
                    <div className="viagens-trail-header atlas-sidebar-panel__head">
                        <h2 className="atlas-sidebar-panel__title">
                            <Skeleton className="skeleton--line" style={{ width: '6.5rem', height: '1rem' }} />
                        </h2>
                        <Skeleton className="skeleton-viagens-trail-new" />
                    </div>
                    <div className="viagens-trail-scroll">
                        <AtlasTripCardSkeletonInner tall />
                        <AtlasTripCardSkeletonInner />
                        <AtlasTripCardSkeletonInner />
                    </div>
                </aside>
            </div>
            <main className="viagens-casa-main">
                <div className="viagens-map-host-skeleton" data-skeleton-map-host>
                    <AtlasMapSkeleton />
                </div>
            </main>
        </div>
    );
}

const SKELETON_LABELS: Record<ViagensTripSkeletonVariant, string> = {
    atlas: 'Carregando atlas',
    orcamento: 'Carregando orçamento',
    transporte: 'Carregando transportes',
    hospedagens: 'Carregando hospedagens',
    roteiros: 'Carregando roteiro',
    ficha: 'Carregando ficha'
};

export function ViagensTripModuleSkeleton({ variant }: { variant: ViagensTripSkeletonVariant }) {
    const label = SKELETON_LABELS[variant];

    if (variant === 'atlas') {
        return <AtlasSkeletonLayout />;
    }

    const body: ReactNode =
        variant === 'orcamento' ? (
            <OrcamentoSkeletonBody />
        ) : variant === 'transporte' ? (
            <TransporteSkeletonBody />
        ) : variant === 'hospedagens' ? (
            <HospedagensSkeletonBody />
        ) : variant === 'roteiros' ? (
            <RoteirosSkeletonBody />
        ) : (
            <FichaSkeletonBody />
        );

    return (
        <div className="viagens-skeleton viagens-skeleton--trip-module" aria-busy="true" role="status" aria-label={label}>
            <p className="skeleton-visually-hidden">{label}</p>
            {body}
        </div>
    );
}

export function ViagensTripSkeletonByVariant({ variant }: { variant: ViagensTripSkeletonVariant }) {
    return <ViagensTripModuleSkeleton variant={variant} />;
}