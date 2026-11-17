import {
    profilePhotoErrorMessage as motorPhotoErrorMessage,
    validateProfilePhotoFile
} from '@motor/conta/profile-rules.js';

export { profilePhotoErrorMessage } from '@motor/conta/profile-rules.js';

export function readProfileImageAsDataUrl(file: File): Promise<string> {
    const check = validateProfilePhotoFile({ type: file.type, size: file.size });
    if (!check.ok) {
        return Promise.reject(new Error(check.code));
    }
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const result = ev.target?.result;
            if (typeof result === 'string') resolve(result);
            else reject(new Error('READ'));
        };
        reader.onerror = () => reject(new Error('READ'));
        reader.readAsDataURL(file);
    });
}

export function mapProfilePhotoError(err: unknown): string {
    const code = err instanceof Error ? err.message : '';
    return motorPhotoErrorMessage(code);
}