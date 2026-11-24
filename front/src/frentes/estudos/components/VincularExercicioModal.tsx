import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { exerciseTypeLabel, parseExerciseDoc } from '../domain/exerciseDoc';
import type { StudyDiscipline, StudyExercise } from '../types';
import { ExerciseDisciplineLinkField, type LinkFieldValue } from './ExerciseDisciplineLinkField';

export type ExerciseLinkInput = LinkFieldValue;

type Props = {
    open: boolean;
    exercise: StudyExercise | null;
    disciplines: StudyDiscipline[];
    onClose: () => void;
    onSave: (links: ExerciseLinkInput) => void;
};

export function VincularExercicioModal({ open, exercise, disciplines, onClose, onSave }: Props) {
    const titleId = useId();
    const fieldId = useId();
    const [links, setLinks] = useState<LinkFieldValue>({ linkToAll: true, linkedDisciplineIds: [] });

    useEffect(() => {
        if (!open || !exercise) return;
        setLinks({
            linkToAll: exercise.linkToAll,
            linkedDisciplineIds: [...exercise.linkedDisciplineIds]
        });
    }, [open, exercise]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [open]);

    if (!open || !exercise || typeof document === 'undefined') return null;

    const doc = parseExerciseDoc(exercise.notesHtml);
    const typeLabel = doc ? exerciseTypeLabel(doc.type) : exercise.summary;

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            linkToAll: links.linkToAll,
            linkedDisciplineIds: links.linkToAll ? [] : [...links.linkedDisciplineIds]
        });
    };

    return createPortal(
        <div className="estudos-modal-root" role="presentation" onClick={onClose}>
            <div
                className="estudos-modal estudos-modal--exercicio estudos-modal--link"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onClick={(e) => e.stopPropagation()}
            >
                <header className="estudos-modal__head">
                    <div>
                        <p className="estudos-modal__eyebrow">Onde este exercício aparece</p>
                        <h2 id={titleId}>{exercise.title}</h2>
                        {typeLabel ? <p className="estudos-modal__sub">{typeLabel}</p> : null}
                    </div>
                    <button type="button" className="estudos-modal__close" onClick={onClose} aria-label="Fechar">
                        <MaterialIcon name="close" variant="app" />
                    </button>
                </header>

                <form className="estudos-modal__body" onSubmit={submit}>
                    <ExerciseDisciplineLinkField
                        idPrefix={fieldId}
                        disciplines={disciplines}
                        value={links}
                        onChange={setLinks}
                    />

                    <footer className="estudos-modal__foot">
                        <button type="button" className="estudos-btn-ghost" onClick={onClose}>
                            Cancelar
                        </button>
                        <button type="submit" className="estudos-btn-primary">
                            <MaterialIcon name="save" variant="app" />
                            Salvar vínculos
                        </button>
                    </footer>
                </form>
            </div>
        </div>,
        document.body
    );
}