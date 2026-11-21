import type { Account } from '../../../../lib/types/finance';

type Props = {
    bank: Account;
    onEdit: (bank: Account) => void;
    onDelete: (bank: Account) => void;
};

/** Editar / excluir na linha — adicionar cartão fica nos plásticos placeholder. */
export function WalletInstitutionRowActions({ bank, onEdit, onDelete }: Props) {
    return (
        <div className="wallet-institution-row__row-actions" role="group" aria-label={`Ações — ${bank.name}`}>
            <button
                type="button"
                    className="btn-action btn-edit"
                title="Editar conta"
                aria-label={`Editar ${bank.name}`}
                onClick={() => onEdit(bank)}
            >
                <i className="fas fa-pen" aria-hidden="true" />
            </button>
            <button
                type="button"
                    className="btn-action btn-delete"
                title="Excluir conta"
                aria-label={`Excluir ${bank.name}`}
                onClick={() => onDelete(bank)}
            >
                <i className="fas fa-trash-alt" aria-hidden="true" />
            </button>
        </div>
    );
}