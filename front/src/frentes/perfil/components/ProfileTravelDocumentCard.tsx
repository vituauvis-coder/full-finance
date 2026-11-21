import { useEffect, useState, type FormEvent } from 'react';
import { travelDocumentFromFinancePreferences } from '@motor/viagens/travel-document.js';
import { parseFinancePreferencesRaw } from '@motor/dinheiro/ui-chip-preferences.js';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { getFinancePreferences } from '../../../lib/financePreferences';
import { notifyProfileUpdated } from '../../../lib/profileEvents';
import type { TravelDocumentPayload } from '../../../lib/types/profile';
import { fetchProfile, patchProfile } from '../api/profileApi';
import { ProfileCard } from './ProfileCard';

export function ProfileTravelDocumentCard() {
    const [doc, setDoc] = useState<TravelDocumentPayload>({});
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const profile = await fetchProfile();
                if (cancelled) return;
                setDoc(travelDocumentFromFinancePreferences(profile.financePreferences));
            } catch {
                if (!cancelled) setDoc({});
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setSaving(true);
        setMessage(null);
        try {
            const profile = await fetchProfile();
            const raw = parseFinancePreferencesRaw(profile) as Record<string, unknown>;
            const manual = getFinancePreferences(profile).manualCashOut;
            await patchProfile({
                financePreferences: {
                    ...raw,
                    manualCashOut: manual,
                    travelDocument: { ...doc }
                } as never
            });
            setMessage('Documentos de viagem salvos.');
            notifyProfileUpdated();
        } catch {
            setMessage('Não foi possível salvar. Tente novamente.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <ProfileCard
            slot="half"
            title="Documentos de viagem"
            subtitle="Usados no ID da viagem e emissões"
            icon="badge"
        >
            {loading ? (
                <p className="profile-modern__feedback">Carregando…</p>
            ) : (
                <form className="profile-modern__form profile-modern__form--balanced" onSubmit={(e) => void onSubmit(e)}>
                    <label className="profile-modern__field">
                        <span>CPF</span>
                        <input
                            className="profile-modern__input"
                            value={doc.cpf ?? ''}
                            onChange={(e) => setDoc((d) => ({ ...d, cpf: e.target.value }))}
                            autoComplete="off"
                            inputMode="numeric"
                        />
                    </label>
                    <label className="profile-modern__field">
                        <span>Nº passaporte</span>
                        <input
                            className="profile-modern__input"
                            value={doc.passportNumber ?? ''}
                            onChange={(e) => setDoc((d) => ({ ...d, passportNumber: e.target.value }))}
                            autoComplete="off"
                        />
                    </label>
                    <label className="profile-modern__field">
                        <span>Validade do passaporte</span>
                        <input
                            type="date"
                            className="profile-modern__input"
                            value={(doc.passportExpiresOn ?? '').slice(0, 10)}
                            onChange={(e) =>
                                setDoc((d) => ({ ...d, passportExpiresOn: e.target.value || undefined }))
                            }
                        />
                    </label>
                    <label className="profile-modern__field">
                        <span>Data de nascimento</span>
                        <input
                            type="date"
                            className="profile-modern__input"
                            value={(doc.birthDate ?? '').slice(0, 10)}
                            onChange={(e) => setDoc((d) => ({ ...d, birthDate: e.target.value || undefined }))}
                        />
                    </label>
                    <div className="profile-modern__form-footer">
                        <button type="submit" className="profile-modern__btn" disabled={saving}>
                            <MaterialIcon name="check" variant="app" />
                            Salvar documentos
                        </button>
                        {message ? <p className="profile-modern__feedback">{message}</p> : null}
                    </div>
                </form>
            )}
        </ProfileCard>
    );
}