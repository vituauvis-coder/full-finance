import { useEffect, useMemo, useRef } from 'react';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { DeleteIcon } from '../../../components/icons/DeleteIcon';
import type { TripCheckItem, TripDocItem } from '../types';

type Props = {
    open: boolean;
    documents: TripDocItem[];
    checks: TripCheckItem[];
    onClose: () => void;
    onChangeDocuments: (docs: TripDocItem[]) => void;
    onPromoteToChecklist: (doc: TripDocItem) => void;
};

export function TripDocumentsModal({
    open,
    documents,
    checks,
    onClose,
    onChangeDocuments,
    onPromoteToChecklist
}: Props) {
    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    const stats = useMemo(() => {
        const pending = documents.filter((d) => !d.done).length;
        const done = documents.length - pending;
        const onChecklist = documents.filter((d) => checks.some((c) => c.sourceDocumentId === d.id)).length;
        return { pending, done, onChecklist, total: documents.length };
    }, [documents, checks]);

    if (!open) return null;

    function patchDoc(id: string, patch: Partial<TripDocItem>) {
        onChangeDocuments(documents.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    }

    function isOnChecklist(docId: string) {
        return checks.some((c) => c.sourceDocumentId === docId);
    }

    return (
        <div
            className="viagens-docs-overlay"
            role="presentation"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                ref={dialogRef}
                className="viagens-docs-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="viagens-docs-title"
            >
                <header className="viagens-docs-modal__head">
                    <div className="viagens-docs-modal__brand">
                        <span className="viagens-docs-modal__icon" aria-hidden>
                            <MaterialIcon name="folder_open" variant="app" opticalSize={24} filled />
                        </span>
                        <div>
                            <h2 id="viagens-docs-title">Documentos da viagem</h2>
                            <p className="viagens-docs-modal__sub">
                                Passaporte, seguro, reservas — pendências viram item no checklist.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="viagens-docs-modal__close"
                        onClick={onClose}
                        aria-label="Fechar"
                    >
                        <MaterialIcon name="close" variant="app" opticalSize={22} />
                    </button>
                </header>

                {stats.total > 0 ? (
                    <div className="viagens-docs-modal__stats" aria-label="Resumo">
                        {stats.pending > 0 ? (
                            <span className="viagens-docs-stat viagens-docs-stat--pending">
                                <MaterialIcon name="pending_actions" variant="app" opticalSize={15} />
                                {stats.pending} pendente{stats.pending === 1 ? '' : 's'}
                            </span>
                        ) : null}
                        {stats.done > 0 ? (
                            <span className="viagens-docs-stat viagens-docs-stat--done">
                                <MaterialIcon name="task_alt" variant="app" opticalSize={15} />
                                {stats.done} ok
                            </span>
                        ) : null}
                        {stats.onChecklist > 0 ? (
                            <span className="viagens-docs-stat viagens-docs-stat--list">
                                <MaterialIcon name="checklist" variant="app" opticalSize={15} />
                                {stats.onChecklist} no checklist
                            </span>
                        ) : null}
                    </div>
                ) : null}

                <ul className="viagens-docs-modal__list">
                    {documents.length === 0 ? (
                        <li className="viagens-docs-empty">
                            <MaterialIcon name="description" variant="app" opticalSize={36} />
                            <p className="viagens-docs-empty__lead">Nenhum documento ainda</p>
                            <p className="viagens-docs-empty__hint">Adicione passaporte, seguro, visto ou comprovantes.</p>
                        </li>
                    ) : (
                        documents.map((doc) => {
                            const onList = isOnChecklist(doc.id);
                            const canPromote = !doc.done && !onList;
                            return (
                                <li key={doc.id} className={`viagens-docs-card${doc.done ? ' is-done' : ''}`}>
                                    <div className="viagens-docs-card__head">
                                        <span className="viagens-docs-card__glyph" aria-hidden>
                                            <MaterialIcon
                                                name={doc.done ? 'check_circle' : 'description'}
                                                variant="app"
                                                opticalSize={20}
                                                filled={!!doc.done}
                                            />
                                        </span>
                                        <input
                                            className="viagens-docs-card__title"
                                            value={doc.title}
                                            placeholder="Nome do documento"
                                            onChange={(e) => patchDoc(doc.id, { title: e.target.value })}
                                            aria-label="Nome do documento"
                                        />
                                        <button
                                            type="button"
                                            className="viagens-docs-card__remove"
                                            aria-label="Remover documento"
                                            onClick={() => onChangeDocuments(documents.filter((d) => d.id !== doc.id))}
                                        >
                                            <DeleteIcon size="sm" />
                                        </button>
                                    </div>

                                    <div className="viagens-docs-card__fields">
                                        <label className="viagens-docs-field">
                                            <MaterialIcon name="link" variant="app" opticalSize={14} aria-hidden />
                                            <input
                                                type="url"
                                                placeholder="Link (Drive, e-mail…)"
                                                value={doc.linkUrl ?? ''}
                                                onChange={(e) => patchDoc(doc.id, { linkUrl: e.target.value || undefined })}
                                            />
                                        </label>
                                        <label className="viagens-docs-field viagens-docs-field--file">
                                            <MaterialIcon name="attach_file" variant="app" opticalSize={14} aria-hidden />
                                            <span className="viagens-docs-field__file-btn">
                                                {doc.attachmentName ? doc.attachmentName : 'Anexar arquivo'}
                                            </span>
                                            <input
                                                type="file"
                                                className="viagens-docs-field__file-input"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;
                                                    patchDoc(doc.id, {
                                                        attachmentName: file.name,
                                                        attachmentUrl: URL.createObjectURL(file)
                                                    });
                                                }}
                                            />
                                            {doc.attachmentUrl && !doc.linkUrl ? (
                                                <a
                                                    className="viagens-docs-field__open"
                                                    href={doc.attachmentUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    Abrir
                                                </a>
                                            ) : null}
                                        </label>
                                    </div>

                                    <div className="viagens-docs-card__foot">
                                        <button
                                            type="button"
                                            className={`viagens-docs-pill${doc.done ? ' is-on' : ''}`}
                                            onClick={() => patchDoc(doc.id, { done: !doc.done })}
                                        >
                                            <MaterialIcon name={doc.done ? 'check_circle' : 'radio_button_unchecked'} variant="app" opticalSize={16} filled={!!doc.done} />
                                            {doc.done ? 'Concluído' : 'Marcar OK'}
                                        </button>
                                        <button
                                            type="button"
                                            className="viagens-docs-pill viagens-docs-pill--accent"
                                            disabled={!canPromote}
                                            title={
                                                doc.done
                                                    ? 'Documento já concluído'
                                                    : onList
                                                      ? 'Já está no checklist'
                                                      : 'Criar item no checklist'
                                            }
                                            onClick={() => onPromoteToChecklist(doc)}
                                        >
                                            <MaterialIcon name="playlist_add_check" variant="app" opticalSize={16} />
                                            Checklist
                                        </button>
                                    </div>
                                </li>
                            );
                        })
                    )}
                </ul>

                <footer className="viagens-docs-modal__foot">
                    <button
                        type="button"
                        className="viagens-docs-modal__add"
                        onClick={() =>
                            onChangeDocuments([
                                ...documents,
                                { id: crypto.randomUUID(), title: 'Novo documento', done: false }
                            ])
                        }
                    >
                        <MaterialIcon name="add" variant="app" opticalSize={18} />
                        Novo documento
                    </button>
                </footer>
            </div>
        </div>
    );
}