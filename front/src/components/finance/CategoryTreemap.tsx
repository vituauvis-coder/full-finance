import { useMemo, type ReactNode } from 'react';
import { useTreemapChart, treemapRawCategory } from '../../hooks/useChart';
import { formatBRL } from '../../lib/format';
import {
    handleTreemapExternalTooltip,
    hideTreemapHoverPanel,
    lightenTreemapHex,
    TREEMAP_LABEL_FONT,
    type TreemapHoverContext
} from '../../lib/treemapHoverPanel';
import {
    capTreemapBlocks,
    treemapLayoutWeights,
    type CategoryBlock,
    type TreemapCapResult
} from '../../lib/treemapData';

type Props = {
    containerId: string;
    canvasId: string;
    blocks: CategoryBlock[];
    currency: string;
    palette: string[];
    periodLabel: string;
    title: string;
    emptyMessage?: string;
    datasetLabel?: string;
    compact?: boolean;
    footer?: ReactNode;
    /** Sobrescreve agrupamento «Demais categorias». */
    capBlocks?: (blocks: CategoryBlock[]) => TreemapCapResult;
    /** Fatia mínima visual por tile (rótulos continuam com valor real). */
    layoutMinShare?: number;
    labelMinPct?: number;
    /** Mantém categorias com valor 0 no mapa (layout igualitário). */
    includeZeroCategories?: boolean;
    /** Cor das linhas do rótulo nos tiles (padrão: branco). */
    tileLabelColors?: [string, string];
};

