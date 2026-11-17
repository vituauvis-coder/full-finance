import { MaterialIcon } from '../../../components/icons/MaterialIcon';

type ToolbarProps = {
    hasPhoto: boolean;
    busy: boolean;
    onRemove: () => void | Promise<void>;
};

/** Só «Remover»; trocar foto fica no ícone da bolinha. */
export function ProfilePhotoToolbar({ hasPhoto, busy, onRemove }: ToolbarProps) {
    if (!hasPhoto) return null;

    return (
        <div className="profile-modern__photo-toolbar" role="group" aria-label="Foto de perfil">
            <button
                type="button"
                className="profile-modern__link-btn profile-modern__link-btn--danger"
                disabled={busy}
                onClick={() => void onRemove()}
            >
                Remover foto
            </button>
        </div>
    );
}

export function ProfileAvatarCameraButton({
    busy,
    onClick
}: {
    busy: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            className="profile-modern__avatar-camera"
            disabled={busy}
            aria-label={busy ? 'Enviando foto…' : 'Alterar foto de perfil (até 2 MB)'}
            onClick={onClick}
        >
            <MaterialIcon name="photo_camera" variant="app" />
        </button>
    );
}