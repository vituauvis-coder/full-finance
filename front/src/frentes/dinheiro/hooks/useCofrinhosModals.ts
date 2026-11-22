import { useCallback, useState } from 'react';
import type { CofrinhoBucket } from '../domain/cofrinhoAggregations';

export function useCofrinhosModals() {
    const [bucketModalOpen, setBucketModalOpen] = useState(false);
    const [editingBucket, setEditingBucket] = useState<CofrinhoBucket | null>(null);
    const [applicationModalOpen, setApplicationModalOpen] = useState(false);
    const [allocateBucketId, setAllocateBucketId] = useState<string | null>(null);
    const [allocatePoolYearMonth, setAllocatePoolYearMonth] = useState<string | null>(null);
    const [historyBucket, setHistoryBucket] = useState<CofrinhoBucket | null>(null);

    const openCreateBucket = useCallback(() => {
        setEditingBucket(null);
        setBucketModalOpen(true);
    }, []);

    const openEditBucket = useCallback((bucket: CofrinhoBucket) => {
        setEditingBucket(bucket);
        setBucketModalOpen(true);
    }, []);

    const closeBucketModal = useCallback(() => setBucketModalOpen(false), []);

    const openAllocate = useCallback((bucketId?: string, poolYearMonth?: string) => {
        setAllocateBucketId(bucketId ?? null);
        setAllocatePoolYearMonth(poolYearMonth?.trim() || null);
        setApplicationModalOpen(true);
    }, []);

    const closeApplicationModal = useCallback(() => {
        setApplicationModalOpen(false);
        setAllocatePoolYearMonth(null);
    }, []);

    const openHistory = useCallback((bucket: CofrinhoBucket) => setHistoryBucket(bucket), []);
    const closeHistory = useCallback(() => setHistoryBucket(null), []);

    return {
        bucketModalOpen,
        editingBucket,
        applicationModalOpen,
        allocateBucketId,
        allocatePoolYearMonth,
        openCreateBucket,
        openEditBucket,
        closeBucketModal,
        openAllocate,
        closeApplicationModal,
        historyBucket,
        openHistory,
        closeHistory
    };
}