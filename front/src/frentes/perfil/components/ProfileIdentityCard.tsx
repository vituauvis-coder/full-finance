import { useRef } from 'react';
import { ProfileAvatar } from './ProfileAvatar';
import { ProfileAvatarCameraButton, ProfilePhotoToolbar } from './ProfilePhotoActions';
import { ProfileCard } from './ProfileCard';

type Props = {
    displayName: string;
    email: string;
    photoUrl?: string | null;
    currencyLabel: string;
    themeLabel: string;
    photoBusy: boolean;
    photoMessage: string | null;
    onPhotoPick: (file: File) => void | Promise<void>;
    onPhotoRemove: () => void | Promise<void>;
};

export function ProfileIdentityCard({
    displayName,
    email,
    photoUrl,
    currencyLabel,
    themeLabel,
    photoBusy,
    photoMessage,
    onPhotoPick,
    onPhotoRemove
}: Props) {
    const letter = displayName.charAt(0).toUpperCase();
    const fileRef = useRef<HTMLInputElement>(null);
    const openPicker = () => fileRef.current?.click();

    return (
        <ProfileCard slot="full" variant="identity" ariaLabel="Sua conta e resumo">
            <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="profile-modern__file-input"
                disabled={photoBusy}
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void onPhotoPick(file);
                }}
            />
            <div className="profile-modern__identity-strip">
                <div className="profile-modern__hero profile-modern__hero--strip">
                    <div className="profile-modern__avatar-stack">
                        <ProfileAvatar photoUrl={photoUrl} fallbackLetter={letter} />
                        <ProfileAvatarCameraButton busy={photoBusy} onClick={openPicker} />
                    </div>
                    <div className="profile-modern__hero-copy">
                        <p className="profile-modern__eyebrow">Sua conta</p>
                        <h2 className="profile-modern__name" id="profile-hero-title">
                            {displayName}
                        </h2>
                        <div className="profile-modern__hero-meta">
                            <span className="profile-modern__badge">Conta ativa</span>
                            <p className="profile-modern__email" id="profile-hero-email">
                                {email}
                            </p>
                        </div>
                        <ProfilePhotoToolbar
                            hasPhoto={!!photoUrl}
                            busy={photoBusy}
                            onRemove={onPhotoRemove}
                        />
                        {photoMessage ? (
                            <p className="profile-modern__feedback profile-modern__feedback--hero">{photoMessage}</p>
                        ) : null}
                    </div>
                </div>
                <aside className="profile-modern__snapshot-pane" aria-label="Resumo da conta">
                    <h3 className="profile-modern__snapshot-title">Detalhes da conta</h3>
                    <p className="profile-modern__snapshot-sub">Resumo das preferências atuais</p>
                    <dl className="profile-modern__kv">
                        <div className="profile-modern__kv-row">
                            <dt>Moeda</dt>
                            <dd>{currencyLabel}</dd>
                        </div>
                        <div className="profile-modern__kv-row">
                            <dt>Tema</dt>
                            <dd>{themeLabel}</dd>
                        </div>
                    </dl>
                </aside>
            </div>
        </ProfileCard>
    );
}