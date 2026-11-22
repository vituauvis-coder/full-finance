import { MaterialIcon } from '../../../components/icons/MaterialIcon';

type Props = {
    onDeleteClick: () => void;
};

export function ProfileDangerZoneCard({ onDeleteClick }: Props) {
    return (
        <div className="profile-modern__bento-stack__danger-shell">
            <details className="profile-modern__danger-disclosure profile-modern__bento-stack__danger" open>
            <summary className="profile-modern__danger-summary">
                <span className="profile-modern__card-icon profile-modern__card-icon--danger" aria-hidden="true">
                    <MaterialIcon name="warning" variant="app" />
                </span>
                <span className="profile-modern__danger-summary-text">
                    <span className="profile-modern__danger-summary-title">Zona de perigo</span>
                    <span className="profile-modern__danger-summary-sub">Ações irreversíveis na sua conta</span>
                </span>
                <MaterialIcon name="expand_more" variant="app" className="profile-modern__danger-chevron" />
            </summary>
            <div className="profile-modern__danger-panel">
                <h4 className="profile-modern__danger-title">Excluir conta</h4>
                <p className="profile-modern__danger-copy">
                    Esta ação é <strong>permanente</strong> e remove todos os seus dados neste serviço.
                </p>
                <button
                    type="button"
                    className="profile-modern__btn profile-modern__btn--danger"
                    onClick={onDeleteClick}
                >
                    <MaterialIcon name="delete_forever" variant="app" />
                    Excluir minha conta permanentemente
                </button>
            </div>
        </details>
        </div>
    );
}