export function CategoryTreemap({
    containerId,
    canvasId,
    blocks,
    currency,
    palette,
    periodLabel,
    title,
    emptyMessage = 'Nenhum dado no período.',
    datasetLabel = 'Por categoria',
    compact = false,
    footer,
    capBlocks = capTreemapBlocks,
    layoutMinShare,
    labelMinPct = 2,
    includeZeroCategories = false,
    tileLabelColors
}: Props) {
    const chartHeight = compact ? 400 : 440;
    const { blocks: cappedBlocks, mergedCount } = useMemo(
        () => capBlocks(blocks ?? []),
        [blocks, capBlocks]
    );

    const treemapRealTotal = useMemo(
        () => cappedBlocks.filter((c) => c.total > 0).reduce((s, c) => s + c.total, 0),
        [cappedBlocks]
    );

    const chartBlocks = useMemo(
        () => (includeZeroCategories ? cappedBlocks : cappedBlocks.filter((c) => c.total > 0)),
        [cappedBlocks, includeZeroCategories]
    );

    const tree = useMemo(() => {
        const display = chartBlocks;
        if (!display.length) return [];
        const sumPositive = display.reduce((s, c) => s + Math.max(0, c.total), 0);
        const layoutReals = display.map((c) => {
            if (c.total > 0) return c.total;
            if (sumPositive <= 0) return 1;
            return sumPositive * 0.14;
        });
        const weights =
            layoutMinShare != null && layoutMinShare > 0 && display.length > 1
                ? treemapLayoutWeights(layoutReals, layoutMinShare)
                : layoutReals;
        return display.map((c, i) => ({ category: c.name, value: weights[i] }));
    }, [chartBlocks, layoutMinShare]);

    const treemapTotal = treemapRealTotal;

    const config = useMemo(() => {
        if (tree.length === 0) return null;
        const tileSpacing =
            layoutMinShare != null && layoutMinShare > 0 ? (compact ? 4 : 4.5) : compact ? 3 : 3.5;
        const tileRadius = compact ? 9 : 10;
        const labelPad = compact ? 10 : 14;
        const labelFonts = compact
            ? [
                  {
                      family: TREEMAP_LABEL_FONT,
                      size: 14,
                      weight: '800' as const,
                      lineHeight: 1.15
                  },
                  {
                      family: TREEMAP_LABEL_FONT,
                      size: 11.5,
                      weight: '600' as const,
                      lineHeight: 1.2
                  }
              ]
            : [
                  {
                      family: TREEMAP_LABEL_FONT,
                      size: 16,
                      weight: '800' as const,
                      lineHeight: 1.12
                  },
                  {
                      family: TREEMAP_LABEL_FONT,
                      size: 12.5,
                      weight: '600' as const,
                      lineHeight: 1.2
                  }
              ];
        const groupIndex = new Map(cappedBlocks.map((c, i) => [c.name, i]));
        const blocksByName = new Map(cappedBlocks.map((c) => [c.name, c]));
        const hoverCtx: TreemapHoverContext = {
            wrap: null,
            blocksByName,
            groupIndex,
            palette,
            treemapTotal,
            currency
        };
        const solidColor = (ctx: { type: string; raw?: Record<string, unknown> }) => {
            if (ctx.type !== 'data') return 'transparent';
            const cat = treemapRawCategory(ctx.raw);
            const idx = groupIndex.get(cat) ?? 0;
            return palette[idx % palette.length];
        };
        const labelColors = tileLabelColors ?? (['#ffffff', 'rgba(255,255,255,0.94)'] as const);
        const hoverColor = (ctx: { type: string; raw?: Record<string, unknown> }) => {
            if (ctx.type !== 'data') return 'transparent';
            return lightenTreemapHex(solidColor(ctx));
        };
        return {
            type: 'treemap',
            data: {
                datasets: [
                    {
                        label: datasetLabel,
                        tree,
                        key: 'value',
                        groups: ['category'],
                        spacing: tileSpacing,
                        borderRadius: tileRadius,
                        borderWidth: 0,
                        borderColor: 'transparent',
                        backgroundColor: solidColor,
                        hoverBackgroundColor: hoverColor,
                        captions: { display: false },
                        labels: {
                            display: true,
                            align: 'left',
                            position: 'top',
                            overflow: 'fit',
                            color: [...labelColors],
                            hoverColor: ['#ffffff', '#ffffff'],
                            font: [...labelFonts],
                            padding: labelPad,
                            formatter(ctx: { type: string; raw?: Record<string, unknown> }) {
                                if (ctx.type !== 'data') return '';
                                const name = treemapRawCategory(ctx.raw);
                                const raw = ctx.raw ?? {};
                                const block = blocksByName.get(name);
                                const nested = raw._data as { value?: number } | undefined;
                                const val =
                                    block?.total ??
                                    raw.v ??
                                    nested?.value ??
                                    (raw.value as number | undefined) ??
                                    0;
                                const pct =
                                    treemapTotal > 0 ? Math.round((Number(val) / treemapTotal) * 100) : 0;
                                if (labelMinPct > 0 && pct < labelMinPct && Number(val) > 0) return '';
                                const line2 = `${formatBRL(Number(val), currency)} · ${pct}%`;
                                return name ? [name, line2] : line2;
                            }
                        }
                    }
                ]
            },
            options: {
                interaction: { mode: 'nearest', intersect: true },
                elements: {
                    treemap: {
                        borderRadius: tileRadius
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external(context) {
                            const wrap = wrapRef.current;
                            hoverCtx.wrap = wrap;
                            handleTreemapExternalTooltip(context, hoverCtx);
                        }
                    }
                }
            }
        };
    }, [
        tree,
        treemapTotal,
        cappedBlocks,
        palette,
        currency,
        datasetLabel,
        compact,
        labelMinPct,
        layoutMinShare,
        includeZeroCategories,
        tileLabelColors
    ]);

    const { canvasRef, wrapRef, chartError } = useTreemapChart(() => config, [config], chartHeight);

    const containerClass = [
        'treemap-container',
        tree.length > 0 ? 'treemap-container--chartjs' : '',
        compact ? 'treemap-container--compact' : ''
    ]
        .filter(Boolean)
        .join(' ');

    if (tree.length === 0) {
        return (
            <div id={containerId} className={containerClass}>
                <motionHeader title={title} periodLabel={periodLabel} compact={compact} />
                <div className="treemap-squarify-host">
                    <p className="treemap-empty">{emptyMessage}</p>
                </div>
                {footer}
            </div>
        );
    }

    return (
        <div
            id={containerId}
            className={containerClass}
            title={mergedCount > 0 ? `+${mergedCount} categorias agrupadas` : undefined}
        >
            <motionHeader title={title} periodLabel={periodLabel} compact={compact} />
            <div className="treemap-squarify-host">
                {chartError ? (
                    <p className="treemap-empty" role="alert">
                        Não foi possível desenhar o mapa. Recarregue a página.
                    </p>
                ) : (
                    <div
                        ref={wrapRef}
                        className="treemap-chartjs-wrap"
                        onMouseLeave={() => hideTreemapHoverPanel(wrapRef.current)}
                    >
                        <canvas ref={canvasRef} id={canvasId} aria-label={title} role="img" />
                    </div>
                )}
            </div>
            {footer}
        </div>
    );
}

function motionHeader({
    title,
    periodLabel,
    compact
}: {
    title: string;
    periodLabel: string;
    compact?: boolean;
}) {
    return (
        <div className={`treemap-header${compact ? ' treemap-header--compact' : ''}`}>
            <div>
                <h2 className="treemap-title">
                    {title}: <span>{periodLabel}</span>
                </h2>
            </div>
        </div>
    );
}