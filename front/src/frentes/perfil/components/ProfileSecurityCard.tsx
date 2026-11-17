import { ProfileCard } from './ProfileCard';
import { ProfilePasswordForm } from './ProfilePasswordForm';

type Props = {
    saving: boolean;
    message: string | null;
    onSubmit: Parameters<typeof ProfilePasswordForm>[0]['onSubmit'];
};

export function ProfileSecurityCard({ saving, message, onSubmit }: Props) {
    return (
        <ProfileCard
            slot="half"
            title="Segurança"
            subtitle="Atualize sua senha com frequência"
            icon="shield"
            iconAccent
        >
            <ProfilePasswordForm saving={saving} message={message} onSubmit={onSubmit} />
        </ProfileCard>
    );
}