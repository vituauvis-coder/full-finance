import { useMemo, useState } from 'react';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import type { TripCheckItem, TripDocItem } from '../types';
import type { TripDraft } from './ViagemFicha';
import { TripDocumentsModal } from './TripDocumentsModal';
import { ChecklistDueField } from './ChecklistDueField';
import { TripChecklistRow } from './ficha/TripChecklistRow';
import { TripFichaPanel, TripFichaPanelBody, TripFichaPanelHeader } from './ficha/TripFichaPanel';
import { checkDueOn, isCheckDone } from '../domain/tripChecklistUtils';

type Props = {
    checks: TripCheckItem[];
    documents: TripDocItem[];
    onPatch: (fn: (d: TripDraft) => TripDraft) => void;
};

function isDone(c: TripCheckItem): boolean {
    return isCheckDone(c);
}

function sortCheckIndices(checks: TripCheckItem[]): number[] {
    return checks
        .map((_, i) => i)
        .sort((lhs, rhs) => {
            const a = checkDueOn(checks[lhs]);
            const b = checkDueOn(checks[rhs]);
            if (a && b) return a.localeCompare(b);
            if (a) return -1;
            if (b) return 1;
            return lhs - rhs;
        });
}

export function TripChecklistPanel({ checks, documents, onPatch }: Props) {
    const [docsOpen, setDocsOpen] = useState(false);
    const doneCount = checks.filter(isDone).length;
    const pendingDocs = useMemo(() => documents.filter((d) => !d.done).length, [documents]);

    const { pending, completed } = useMemo(() => {
        const order = sortCheckIndices(checks);
        return {
            pending: order.filter((i) => !isDone(checks[i])),
            completed: order.filter((i) => isDone(checks[i]))
        };
    }, [checks]);

    function patchCheck(id: string, patch: Partial<TripCheckItem>) {
        onPatch((d) => ({
            ...d,
            payload: {
                ...d.payload,
                checks: (d.payload.checks ?? []).map((x) => (x.id === id ? { ...x, ...patch } : x))
            }
        }));
    }

    function removeCheck(id: string) {
        onPatch((d) => ({
            ...d,
            payload: {
                ...d.payload,
                checks: (d.payload.checks ?? []).filter((x) => x.id !== id)
            }
        }));
    }

    function addCheck() {
        onPatch((d) => ({
            ...d,
            payload: {
                ...d.payload,
                checks: [...(d.payload.checks ?? []), { id: crypto.randomUUID(), title: '', done: false }]
            }
        }));
    }

    function promoteDocToChecklist(doc: TripDocItem) {
        onPatch((d) => {
            const list = d.payload.checks ?? [];
            if (list.some((c) => c.sourceDocumentId === doc.id)) return d;
            return {
                ...d,
                payload: {
                    ...d.payload,
                    checks: [
                        ...list,
                        {
                            id: crypto.randomUUID(),
                            title: doc.title?.trim() || 'Documento',
                            done: false,
                            sourceDocumentId: doc.id
                        }
                    ]
                }
            };
        });
    }

    return (
        <>
            <TripFichaPanel
                className="viagens-panel--checklist viagens-panel--checklist-smart viagens-ficha-panel--checklist"
                aria-label="Checklist"
            >
                <TripFichaPanelHeader
                    icon="playlist_add_check"
                    title="Checklist"
                    tone="turquesa"
                    actions={
                        <>
                            {pendingDocs > 0 ? (
                                <span className="viagens-ficha-panel__pill viagens-ficha-panel__pill--turquesa">
                                    {pendingDocs} doc
                                </span>
                            ) : null}
                            {checks.length > 0 ? (
                                <span className="viagens-ficha-panel__pill viagens-ficha-panel__pill--muted">
                                    {doneCount}/{checks.length}
                                </span>
                            ) : null}
                            <button
                                type="button"
                                className="viagens-ficha-panel__icon-btn"
                                title="Documentos da viagem"
                                aria-label={`Documentos (${documents.length})`}
                                onClick={() => setDocsOpen(true)}
                            >
                                <MaterialIcon name="folder" filled variant="app" opticalSize={16} />
                            </button>
                        </>
                    }
                />

                <TripFichaPanelBody className="viagens-checklist__body viagens-ficha-panel__body--checklist">
                    {checks.length === 0 ? (
                        <div className="viagens-checklist__empty">
                            <p className="viagens-checklist__empty-lead">Mala, visto, vacina…</p>
                            <p className="viagens-checklist__empty-hint">
                                Documentos pendentes viram tarefas aqui. Use a pastinha para anexar link ou arquivo.
                            </p>
                        </div>
                    ) : (
                        <div className="viagens-checklist__list">
                            {pending.length > 0 ? (
                                <section className="viagens-checklist__group" aria-label="A fazer">
                                    {completed.length > 0 ? (
                                        <h4 className="viagens-checklist__group-label">A fazer</h4>
                                    ) : null}
                                    {pending.map((i) => (
                                        <TripChecklistRow
                                            key={checks[i].id}
                                            item={checks[i]}
                                            due={checkDueOn(checks[i])}
                                            onPatch={patchCheck}
                                            onRemove={() => removeCheck(checks[i].id)}
                                        />
                                    ))}
                                </section>
                            ) : null}
                            {completed.length > 0 ? (
                                <section className="viagens-checklist__group" aria-label="Feito">
                                    <h4 className="viagens-checklist__group-label">Feito</h4>
                                    {completed.map((i) => (
                                        <TripChecklistRow
                                            key={checks[i].id}
                                            item={checks[i]}
                                            due={checkDueOn(checks[i])}
                                            onPatch={patchCheck}
                                            onRemove={() => removeCheck(checks[i].id)}
                                        />
                                    ))}
                                </section>
                            ) : null}
                        </div>
                    )}

                    <button type="button" className="viagens-ficha-panel__cta viagens-checklist__add" onClick={addCheck}>
                        <MaterialIcon name="add" variant="app" opticalSize={16} />
                        Adicionar item
                    </button>
                </TripFichaPanelBody>
            </TripFichaPanel>
            <TripDocumentsModal
                open={docsOpen}
                documents={documents}
                checks={checks}
                onClose={() => setDocsOpen(false)}
                onChangeDocuments={(documents) =>
                    onPatch((d) => ({ ...d, payload: { ...d.payload, documents } }))
                }
                onPromoteToChecklist={promoteDocToChecklist}
            />
        </>
    );
}
