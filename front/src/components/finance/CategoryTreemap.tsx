import { useMemo } from 'react';
import { useTreemapChart, treemapRawCategory } from '../../hooks/useChart';
import { formatBRL } from '../../lib/format';
import { capTreemapBlocks, type CategoryBlock } from '../../lib/treemapData';

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
    datasetLabel = 'Por categoria'
}: Props) {
    const { blocks: cappedBlocks, mergedCount } = useMemo(
        () => capTreemapBlocks(blocks ?? []),
        [blocks]
    );

    const tree = useMemo(
        () => cappedBlocks.filter((c) => c.total > 0).map((c) => ({ category: c.name, value: c.total })),
        [cappedBlocks]
    );

    const treemapTotal = useMemo(() => tree.reduce((s, r) => s + r.value, 0), [tree]);

    const config = useMemo(() => {
        if (tree.length === 0 || treemapTotal <= 0) return null;
        const groupIndex = new Map(cappedBlocks.map((c, i) => [c.name, i]));
        const solidColor = (ctx: { type: string; raw?: Record<string, unknown> }) => {
            if (ctx.type !== 'data') return 'transparent';
            const cat = treemapRawCategory(ctx.raw);
            const idx = groupIndex.get(cat) ?? 0;
            return palette[idx % palette.length];
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
                        spacing: 2.5,
                        borderRadius: 10,
                        borderWidth: 0,
                        borderColor: 'transparent',
                        backgroundColor: solidColor,
                        captions: { display: false },
                        labels: {
                            display: true,
                            align: 'left',
                            position: 'top',
                            overflow: 'fit',
                            color: ['#ffffff', 'rgba(255,255,255,0.88)'],
                            hoverColor: '#ffffff',
                            font: [
                                { size: 14, weight: '700' as const, lineHeight: 1.25 },
                                { size: 11, weight: '600' as const, lineHeight: 1.25 }
                            ],
                            padding: 14,
                            formatter(ctx: { type: string; raw?: Record<string, unknown> }) {
                                if (ctx.type !== 'data') return '';
                                const name = treemapRawCategory(ctx.raw);
                                const raw = ctx.raw ?? {};
                                const nested = raw._data as { value?: number } | undefined;
                                const val = raw.v ?? nested?.value ?? raw.value ?? 0;
                                const pct =
                                    treemapTotal > 0 ? Math.round((Number(val) / treemapTotal) * 100) : 0;
                                const line2 = `${formatBRL(Number(val), currency)} (${pct}%)`;
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
                        borderRadius: 10
                    }
                },
                plugins: { legend: { display: false }, tooltip: { enabled: true } }
            }
        };
    }, [tree, treemapTotal, cappedBlocks, palette, currency, datasetLabel]);

    const { canvasRef, wrapRef, chartError } = useTreemapChart(() => config, [config]);

    if (tree.length === 0) {
        return (
            <div id={containerId} className="treemap-container">
                <motionHeader title={title} periodLabel={periodLabel} />
                <div className="treemap-squarify-host">
                    <p className="treemap-empty">{emptyMessage}</p>
                </div>
            </div>
        );
    }

    return (
        <div
            id={containerId}
            className="treemap-container treemap-container--chartjs"
            title={mergedCount > 0 ? `+${mergedCount} categorias agrupadas` : undefined}
        >
            <motionHeader title={title} periodLabel={periodLabel} />
            <div className="treemap-squarify-host">
                {chartError ? (
                    <p className="treemap-empty" role="alert">
                        Não foi possível desenhar o mapa. Recarregue a página.
                    </p>
                ) : (
                    <div ref={wrapRef} className="treemap-chartjs-wrap">
                        <canvas ref={canvasRef} id={canvasId} aria-label={title} role="img" />
                    </div>
                )}
            </div>
        </div>
    );
}

function motionHeader({ title, periodLabel }: { title: string; periodLabel: string }) {
    return (
        <div className="treemap-header">
            <div>
                <h2 className="treemap-title">
                    {title}: <span>{periodLabel}</span>
                </h2>
            </div>
        </div>
    );
}