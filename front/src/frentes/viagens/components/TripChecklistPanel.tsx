import { useMemo, useState } from 'react';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import type { TripCheckItem, TripDocItem } from '../types';
import type { TripDraft } from './ViagemFicha';
import { TripDocumentsModal } from './TripDocumentsModal';
import { ChecklistDueField } from './ChecklistDueField';
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
            <article className="viagens-panel viagens-panel--checklist viagens-panel--checklist-smart" aria-label="Checklist">
                <header className="viagens-checklist__head">
                    <div className="viagens-checklist__title-row">
                        <span className="viagens-checklist__dot" aria-hidden />
                        <h3 className="viagens-panel__title">Checklist</h3>
                    </div>
                    <div className="viagens-checklist__head-actions">
                        {pendingDocs > 0 ? (
                            <span className="viagens-checklist__docs-count">
                                {pendingDocs} doc
                            </span>
                        ) : null}
                        {checks.length > 0 ? (
                            <span className="viagens-checklist__progress">
                                {doneCount}/{checks.length}
                            </span>
                        ) : null}
                        <button
                            type="button"
                            className="viagens-checklist__docs-btn"
                            title="Documentos da viagem"
                            aria-label={`Documentos (${documents.length})`}
                            onClick={() => setDocsOpen(true)}
                        >
                            <MaterialIcon name="folder" filled variant="app" opticalSize={16} />
                        </button>
                    </div>
                </header>

                <div className="viagens-checklist__body">
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
                                        <ChecklistRow
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
                                        <ChecklistRow
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

                    <button type="button" className="viagens-checklist__add" onClick={addCheck}>
                        <MaterialIcon name="add" variant="app" opticalSize={16} />
                        Adicionar item
                    </button>
                </div>
            </article>
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

function ChecklistRow({
    item,
    due,
    onPatch,
    onRemove
}: {
    item: TripCheckItem;
    due?: string;
    onPatch: (id: string, patch: Partial<TripCheckItem>) => void;
    onRemove: () => void;
}) {
    const done = isDone(item);

    return (
        <div className={`viagens-checklist-item${done ? ' is-done' : ''}`} data-check-id={item.id}>
            <button
                type="button"
                className="viagens-checklist-item__toggle"
                aria-pressed={done}
                aria-label={done ? 'Feito' : 'A fazer'}
                onClick={() => onPatch(item.id, { done: !done, completed: !done })}
            >
                <MaterialIcon
                    name={done ? 'check_circle' : 'radio_button_unchecked'}
                    filled={done}
                    variant="app"
                    opticalSize={20}
                />
            </button>
            <input
                className="viagens-checklist-item__title"
                value={item.title}
                placeholder="Item"
                onChange={(e) => onPatch(item.id, { title: e.target.value })}
            />
            <div className="viagens-checklist-item__actions">
                <div className={`viagens-checklist-item__due${due ? ' has-date' : ''}`}>
                    <ChecklistDueField
                        value={due}
                        onChange={(next) =>
                            onPatch(item.id, {
                                dueOn: next,
                                due_on: next
                            })
                        }
                    />
                </div>
                <button type="button" className="viagens-checklist-item__remove" aria-label="Remover item" onClick={onRemove}>
                    <MaterialIcon name="close" filled={false} variant="app" opticalSize={14} />
                </button>
            </div>
        </div>
    );
}
