import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { DeleteIcon } from '../../../../components/icons/DeleteIcon';
import { dateLabel } from '../../pages/pontos/pontos-format';
import type { MilesCalcSave } from '../../utils/miles-calc-saves';

type Props = {
    saves: MilesCalcSave[];
    onOpen: (save: MilesCalcSave) => void;
    onDrop: (id: string) => void;
    onClose: () => void;
};

export function MilesCalcHistoryPop({ saves, onOpen, onDrop, onClose }: Props) {
    return (
        <div className="carteira-pop-scrim is-fixed" onClick={onClose}>
            <div
                className="carteira-pop carteira-pop--calc-history"
                role="dialog"
                aria-labelledby="miles-calc-history-title"
                onClick={(e) => e.stopPropagation()}
            >
                <header>
                    <div>
                        <p className="pontos-kicker">Calculadora</p>
                        <h3 id="miles-calc-history-title">Simulações salvas</h3>
                    </div>
                    <button type="button" className="voos-icon-btn" onClick={onClose} title="Fechar" aria-label="Fechar">
                        <MaterialIcon name="close" variant="app" opticalSize={18} />
                    </button>
                </header>
                {saves.length === 0 ? (
                    <p className="voos-muted">Nada salvo ainda. Calcule e toque em Salvar.</p>
                ) : (
                    <ul className="carteira-log">
                        {saves.map((s) => (
                            <li key={s.id}>
                                <button type="button" className="miles-calc-save" onClick={() => onOpen(s)}>
                                    <strong>{s.title}</strong>
                                    <em>Ver · {dateLabel(s.savedAt)}</em>
                                </button>
                                <button
                                    type="button"
                                    className="voos-icon-btn"
                                    title="Ver simulação"
                                    aria-label="Ver simulação"
                                    onClick={() => onOpen(s)}
                                >
                                    <MaterialIcon name="visibility" variant="app" opticalSize={16} />
                                </button>
                                <button
                                    type="button"
                                    className="voos-icon-btn voos-icon-btn--coral carteira-log__drop"
                                    title="Excluir"
                                    aria-label="Excluir simulação"
                                    onClick={() => onDrop(s.id)}
                                >
                                    <DeleteIcon size="sm" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
