import { useState, type FormEvent } from 'react';
import { playPingSound } from '../../../app/uiSounds';
import { validatePasswordChange } from '@motor/conta/profile-rules.js';
import { changePassword, patchProfile } from '../api/profileApi';
import type { ProfileUser } from '../types/profile';
import { notifyProfileUpdated } from '../../../lib/profileEvents';

type PasswordFields = { current: string; next: string; confirm: string };

export function useProfileCredentials(
    name: string,
    setProfile: (next: ProfileUser) => void
) {
    const [message, setMessage] = useState<string | null>(null);
    const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
    const [savingName, setSavingName] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);

    const saveName = async (e: FormEvent) => {
        e.preventDefault();
        setSavingName(true);
        setMessage(null);
        try {
            const updated = await patchProfile({ name: name.trim() });
            setProfile(updated);
            notifyProfileUpdated();
            setMessage('Nome atualizado.');
            playPingSound();
        } catch {
            setMessage('Não foi possível salvar o nome.');
        } finally {
            setSavingName(false);
        }
    };

    const savePassword = async (e: FormEvent, fields: PasswordFields) => {
        e.preventDefault();
        setPasswordMessage(null);
        const validation = validatePasswordChange(fields);
        if (!validation.ok) {
            setPasswordMessage(validation.message ?? 'Senha inválida.');
            return;
        }
        setSavingPassword(true);
        try {
            await changePassword({ currentPassword: fields.current, newPassword: fields.next });
            setPasswordMessage('Senha atualizada.');
            playPingSound();
        } catch (err) {
            setPasswordMessage(err instanceof Error ? err.message : 'Não foi possível alterar a senha.');
        } finally {
            setSavingPassword(false);
        }
    };

    return {
        message,
        passwordMessage,
        savingName,
        savingPassword,
        saveName,
        savePassword
    };
}