import { useCallback, useState } from 'react';
import type { CofrinhoBucket } from '../domain/cofrinhoAggregations';

export function useCofrinhosModals() {
    const [bucketModalOpen, setBucketModalOpen] = useState(false);
    const [editingBucket, setEditingBucket] = useState<CofrinhoBucket | null>(null);
    const [applicationModalOpen, setApplicationModalOpen] = useState(false);
    const [allocateBucketId, setAllocateBucketId] = useState<string | null>(null);

    const openCreateBucket = useCallback(() => {
        setEditingBucket(null);
        setBucketModalOpen(true);
    }, []);

    const openEditBucket = useCallback((bucket: CofrinhoBucket) => {
        setEditingBucket(bucket);
        setBucketModalOpen(true);
    }, []);

    const closeBucketModal = useCallback(() => setBucketModalOpen(false), []);

    const openAllocate = useCallback((bucketId?: string) => {
        setAllocateBucketId(bucketId ?? null);
        setApplicationModalOpen(true);
    }, []);

    const closeApplicationModal = useCallback(() => setApplicationModalOpen(false), []);

    return {
        bucketModalOpen,
        editingBucket,
        applicationModalOpen,
        allocateBucketId,
        openCreateBucket,
        openEditBucket,
        closeBucketModal,
        openAllocate,
        closeApplicationModal
    };
}