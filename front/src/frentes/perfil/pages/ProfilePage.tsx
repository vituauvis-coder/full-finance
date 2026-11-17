import { ProfileAppearanceCard } from '../components/ProfileAppearanceCard';
import { ProfileBalanceCard } from '../components/ProfileBalanceCard';
import { ProfileDangerZoneCard } from '../components/ProfileDangerZoneCard';
import { ProfileDeleteAccountDialog } from '../components/ProfileDeleteAccountDialog';
import { ProfileIdentityCard } from '../components/ProfileIdentityCard';
import { ProfilePersonalCard } from '../components/ProfilePersonalCard';
import { ProfileSecurityCard } from '../components/ProfileSecurityCard';
import { ProfileWalletPrefsCard } from '../components/ProfileWalletPrefsCard';
import { useProfilePage } from '../hooks/useProfilePage';
import { ScreenLoader } from '../../../components/ui/ScreenLoader';

export function ProfilePage() {
    const m = useProfilePage();

    if (m.loading) {
        return (
            <section id="profile-page" className="page active profile-page profile-page--modern">
                <ScreenLoader label="Carregando perfil" />
            </section>
        );
    }

    if (m.loadError) {
        return (
            <section id="profile-page" className="page active profile-page profile-page--modern">
                <p className="profile-modern__feedback profile-modern__feedback--error">{m.loadError}</p>
            </section>
        );
    }

    const displayTitle = (m.profile?.name || m.profile?.email || '—').trim();
    const email = m.profile?.email ?? '—';

    return (
        <section id="profile-page" className="page active profile-page profile-page--modern">
            <div className="profile-modern">
                <div className="profile-modern__bento" aria-labelledby="profile-hero-title">
                    <ProfileIdentityCard
                        displayName={displayTitle}
                        email={email}
                        photoUrl={m.profile?.profilePhotoURL}
                        currencyLabel={m.currencyLabel}
                        themeLabel={m.themeLabel}
                        photoBusy={m.photoBusy}
                        photoMessage={m.photoMessage}
                        onPhotoPick={(file) => void m.uploadPhoto(file)}
                        onPhotoRemove={() => void m.removePhoto()}
                    />
                    <ProfilePersonalCard
                        email={email}
                        name={m.name}
                        onNameChange={m.setName}
                        saving={m.savingName}
                        message={m.message}
                        onSubmit={(e) => void m.saveName(e)}
                    />
                    <ProfileSecurityCard
                        saving={m.savingPassword}
                        message={m.passwordMessage}
                        onSubmit={m.savePassword}
                    />
                    <ProfileAppearanceCard
                        currency={m.currency}
                        savingCurrency={m.savingCurrency}
                        appearanceMessage={m.appearanceMessage}
                        uiSoundsEnabled={m.uiSoundsEnabled}
                        onCurrencyChange={(v) => void m.saveCurrency(v)}
                        onUiSoundsChange={m.setUiSounds}
                    />
                    <ProfileBalanceCard
                        currencySymbol={m.currencySymbol}
                        balance={m.balanceInput}
                        onBalanceChange={m.setBalanceInput}
                        saving={m.savingBalance}
                        message={m.balanceMessage}
                        onSubmit={(e) => void m.saveBalance(e)}
                    />
                    <ProfileWalletPrefsCard
                        prefs={m.financePrefs}
                        saving={m.savingFinance}
                        message={m.financeMessage}
                        onChange={m.patchFinancePrefs}
                        onSubmit={(e) => void m.saveFinancePrefs(e)}
                    />
                    <ProfileDangerZoneCard onDeleteClick={m.openDeleteDialog} />
                </div>
            </div>
            <ProfileDeleteAccountDialog
                open={m.deleteDialogOpen}
                email={email}
                busy={m.deletingAccount}
                error={m.deleteError}
                onClose={m.closeDeleteDialog}
                onConfirm={m.confirmDeleteAccount}
            />
        </section>
    );
}