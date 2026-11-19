import { useEffect, useRef } from 'react';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
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
                    <h2 id="viagens-docs-title">
                        <MaterialIcon name="folder_open" variant="app" opticalSize={22} />
                        Documentos da viagem
                    </h2>
                    <button type="button" className="viagens-btn viagens-btn--ghost viagens-btn--icon" onClick={onClose} aria-label="Fechar">
                        <MaterialIcon name="close" variant="app" opticalSize={22} />
                    </button>
                </header>
                <p className="viagens-muted viagens-docs-modal__hint">
                    Pendência de documento pode virar item do checklist. Itens do checklist não viram documento.
                </p>
                <ul className="viagens-docs-modal__list">
                    {documents.length === 0 ? (
                        <li className="viagens-muted">Nenhum documento cadastrado.</li>
                    ) : (
                        documents.map((doc) => (
                            <li key={doc.id} className="viagens-docs-row">
                                <div className="viagens-docs-row__main">
                                    <input
                                        className="viagens-field"
                                        value={doc.title}
                                        onChange={(e) => patchDoc(doc.id, { title: e.target.value })}
                                        aria-label="Nome do documento"
                                    />
                                    <label className="viagens-docs-row__attach">
                                        <span>Link ou URL</span>
                                        <input
                                            className="viagens-field"
                                            type="url"
                                            placeholder="https://…"
                                            value={doc.linkUrl ?? ''}
                                            onChange={(e) => patchDoc(doc.id, { linkUrl: e.target.value || undefined })}
                                        />
                                    </label>
                                    <label className="viagens-docs-row__attach">
                                        <span>Anexo</span>
                                        <input
                                            className="viagens-field"
                                            type="file"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                patchDoc(doc.id, {
                                                    attachmentName: file.name,
                                                    attachmentUrl: URL.createObjectURL(file)
                                                });
                                            }}
                                        />
                                        {doc.attachmentName ? (
                                            <span className="viagens-muted viagens-docs-row__file">
                                                {doc.attachmentName}
                                                {doc.linkUrl ? null : (
                                                    <a href={doc.attachmentUrl} target="_blank" rel="noreferrer">
                                                        Abrir
                                                    </a>
                                                )}
                                            </span>
                                        ) : null}
                                    </label>
                                </div>
                                <div className="viagens-docs-row__actions">
                                    <label className="viagens-check-row viagens-docs-row__done">
                                        <input
                                            type="checkbox"
                                            checked={!!doc.done}
                                            onChange={(e) => patchDoc(doc.id, { done: e.target.checked })}
                                        />
                                        <span>OK</span>
                                    </label>
                                    <button
                                        type="button"
                                        className="viagens-btn viagens-btn--ghost viagens-btn--sm"
                                        disabled={doc.done || isOnChecklist(doc.id)}
                                        title={
                                            doc.done
                                                ? 'Documento já concluído'
                                                : isOnChecklist(doc.id)
                                                  ? 'Já está no checklist'
                                                  : 'Criar item no checklist'
                                        }
                                        onClick={() => onPromoteToChecklist(doc)}
                                    >
                                        + Checklist
                                    </button>
                                    <button
                                        type="button"
                                        className="viagens-btn viagens-btn--ghost viagens-btn--sm"
                                        aria-label="Remover documento"
                                        onClick={() => onChangeDocuments(documents.filter((d) => d.id !== doc.id))}
                                    >
                                        ×
                                    </button>
                                </div>
                            </li>
                        ))
                    )}
                </ul>
                <footer className="viagens-docs-modal__foot">
                    <button
                        type="button"
                        className="viagens-btn viagens-btn--ghost"
                        onClick={() =>
                            onChangeDocuments([
                                ...documents,
                                { id: crypto.randomUUID(), title: 'Novo documento', done: false }
                            ])
                        }
                    >
                        + Documento
                    </button>
                </footer>
            </div>
        </div>
    );
}