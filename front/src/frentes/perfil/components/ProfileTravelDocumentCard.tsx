import { useEffect, useState, type FormEvent } from 'react';
import { travelDocumentFromFinancePreferences } from '@motor/viagens/travel-document.js';
import { parseFinancePreferencesRaw } from '@motor/dinheiro/ui-chip-preferences.js';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { FormDatePicker, FormField, FormGrid, FormInput } from '../../../components/ui/form';
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

    const passportExpiry = (doc.passportExpiresOn ?? '').slice(0, 10);
    const birthDate = (doc.birthDate ?? '').slice(0, 10);

    return (
        <ProfileCard
            slot="full"
            title="Documentos de viagem"
            subtitle="Usados no ID da viagem e emissões"
            icon="flight"
        >
            {loading ? (
                <p className="profile-modern__feedback">Carregando…</p>
            ) : (
                <form className="ui-form profile-modern__travel-form" onSubmit={(e) => void onSubmit(e)}>
                    <FormGrid columns={2} className="profile-modern__travel-grid">
                        <FormField id="travel-doc-cpf" label="CPF">
                            <FormInput
                                id="travel-doc-cpf"
                                value={doc.cpf ?? ''}
                                onChange={(e) => setDoc((d) => ({ ...d, cpf: e.target.value }))}
                                autoComplete="off"
                                inputMode="numeric"
                            />
                        </FormField>
                        <FormField id="travel-doc-passport" label="Nº passaporte">
                            <FormInput
                                id="travel-doc-passport"
                                value={doc.passportNumber ?? ''}
                                onChange={(e) => setDoc((d) => ({ ...d, passportNumber: e.target.value }))}
                                autoComplete="off"
                            />
                        </FormField>
                        <FormField id="travel-doc-passport-expiry" label="Validade do passaporte">
                            <FormDatePicker
                                id="travel-doc-passport-expiry"
                                value={passportExpiry}
                                onChange={(iso) =>
                                    setDoc((d) => ({ ...d, passportExpiresOn: iso || undefined }))
                                }
                                placeholder="Validade"
                            />
                        </FormField>
                        <FormField id="travel-doc-birth" label="Data de nascimento">
                            <FormDatePicker
                                id="travel-doc-birth"
                                value={birthDate}
                                onChange={(iso) => setDoc((d) => ({ ...d, birthDate: iso || undefined }))}
                                placeholder="Nascimento"
                            />
                        </FormField>
                    </FormGrid>
                    <div className="profile-modern__form-footer profile-modern__form-footer--travel">
                        <button type="submit" className="ui-form-btn ui-form-btn--contained" disabled={saving}>
                            <MaterialIcon name="check" variant="app" />
                            {saving ? 'Salvando…' : 'Salvar documentos'}
                        </button>
                        {message ? <p className="profile-modern__feedback">{message}</p> : null}
                    </div>
                </form>
            )}
        </ProfileCard>
    );
}