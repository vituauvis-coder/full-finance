import { useState } from 'react';
import { playPingSound } from '../../../app/uiSounds';
import { patchProfile } from '../api/profileApi';
import { mapProfilePhotoError, readProfileImageAsDataUrl } from '../domain/profilePhoto';
import type { ProfileUser } from '../types/profile';
import { notifyProfileUpdated } from '../../../lib/profileEvents';

export function useProfilePhoto(
    profile: ProfileUser | null,
    setProfile: (next: ProfileUser) => void
) {
    const [photoBusy, setPhotoBusy] = useState(false);
    const [photoMessage, setPhotoMessage] = useState<string | null>(null);

    const uploadPhoto = async (file: File) => {
        setPhotoBusy(true);
        setPhotoMessage(null);
        try {
            const dataUrl = await readProfileImageAsDataUrl(file);
            const updated = await patchProfile({ profilePhotoURL: dataUrl });
            setProfile(updated);
            notifyProfileUpdated();
            setPhotoMessage('Foto de perfil atualizada.');
            playPingSound();
        } catch (err) {
            setPhotoMessage(mapProfilePhotoError(err));
        } finally {
            setPhotoBusy(false);
        }
    };

    const removePhoto = async () => {
        if (!profile?.profilePhotoURL) return;
        if (!window.confirm('Tem certeza que deseja remover sua foto de perfil?')) return;
        setPhotoBusy(true);
        setPhotoMessage(null);
        try {
            const updated = await patchProfile({ profilePhotoURL: null });
            setProfile(updated);
            notifyProfileUpdated();
            setPhotoMessage('Foto removida.');
            playPingSound();
        } catch {
            setPhotoMessage('Não foi possível remover a foto.');
        } finally {
            setPhotoBusy(false);
        }
    };

    return { photoBusy, photoMessage, uploadPhoto, removePhoto };
}