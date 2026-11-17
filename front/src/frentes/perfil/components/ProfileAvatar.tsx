type Props = {
    photoUrl?: string | null;
    fallbackLetter: string;
};

export function ProfileAvatar({ photoUrl, fallbackLetter }: Props) {
    return (
        <div className="profile-modern__avatar-ring" aria-hidden="true">
            {photoUrl ? (
                <img className="profile-modern__avatar-img" src={photoUrl} alt="" decoding="async" />
            ) : (
                <span className="profile-modern__avatar-fallback">{fallbackLetter}</span>
            )}
        </div>
    );
}