import { useState } from 'react';
import { deleteUserAccount } from '../api/profileApi';

export function useProfileDeleteAccount() {
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deletingAccount, setDeletingAccount] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const openDeleteDialog = () => {
        setDeleteError(null);
        setDeleteDialogOpen(true);
    };

    const closeDeleteDialog = () => {
        if (deletingAccount) return;
        setDeleteDialogOpen(false);
        setDeleteError(null);
    };

    const confirmDeleteAccount = async () => {
        setDeletingAccount(true);
        setDeleteError(null);
        try {
            await deleteUserAccount();
            window.location.href = '/login';
        } catch {
            setDeleteError('Erro ao excluir conta. Tente novamente.');
            setDeletingAccount(false);
        }
    };

    return {
        deleteDialogOpen,
        deletingAccount,
        deleteError,
        openDeleteDialog,
        closeDeleteDialog,
        confirmDeleteAccount
    };
}